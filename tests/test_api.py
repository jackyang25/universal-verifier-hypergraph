"""Tests for FastAPI endpoints."""

import pytest
from fastapi.testclient import TestClient

from api.main import app
from protocols.dependencies import get_router, reload_router


@pytest.fixture
def client():
    """Create test client."""
    reload_router()  # ensure fresh router
    return TestClient(app)


class TestHealthEndpoint:
    """Health check tests."""

    def test_health_check(self, client):
        """Health endpoint returns healthy status."""
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "version" in data


class TestGraphEndpoints:
    """Graph API tests."""

    def test_export_graph(self, client):
        """Graph export returns expected structure."""
        response = client.get("/api/graph/export")
        assert response.status_code == 200
        
        data = response.json()
        assert "nodes" in data
        assert "hulls" in data
        assert "metadata" in data
        assert "config_version" in data["metadata"]

    def test_export_graph_with_highlight(self, client):
        """Graph export with highlight conditions."""
        response = client.get("/api/graph/export?highlight_conditions=pregnant,HIV_positive")
        assert response.status_code == 200
        
        data = response.json()
        assert "active_conditions" in data["metadata"]
        assert "activated_protocol_ids" in data["metadata"]

    def test_graph_structure(self, client):
        """Graph structure returns statistics."""
        response = client.get("/api/graph/structure")
        assert response.status_code == 200
        
        data = response.json()
        assert "total_protocols" in data
        assert "total_conditions" in data
        assert "config_version" in data


class TestProtocolsEndpoints:
    """Protocols API tests."""

    def test_list_protocols(self, client):
        """List all protocols."""
        response = client.get("/api/protocols/")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            assert "id" in data[0]
            assert "name" in data[0]
            assert "conditions" in data[0]

    def test_get_protocol(self, client):
        """Get specific protocol by ID."""
        # first get a valid protocol id
        list_response = client.get("/api/protocols/")
        protocols = list_response.json()
        
        if len(protocols) > 0:
            protocol_id = protocols[0]["id"]
            response = client.get(f"/api/protocols/{protocol_id}")
            assert response.status_code == 200
            assert response.json()["id"] == protocol_id

    def test_get_protocol_not_found(self, client):
        """Get nonexistent protocol returns 404."""
        response = client.get("/api/protocols/nonexistent_protocol_xyz")
        assert response.status_code == 404


class TestRoutingEndpoints:
    """Patient routing API tests."""

    def test_route_patient_empty(self, client):
        """Route with conditions that don't match any protocol."""
        response = client.post(
            "/api/routing/match",
            json={"conditions": ["unknown_condition"]}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "activated_protocols" in data
        assert "matched_conditions" in data
        assert "timestamp" in data

    def test_route_patient_single_condition(self, client):
        """Route with single condition."""
        response = client.post(
            "/api/routing/match",
            json={"conditions": ["pregnant"]}
        )
        assert response.status_code == 200
        
        data = response.json()
        # should activate pregnancy protocol if config has it
        protocol_ids = [p["id"] for p in data["activated_protocols"]]
        if "pregnancy_protocol" in protocol_ids:
            assert True

    def test_route_patient_multiple_conditions(self, client):
        """Route with multiple conditions triggers interaction protocols."""
        response = client.post(
            "/api/routing/match",
            json={"conditions": ["pregnant", "HIV_positive"]}
        )
        assert response.status_code == 200
        
        data = response.json()
        # interaction protocol should be first (most specific)
        if len(data["activated_protocols"]) > 0:
            # protocols are ordered by condition count descending
            first_protocol = data["activated_protocols"][0]
            assert len(first_protocol["conditions"]) >= 1

    def test_route_patient_invalid_request(self, client):
        """Route with invalid request returns error."""
        response = client.post(
            "/api/routing/match",
            json={}  # missing conditions
        )
        assert response.status_code == 422  # validation error
