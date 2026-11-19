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


def test_openapi_schema_endpoint(client: TestClient) -> None:
    response = client.get("/openapi.json")
    assert response.status_code == 200
    schema = response.json()
    assert schema["openapi"].startswith("3.")
    assert "/api/v1/analyze" in schema["paths"]
    components = schema["components"]["schemas"]
    assert "AnalyzeResponse" in components
    assert "ELADetails" in components
    assert "NoiseDetails" in components
    assert "FrequencyDetails" in components
    assert "RegionalMetric" in components
    assert "RegionalNoiseMetric" in components
    assert "MetadataDetails" in components
    assert "RegionalAnomalyDetails" in components
    assert "RegionalAnomalyItem" in components
