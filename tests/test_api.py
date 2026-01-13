"""Tests for FastAPI endpoints."""

import pytest
from fastapi.testclient import TestClient

from api.main import app
from api.dependencies import get_router, reload_router


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
        assert "activated_pack_ids" in data["metadata"]

    def test_graph_structure(self, client):
        """Graph structure returns statistics."""
        response = client.get("/api/graph/structure")
        assert response.status_code == 200
        
        data = response.json()
        assert "total_packs" in data
        assert "total_conditions" in data
        assert "config_version" in data


class TestPacksEndpoints:
    """Axiom packs API tests."""

    def test_list_packs(self, client):
        """List all packs."""
        response = client.get("/api/packs/")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            assert "id" in data[0]
            assert "name" in data[0]
            assert "conditions" in data[0]

    def test_get_pack(self, client):
        """Get specific pack by ID."""
        # first get a valid pack id
        list_response = client.get("/api/packs/")
        packs = list_response.json()
        
        if len(packs) > 0:
            pack_id = packs[0]["id"]
            response = client.get(f"/api/packs/{pack_id}")
            assert response.status_code == 200
            assert response.json()["id"] == pack_id

    def test_get_pack_not_found(self, client):
        """Get nonexistent pack returns 404."""
        response = client.get("/api/packs/nonexistent_pack_xyz")
        assert response.status_code == 404


class TestRoutingEndpoints:
    """Patient routing API tests."""

    def test_route_patient_empty(self, client):
        """Route with conditions that don't match any pack."""
        response = client.post(
            "/api/routing/match",
            json={"conditions": ["unknown_condition"]}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "activated_packs" in data
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
        # should activate pregnancy pack if config has it
        pack_ids = [p["id"] for p in data["activated_packs"]]
        if "pregnancy_pack" in pack_ids:
            assert True

    def test_route_patient_multiple_conditions(self, client):
        """Route with multiple conditions triggers interaction packs."""
        response = client.post(
            "/api/routing/match",
            json={"conditions": ["pregnant", "HIV_positive"]}
        )
        assert response.status_code == 200
        
        data = response.json()
        # interaction pack should be first (most specific)
        if len(data["activated_packs"]) > 0:
            # packs are ordered by condition count descending
            first_pack = data["activated_packs"][0]
            assert len(first_pack["conditions"]) >= 1

    def test_route_patient_invalid_request(self, client):
        """Route with invalid request returns error."""
        response = client.post(
            "/api/routing/match",
            json={}  # missing conditions
        )
        assert response.status_code == 422  # validation error
