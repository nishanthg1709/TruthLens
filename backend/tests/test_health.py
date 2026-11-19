"""Tests for the health endpoint."""

from fastapi.testclient import TestClient


def test_health_returns_200(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200


def test_health_payload(client: TestClient) -> None:
    response = client.get("/health")
    payload = response.json()
    assert payload["application"] == "TruthLens"
    assert payload["status"] == "healthy"
    assert payload["version"] == "1.0.0"
