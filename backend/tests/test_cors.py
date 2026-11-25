import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.main import add_cors, parse_cors_origins


def preflight(client, origin, path="/api/me"):
    return client.options(path, headers={"Origin": origin, "Access-Control-Request-Method": "GET",
                                         "Access-Control-Request-Headers": "x-user-id"})


@pytest.mark.parametrize("origin", [
    "http://localhost:5173",
    "http://localhost:5176",      # Vite's fallback when 5173 is busy
    "http://127.0.0.1:5176",
    "http://127.0.0.1:5173",
    "http://localhost",
])
def test_local_origins_allowed(client, origin):
    r = preflight(client, origin)
    assert r.status_code == 200
    assert r.headers["access-control-allow-origin"] == origin  # echoed, never "*"
    assert "x-user-id" in r.headers["access-control-allow-headers"].lower()
    assert r.headers["access-control-allow-credentials"] == "true"
    # real request also gets the header
    g = client.get("/api/me", headers={"Origin": origin, "X-User-Id": "S001"})
    assert g.status_code == 200 and g.headers["access-control-allow-origin"] == origin


@pytest.mark.parametrize("origin", [
    "http://evil.com",
    "http://localhost.evil.com",
    "http://localhost:5173.evil.com",
    "http://127.0.0.1.evil.com",
    "http://evil.com/?http://localhost:5173",
    "https://localhost:5173",     # only the plain-http dev servers are implicit
    "http://192.168.1.20:5173",   # LAN needs CORS_ORIGINS
    "null",
])
def test_other_origins_rejected(client, origin):
    r = preflight(client, origin)
    assert r.status_code == 400
    assert "access-control-allow-origin" not in r.headers
    g = client.get("/api/me", headers={"Origin": origin, "X-User-Id": "S001"})
    assert "access-control-allow-origin" not in g.headers  # browser will block the response


def test_parse_cors_origins():
    assert parse_cors_origins(None) == [] and parse_cors_origins("") == [] and parse_cors_origins(" , ") == []
    assert parse_cors_origins(" https://a.example.com/ ,http://192.168.1.20:5173") == [
        "https://a.example.com", "http://192.168.1.20:5173"]
    assert parse_cors_origins("*") == [] and parse_cors_origins("https://*.example.com,https://ok.com") == ["https://ok.com"]


def test_cors_origins_env_adds_exact_origins_only(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "https://tars-demo.example.com, *")
    app = FastAPI()
    add_cors(app)

    @app.get("/ping")
    def ping():
        return {"ok": True}

    c = TestClient(app)
    assert preflight(c, "https://tars-demo.example.com", "/ping").headers["access-control-allow-origin"] \
        == "https://tars-demo.example.com"
    assert preflight(c, "https://other.example.com", "/ping").status_code == 400  # "*" was ignored
    assert preflight(c, "http://localhost:5176", "/ping").status_code == 200       # regex still applies
