"""v0.5 auth with the REAL dependency (no test override): passwords, signed tokens, stream tickets."""
import base64
import json
import time
from datetime import datetime, timezone

import httpx
import pytest
from fastapi.testclient import TestClient
from test_agent import DEMO, FakeClient, demo_script
from test_notify import CHAT, FakeTelegram, link_all
from test_stream import collect, server  # noqa: F401  (real uvicorn fixture)

from app import agent, auth, notify, seed, tools

PW = "pw-for-tests"


@pytest.fixture
def api(db, real_auth, monkeypatch):
    monkeypatch.setenv("TARS_DEMO_PASSWORD", PW)
    seed.apply_demo_password(db, keep_if_unset=False)
    db.commit()
    from app.main import app
    return TestClient(app)


def login(api, login_id, password=PW):
    return api.post("/api/auth/login", json={"login_id": login_id, "password": password})


def bearer(api, login_id):
    r = login(api, login_id)
    assert r.status_code == 200, r.json()
    return {"Authorization": f"Bearer {r.json()['token']}"}


def forge(payload: dict, sig: str = "AAAA") -> str:
    body = base64.urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b"=").decode()
    return f"{body}.{sig}"


# ---------- login ----------
def test_login_with_password(api):
    r = login(api, " 1ab25cs001 ")                         # USN, case/space-insensitive
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {"token", "token_type", "expires_at", "user"} and body["token_type"] == "bearer"
    assert body["user"] == {"user_id": "S001", "usn": "1AB25CS001", "name": body["user"]["name"],
                            "role": "student", "section": "CSE-A"}
    exp = datetime.strptime(body["expires_at"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    assert 11.9 * 3600 < (exp - datetime.now(timezone.utc)).total_seconds() <= 12 * 3600
    me = api.get("/api/me", headers={"Authorization": f"Bearer {body['token']}"})
    assert me.status_code == 200 and me.json() == body["user"]
    assert login(api, "f08").json()["user"]["role"] == "faculty"
    assert login(api, "H01").json()["user"]["role"] == "hod"
    assert "password_hash" not in json.dumps(body)


def test_wrong_password_and_unknown_id_look_the_same(api):
    for lid, pw in (("S001", "nope"), ("NOBODY", "nope"), ("NOBODY", PW)):
        r = login(api, lid, pw)
        assert r.status_code == 401
        assert r.json() == {"error": "invalid_credentials", "detail": "Wrong login id or password"}
        assert r.headers["www-authenticate"] == "Bearer"


def test_passwordless_is_off_by_default(api):
    for body in ({"login_id": "S001"}, {"login_id": "S001", "password": ""}, {"login_id": "S001", "password": None}):
        r = api.post("/api/auth/login", json=body)
        assert r.status_code == 401 and r.json() == {"error": "invalid_credentials", "detail": "Password required"}


def test_passwordless_only_when_flag_is_exactly_1(api, monkeypatch):
    for v in ("true", "yes", "0"):
        monkeypatch.setenv("TARS_PASSWORDLESS_LOGIN", v)
        assert api.post("/api/auth/login", json={"login_id": "S001"}).status_code == 401
    monkeypatch.setenv("TARS_PASSWORDLESS_LOGIN", "1")
    r = api.post("/api/auth/login", json={"login_id": "S001"})
    assert r.status_code == 200 and r.json()["user"]["user_id"] == "S001"
    assert login(api, "S001", "wrong").status_code == 401           # a given password is still checked
    assert api.post("/api/auth/login", json={"login_id": "NOBODY"}).status_code == 401


def test_no_demo_password_means_no_password_login(db, real_auth):
    from app.main import app
    c = TestClient(app)                                             # seeded without TARS_DEMO_PASSWORD
    assert db.execute("SELECT COUNT(*) FROM users WHERE password_hash IS NOT NULL").fetchone()[0] == 0
    assert c.post("/api/auth/login", json={"login_id": "H01", "password": ""}).status_code == 401
    assert c.post("/api/auth/login", json={"login_id": "H01", "password": "anything"}).status_code == 401


def test_passwords_are_salted_hashes(api, db):
    rows = [r[0] for r in db.execute("SELECT password_hash FROM users")]
    assert len(rows) == 12 and len(set(rows)) == 12                 # per-user salt: all different
    assert all(h.startswith("pbkdf2_sha256$") and PW not in h for h in rows)
    assert auth.verify_password(PW, rows[0]) and not auth.verify_password("x", rows[0])
    assert not auth.verify_password(PW, None) and not auth.verify_password(PW, "garbage")


# ---------- tokens ----------
def test_forged_and_expired_tokens_are_401(api, monkeypatch):
    good = login(api, "S001").json()["token"]
    body, sig = good.split(".")
    claims = json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)))
    hod_claims = {**claims, "role": "hod", "sub": "H01"}
    other_secret = None
    monkeypatch.setenv("TARS_SESSION_SECRET", "a-completely-different-secret-" + "y" * 20)
    other_secret = auth.issue_session({"id": "H01", "role": "hod", "section": None})[0]
    monkeypatch.setenv("TARS_SESSION_SECRET", "test-secret-" + "x" * 32)
    bad = {
        "tampered role": forge(hod_claims, sig),                   # old signature, new payload
        "unsigned": forge(hod_claims),
        "other secret": other_secret,
        "garbage": "not-a-token",
        "empty sig": body + ".",
        "stream ticket as session": auth.issue_stream_ticket(claims)[0],
        "expired": auth._sign({**claims, "exp": int(time.time()) - 1}),
    }
    for name, tok in bad.items():
        r = api.get("/api/me", headers={"Authorization": f"Bearer {tok}"})
        assert r.status_code == 401 and r.json()["error"] == "unauthorized", name
    assert api.get("/api/me", headers={"Authorization": f"Bearer {bad['expired']}"}).json()["detail"] == "Session expired"
    assert api.get("/api/me", headers={"Authorization": f"Basic {good}"}).status_code == 401   # wrong scheme
    assert api.get("/api/me", headers={"Authorization": f"Bearer {good}"}).status_code == 200


def test_session_expiry_setting(api, monkeypatch):
    monkeypatch.setenv("TARS_SESSION_HOURS", "0.0003")             # ~1 s
    h = bearer(api, "S001")
    assert api.get("/api/me", headers=h).status_code == 200
    time.sleep(2.1)
    r = api.get("/api/me", headers=h)
    assert r.status_code == 401 and r.json()["detail"] == "Session expired"


def test_x_user_id_is_ignored(api):
    assert api.get("/api/me", headers={"X-User-Id": "H01"}).status_code == 401
    assert api.get("/api/stats", headers={"X-User-Id": "H01"}).status_code == 401
    student = {**bearer(api, "S001"), "X-User-Id": "H01"}
    assert api.get("/api/me", headers=student).json()["user_id"] == "S001"
    assert api.get("/api/stats", headers=student).status_code == 403


def test_role_comes_only_from_the_token(api, db):
    h = bearer(api, "S001")
    db.execute("UPDATE users SET role = 'hod' WHERE id = 'S001'")   # DB says hod...
    db.commit()
    assert api.get("/api/stats", headers=h).status_code == 403      # ...token says student
    assert api.get("/api/me", headers=h).json()["role"] == "student"


def test_every_api_endpoint_requires_a_token(api):
    public = {("POST", "/api/auth/login"), ("GET", "/api/auth/demo-users"), ("GET", "/api/stream")}
    checked = 0
    for path, ops in api.get("/openapi.json").json()["paths"].items():
        for method in (m.upper() for m in ops):
            if (method, path) in public:
                continue
            url = path.replace("{faculty_id}", "F08").replace("{decision_id}", "1").replace(
                "{nudge_id}", "1").replace("{event_id}", "1")
            r = api.request(method, url, headers={"X-User-Id": "H01"}, json={})
            assert r.status_code in (401, 404), (method, path, r.status_code)   # 404: reset-demo with demo mode off
            checked += 1
    assert checked >= 20


# ---------- HOD-only actions use the verified role ----------
def test_hod_only_actions(api, monkeypatch):
    monkeypatch.setenv("TARS_DEMO_MODE", "1")
    stu, fac, hod = bearer(api, "S001"), bearer(api, "F08"), bearer(api, "H01")
    calls = [("POST", "/api/decisions/1/approve", None), ("POST", "/api/decisions/1/reject", None),
             ("PATCH", "/api/faculty/F08", {"name": "X"}), ("POST", "/api/admin/reset-demo", None),
             ("GET", "/api/decisions", None), ("GET", "/api/stats", None)]
    for method, url, body in calls:
        for who in (stu, fac):
            r = api.request(method, url, headers=who, json=body)
            assert r.status_code == 403 and r.json()["error"] == "forbidden", (method, url)
        assert api.request(method, url, json=body).status_code == 401
        assert api.request(method, url, headers=hod, json=body).status_code in (200, 404)  # 404 = no decision 1


def test_reset_404_when_off_even_with_hod_token(api, monkeypatch):
    monkeypatch.delenv("TARS_DEMO_MODE", raising=False)
    for h in (bearer(api, "H01"), bearer(api, "S001"), {}):
        r = api.post("/api/admin/reset-demo", headers=h)
        assert r.status_code == 404 and r.json()["error"] == "not_found"


# ---------- stream tickets ----------
def test_stream_ticket_requires_session(api):
    assert api.post("/api/auth/stream-ticket").status_code == 401
    assert api.post("/api/auth/stream-ticket", headers={"X-User-Id": "H01"}).status_code == 401
    r = api.post("/api/auth/stream-ticket", headers=bearer(api, "S001"))
    assert r.status_code == 200 and set(r.json()) == {"ticket", "expires_at"}


def test_stream_rejects_missing_bad_forged_expired_tickets(api, monkeypatch):
    h = bearer(api, "S001")
    session_token = h["Authorization"].split()[1]
    ticket = api.post("/api/auth/stream-ticket", headers=h).json()["ticket"]
    body, sig = ticket.split(".")
    claims = json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)))
    monkeypatch.setattr(auth, "STREAM_TICKET_SECONDS", 0)
    expired = auth.issue_stream_ticket(claims)[0]
    cases = {"none": "", "garbage": "abc", "forged": forge({**claims, "role": "hod"}, sig),
             "session token": session_token, "expired": expired}
    for name, t in cases.items():
        r = api.get("/api/stream" + (f"?ticket={t}" if t else ""))
        assert r.status_code == 401 and r.json()["error"] == "unauthorized", name
    assert api.get(f"/api/stream?ticket={expired}").json()["detail"] == "Stream ticket expired"
    assert api.get("/api/me", headers={"Authorization": f"Bearer {ticket}"}).status_code == 401  # ticket ≠ session


def test_stream_ticket_single_use_end_to_end(api, server):
    hod = {"Authorization": "Bearer " + httpx.post(f"{server}/auth/login",
                                                    json={"login_id": "H01", "password": PW}).json()["token"]}
    t = httpx.post(f"{server}/auth/stream-ticket", headers=hod).json()["ticket"]
    events, _ = collect(f"{server}/stream?ticket={t}", 1)
    assert ("ping", {}) in events                                    # first use: stream opens
    r = httpx.get(f"{server}/stream?ticket={t}", timeout=5)           # second use: refused
    assert r.status_code == 401 and r.json()["detail"] == "Stream ticket already used"
    assert httpx.get(f"{server}/stream?user_id=H01", timeout=5).status_code == 401


# ---------- repeatable demo with real tokens ----------
@pytest.fixture
def tg(db, monkeypatch):
    fake = FakeTelegram()
    n = notify.Notifier(sender=fake)
    n.start_scheduler()
    monkeypatch.setattr(notify, "notifier", n)
    monkeypatch.setattr(agent, "make_client", lambda: FakeClient(demo_script(db)))
    yield fake, n
    n.scheduler.shutdown(wait=False)


def test_demo_repeats_after_reset_with_real_tokens(api, db, tg, monkeypatch):
    monkeypatch.setenv("TARS_DEMO_MODE", "1")
    fake, n = tg
    link_all(n)
    for run in (1, 2):
        hod = bearer(api, "H01")                                    # password still valid after reset
        r = api.post("/api/incidents", json=DEMO, headers=hod)
        assert r.status_code == 202 and r.json()["decision_id"] == 1, run
        assert tools.get_decision(1, con=db)["status"] == "pending_ack"
        assert n.scheduler.get_job("escalate-1") is not None
        assert {m["chat_id"] for m in fake.sent} == {CHAT["F07"], CHAT["F08"]}
        fake.sent.clear()
        assert api.post("/api/admin/reset-demo", headers=hod).json() == {"status": "reset", "slots": 72}
        assert n.scheduler.get_jobs() == []                          # timers cancelled
        links = dict(db.execute("SELECT id, telegram_chat_id FROM users WHERE telegram_chat_id IS NOT NULL"))
        assert links == {k: v for k, v in CHAT.items()}              # Telegram links kept
    assert api.post("/api/incidents", json=DEMO, headers=bearer(api, "S001")).status_code == 403


def test_reset_reapplies_or_keeps_passwords(api, db, monkeypatch):
    monkeypatch.setenv("TARS_DEMO_MODE", "1")
    hod = bearer(api, "H01")
    before = db.execute("SELECT password_hash FROM users WHERE id = 'S001'").fetchone()[0]
    monkeypatch.setenv("TARS_DEMO_PASSWORD", "new-pw")
    api.post("/api/admin/reset-demo", headers=hod)
    assert login(api, "S001", "new-pw").status_code == 200 and login(api, "S001", PW).status_code == 401
    monkeypatch.setenv("TARS_DEMO_PASSWORD", "")
    api.post("/api/admin/reset-demo", headers=hod)                  # unset → hashes kept, nobody locked out
    assert login(api, "S001", "new-pw").status_code == 200
    assert db.execute("SELECT password_hash FROM users WHERE id = 'S001'").fetchone()[0] != before


def test_missing_session_secret_uses_random_and_warns(monkeypatch, caplog):
    monkeypatch.setenv("TARS_SESSION_SECRET", "")
    monkeypatch.setattr(auth, "_fallback_secret", None)
    t, _ = auth.issue_session({"id": "S001", "role": "student", "section": "CSE-A"})
    assert "TARS_SESSION_SECRET not set" in caplog.text
    assert auth.verify_session(t)["sub"] == "S001"                   # same process: valid
    monkeypatch.setattr(auth, "_fallback_secret", None)              # "restart": new random secret
    with pytest.raises(auth.AuthError):
        auth.verify_session(t)


def test_openapi_declares_bearer_and_ticket(api):
    spec = api.get("/openapi.json").json()
    assert spec["components"]["securitySchemes"]["HTTPBearer"]["scheme"] == "bearer"
    stream_params = {p["name"] for p in spec["paths"]["/api/stream"]["get"]["parameters"]}
    assert stream_params == {"ticket"}
    assert "password" in spec["components"]["schemas"]["LoginRequest"]["properties"]
    assert {"LoginResponse", "StreamTicket"} <= set(spec["components"]["schemas"])
    me_params = [p["name"] for p in spec["paths"]["/api/me"]["get"].get("parameters", [])]
    assert "X-User-Id" not in me_params


def test_logout_endpoint(api):
    assert api.post("/api/auth/logout").status_code == 401
    r = api.post("/api/auth/logout", headers=bearer(api, "S001"))
    assert r.status_code == 200
    assert r.json() == {"ok": True}


# ---------- logout revokes (v0.5.1) ----------
def test_logout_revokes_this_token(api):
    h = bearer(api, "S001")
    assert api.get("/api/me", headers=h).status_code == 200
    assert api.post("/api/auth/logout", headers=h).json() == {"ok": True}
    for method, url in (("GET", "/api/me"), ("GET", "/api/today"), ("POST", "/api/auth/stream-ticket"),
                        ("POST", "/api/auth/logout")):
        r = api.request(method, url, headers=h)
        assert r.status_code == 401 and r.json() == {"error": "unauthorized", "detail": "Session revoked"}, url
    assert api.get("/api/me", headers=bearer(api, "S001")).status_code == 200   # logging in again works


def test_logout_only_ends_that_session(api):
    phone, laptop = bearer(api, "H01"), bearer(api, "H01")
    api.post("/api/auth/logout", headers=phone)
    assert api.get("/api/me", headers=phone).status_code == 401
    assert api.get("/api/stats", headers=laptop).status_code == 200            # other session of same user


def test_stream_ticket_from_logged_out_session_is_refused(api):
    h = bearer(api, "S001")
    t = api.post("/api/auth/stream-ticket", headers=h).json()["ticket"]
    body = t.split(".")[0]
    claims = json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)))
    assert claims["sid"] and claims["sid"] != claims["jti"]                    # ticket knows its session
    api.post("/api/auth/logout", headers=h)
    r = api.get(f"/api/stream?ticket={t}")
    assert r.status_code == 401 and r.json()["detail"] == "Session revoked"


def test_logout_closes_open_streams_of_that_session(api, server):
    login_ = lambda: {"Authorization": "Bearer " + httpx.post(
        f"{server}/auth/login", json={"login_id": "H01", "password": PW}).json()["token"]}
    mine, other = login_(), login_()
    from concurrent.futures import ThreadPoolExecutor
    from app import bus
    with ThreadPoolExecutor(2) as ex:
        t_mine = httpx.post(f"{server}/auth/stream-ticket", headers=mine).json()["ticket"]
        t_other = httpx.post(f"{server}/auth/stream-ticket", headers=other).json()["ticket"]
        f_mine = ex.submit(lambda: (time.time(), collect(f"{server}/stream?ticket={t_mine}", 6), time.time()))
        f_other = ex.submit(lambda: (time.time(), collect(f"{server}/stream?ticket={t_other}", 3), time.time()))
        deadline = time.time() + 5
        while len(bus._listeners) < 2:
            assert time.time() < deadline
            time.sleep(0.05)
        assert httpx.post(f"{server}/auth/logout", headers=mine).json() == {"ok": True}
        start, (events, _), end = f_mine.result(10)
        assert end - start < 4                                                  # closed by the server, not the 6 s timeout
        assert not any(e == "_session_revoked" for e, _ in events)             # internal signal never sent
        o_start, (o_events, _), o_end = f_other.result(10)
        assert o_end - o_start >= 2.9                                           # other session's stream stayed open


def test_revocation_is_stored_and_survives_demo_reset(api, db, monkeypatch):
    monkeypatch.setenv("TARS_DEMO_MODE", "1")
    gone, hod = bearer(api, "S001"), bearer(api, "H01")
    api.post("/api/auth/logout", headers=gone)
    assert db.execute("SELECT COUNT(*) FROM revoked_tokens").fetchone()[0] == 1
    assert api.post("/api/admin/reset-demo", headers=hod).status_code == 200
    assert db.execute("SELECT COUNT(*) FROM revoked_tokens").fetchone()[0] == 1
    assert api.get("/api/me", headers=gone).status_code == 401


def test_revocation_rows_are_pruned_after_expiry(api, db):
    db.execute("INSERT INTO revoked_tokens VALUES ('old', ?)", (int(time.time()) - 10,))
    db.commit()
    api.post("/api/auth/logout", headers=bearer(api, "S001"))
    assert [r[0] for r in db.execute("SELECT jti FROM revoked_tokens")] != ["old"]
    assert db.execute("SELECT COUNT(*) FROM revoked_tokens WHERE jti = 'old'").fetchone()[0] == 0


def test_token_without_jti_is_rejected(api):
    tok = auth._sign({"typ": "session", "sub": "H01", "role": "hod", "section": None,
                      "iat": int(time.time()), "exp": int(time.time()) + 3600})
    r = api.get("/api/me", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 401 and r.json()["detail"] == "Session revoked"
