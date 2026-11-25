"""Authentication: password hashes, signed session tokens, single-use SSE tickets. Stdlib only.

- Passwords: PBKDF2-HMAC-SHA256 with a per-user random salt, stored as
  "pbkdf2_sha256$<iterations>$<salt hex>$<hash hex>". Demo passwords come from TARS_DEMO_PASSWORD
  (applied by seed/reset); nothing is hardcoded.
- Tokens: base64url(JSON payload) + "." + base64url(HMAC-SHA256(TARS_SESSION_SECRET, payload)).
  Payload: {typ, sub, role, section, iat, exp, jti}. Identity and role come ONLY from a verified token.
  No TARS_SESSION_SECRET → a random per-process secret (tokens die on restart) + a warning.
- Stream tickets: typ "stream", 60 s, single use (jti remembered in memory until it expires); they carry
  the session's jti as `sid`, so logging out also kills tickets and open streams of that session.
- Logout: the session's jti goes into the revoked_tokens table, checked on every request and ticket.
- Passwordless login only when TARS_PASSWORDLESS_LOGIN=1 (off by default).
"""
import base64
import hashlib
import hmac
import json
import logging
import os
import secrets
import threading
import time
from typing import Optional

log = logging.getLogger("tars.auth")

PBKDF2_ITERATIONS = 200_000       # tests lower this via monkeypatch for speed; stored per hash
SESSION_HOURS_DEFAULT = 12
STREAM_TICKET_SECONDS = 60
_DUMMY_HASH = None                # equalises timing for unknown users


class AuthError(Exception):
    """Login/token failure. `detail` is safe to show to users."""

    def __init__(self, detail: str, code: str = "unauthorized"):
        super().__init__(detail)
        self.detail, self.code = detail, code


# ---------- config ----------
def passwordless_enabled() -> bool:
    return os.environ.get("TARS_PASSWORDLESS_LOGIN", "").strip() == "1"


def session_hours() -> float:
    try:
        return max(float(os.environ.get("TARS_SESSION_HOURS", SESSION_HOURS_DEFAULT)), 1 / 3600)  # ≥ 1 s
    except ValueError:
        return SESSION_HOURS_DEFAULT


_fallback_secret: Optional[bytes] = None
_secret_lock = threading.Lock()


def _secret() -> bytes:
    global _fallback_secret
    s = os.environ.get("TARS_SESSION_SECRET", "").strip()
    if s:
        if len(s) < 32:
            log.warning("TARS_SESSION_SECRET is shorter than 32 characters; use a long random value")
        return s.encode()
    with _secret_lock:
        if _fallback_secret is None:
            _fallback_secret = secrets.token_bytes(32)
            log.warning("TARS_SESSION_SECRET not set: using a random per-process secret "
                        "(all sessions end when the backend restarts)")
        return _fallback_secret


# ---------- passwords ----------
def hash_password(password: str, iterations: Optional[int] = None) -> str:
    iterations = iterations or PBKDF2_ITERATIONS
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iterations)
    return f"pbkdf2_sha256${iterations}${salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: Optional[str]) -> bool:
    if not stored or password is None:
        return False
    try:
        algo, iters, salt_hex, hash_hex = stored.split("$")
        if algo != "pbkdf2_sha256":
            return False
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), int(iters))
        return hmac.compare_digest(dk.hex(), hash_hex)
    except (ValueError, TypeError):
        return False


def authenticate(con, login_id: str, password: Optional[str]):
    """Return the users row for valid credentials, else raise AuthError (same message for unknown
    user and wrong password, so ids can't be probed)."""
    global _DUMMY_HASH
    lid = (login_id or "").strip().upper()
    row = con.execute("SELECT id, usn, name, role, section, password_hash FROM users "
                      "WHERE UPPER(usn) = ? OR UPPER(id) = ?", (lid, lid)).fetchone() if lid else None
    if not password:
        if row is not None and passwordless_enabled():
            return row
        raise AuthError("Password required" if not passwordless_enabled() else "Wrong login id or password",
                        "invalid_credentials")
    if row is None:
        _DUMMY_HASH = _DUMMY_HASH or hash_password("x")
        verify_password(password, _DUMMY_HASH)  # same cost as a real check
        raise AuthError("Wrong login id or password", "invalid_credentials")
    if not verify_password(password, row["password_hash"]):
        raise AuthError("Wrong login id or password", "invalid_credentials")
    return row


# ---------- signed tokens ----------
def _b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def _unb64(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def _sign(payload: dict) -> str:
    body = _b64(json.dumps(payload, separators=(",", ":"), sort_keys=True).encode())
    sig = _b64(hmac.new(_secret(), body.encode(), hashlib.sha256).digest())
    return f"{body}.{sig}"


def _verify(token: str, typ: str) -> dict:
    try:
        body, sig = (token or "").split(".")
        expected = _b64(hmac.new(_secret(), body.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, expected):
            raise AuthError("Invalid token")
        payload = json.loads(_unb64(body))
    except AuthError:
        raise
    except Exception:
        raise AuthError("Invalid token")
    if payload.get("typ") != typ:
        raise AuthError("Invalid token")
    if not isinstance(payload.get("exp"), (int, float)) or payload["exp"] <= time.time():
        raise AuthError("Session expired" if typ == "session" else "Stream ticket expired")
    return payload


def _claims(user, typ: str, seconds: float) -> dict:
    now = int(time.time())
    return {"typ": typ, "sub": user["id"] if "id" in user.keys() else user["user_id"], "role": user["role"],
            "section": user["section"], "iat": now, "exp": now + int(seconds), "jti": secrets.token_urlsafe(12)}


def issue_session(user) -> tuple[str, int]:
    c = _claims(user, "session", session_hours() * 3600)
    return _sign(c), c["exp"]


def verify_session(token: str) -> dict:
    return _verify(token, "session")


# ---------- revocation (logout) ----------
def revoke(con, claims: dict) -> None:
    """Revoke one session (its jti) until it would have expired; prune rows that no longer matter."""
    now = int(time.time())
    with con:
        con.execute("DELETE FROM revoked_tokens WHERE exp <= ?", (now,))
        con.execute("INSERT OR IGNORE INTO revoked_tokens (jti, exp) VALUES (?, ?)",
                    (claims["jti"], int(claims["exp"])))


def is_revoked(con, jti: Optional[str]) -> bool:
    if not jti:
        return True  # every real session has a jti; a token without one is not acceptable
    return con.execute("SELECT 1 FROM revoked_tokens WHERE jti = ?", (jti,)).fetchone() is not None


# ---------- single-use SSE tickets ----------
_used_tickets: dict[str, float] = {}   # jti -> exp
_ticket_lock = threading.Lock()


def issue_stream_ticket(claims: dict) -> tuple[str, int]:
    """From a verified session's claims (identity/role carried over, nothing re-read). `sid` = session jti."""
    now = int(time.time())
    c = {"typ": "stream", "sub": claims["sub"], "role": claims["role"], "section": claims.get("section"),
         "sid": claims.get("jti"), "iat": now, "exp": now + STREAM_TICKET_SECONDS, "jti": secrets.token_urlsafe(12)}
    return _sign(c), c["exp"]


def redeem_stream_ticket(ticket: str) -> dict:
    payload = _verify(ticket, "stream")
    with _ticket_lock:
        now = time.time()
        for jti in [j for j, exp in _used_tickets.items() if exp <= now]:
            del _used_tickets[jti]
        if payload["jti"] in _used_tickets:
            raise AuthError("Stream ticket already used")
        _used_tickets[payload["jti"]] = payload["exp"]
    return payload
