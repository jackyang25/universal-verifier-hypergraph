"""Tests for protocol router functionality."""

import json
import tempfile
from pathlib import Path

import pytest

from protocols import Protocol, ProtocolRouter, load_from_yaml, load_from_json
from protocols.loader import save_to_yaml, save_to_json
from protocols.utils import (
    compute_coverage,
    diff_routers,
    find_interaction_protocols,
    find_protocols_for_condition,
    normalize_conditions,
    validate_patient_conditions,
)


class TestProtocol:
    """Tests for Protocol dataclass."""

    def test_create_protocol(self):
        """Test basic protocol creation."""
        protocol = Protocol(
            id="test_protocol",
            name="Test Protocol",
            conditions=frozenset({"condition_a", "condition_b"}),
        )
        assert protocol.id == "test_protocol"
        assert protocol.name == "Test Protocol"
        assert protocol.conditions == frozenset({"condition_a", "condition_b"})
        assert protocol.condition_count == 2
        assert protocol.is_interaction_protocol is True

    def test_single_condition_not_interaction(self):
        """Single-condition protocol is not an interaction protocol."""
        protocol = Protocol(
            id="single",
            name="Single",
            conditions=frozenset({"only_one"}),
        )
        assert protocol.is_interaction_protocol is False

    def test_protocol_validation(self):
        """Test that invalid protocols raise errors."""
        with pytest.raises(ValueError, match="id cannot be empty"):
            Protocol(id="", name="Test", conditions=frozenset({"a"}))

        with pytest.raises(ValueError, match="name cannot be empty"):
            Protocol(id="test", name="", conditions=frozenset({"a"}))

        with pytest.raises(ValueError, match="at least one condition"):
            Protocol(id="test", name="Test", conditions=frozenset())

    def test_protocol_matches(self):
        """Test condition matching logic."""
        protocol = Protocol(
            id="test",
            name="Test",
            conditions=frozenset({"a", "b"}),
        )
        
        # exact match
        assert protocol.matches({"a", "b"}) is True
        
        # superset matches
        assert protocol.matches({"a", "b", "c"}) is True
        
        # partial match does not activate
        assert protocol.matches({"a"}) is False
        assert protocol.matches({"b"}) is False
        
        # no match
        assert protocol.matches({"c", "d"}) is False
        assert protocol.matches(set()) is False

    def test_protocol_serialization(self):
        """Test to_dict and from_dict roundtrip."""
        original = Protocol(
            id="test",
            name="Test Protocol",
            conditions=frozenset({"x", "y"}),
            version="2.0.0",
            description="A test protocol",
            last_reviewed="2024-12-01",
        )
        
        data = original.to_dict()
        restored = Protocol.from_dict(data)
        
        assert restored.id == original.id
        assert restored.name == original.name
        assert restored.conditions == original.conditions
        assert restored.description == original.description
        assert restored.version == original.version
        assert restored.last_reviewed == original.last_reviewed

    def test_protocol_with_version_and_review(self):
        """Test protocol creation with version and last_reviewed fields."""
        protocol = Protocol(
            id="versioned",
            name="Versioned Protocol",
            conditions=frozenset({"a"}),
            version="1.2.3",
            last_reviewed="2024-11-15",
        )
        
        assert protocol.version == "1.2.3"
        assert protocol.last_reviewed == "2024-11-15"


class TestProtocolRouter:
    """Tests for ProtocolRouter."""

    def test_add_protocol(self):
        """Test adding protocols to router."""
        router = ProtocolRouter()
        protocol = Protocol(
            id="test",
            name="Test",
            conditions=frozenset({"a"}),
        )
        
        router.add_protocol(protocol)
        
        assert router.protocol_count == 1
        assert "test" in router
        assert router.get_protocol("test") == protocol

    def test_add_duplicate_protocol_raises(self):
        """Duplicate protocol IDs raise an error."""
        router = ProtocolRouter()
        protocol = Protocol(id="test", name="Test", conditions=frozenset({"a"}))
        
        router.add_protocol(protocol)
        
        with pytest.raises(ValueError, match="already exists"):
            router.add_protocol(protocol)

    def test_remove_protocol(self):
        """Test protocol removal."""
        router = ProtocolRouter()
        protocol = Protocol(id="test", name="Test", conditions=frozenset({"a"}))
        router.add_protocol(protocol)
        
        removed = router.remove_protocol("test")
        
        assert removed == protocol
        assert "test" not in router
        assert router.remove_protocol("nonexistent") is None

    def test_match_single_condition_protocol(self):
        """Test matching single-condition protocols."""
        router = ProtocolRouter()
        router.add_protocol(Protocol(
            id="pregnancy",
            name="Pregnancy",
            conditions=frozenset({"pregnant"}),
        ))
        
        # matches
        result = router.match({"pregnant"})
        assert len(result) == 1
        assert result[0].id == "pregnancy"
        
        # no match
        result = router.match({"HIV_positive"})
        assert len(result) == 0

    def test_match_interaction_protocol(self):
        """Test matching multi-condition (interaction) protocols."""
        router = ProtocolRouter()
        router.add_protocol(Protocol(
            id="preg_hiv",
            name="Pregnancy×HIV",
            conditions=frozenset({"pregnant", "HIV_positive"}),
        ))
        
        # both conditions present
        result = router.match({"pregnant", "HIV_positive"})
        assert len(result) == 1
        
        # only one condition - no match
        result = router.match({"pregnant"})
        assert len(result) == 0

    def test_match_multiple_protocols(self):
        """Test matching activates multiple applicable protocols."""
        router = ProtocolRouter()
        router.add_protocol(Protocol(
            id="pregnancy",
            name="Pregnancy",
            conditions=frozenset({"pregnant"}),
        ))
        router.add_protocol(Protocol(
            id="hiv",
            name="HIV",
            conditions=frozenset({"HIV_positive"}),
        ))
        router.add_protocol(Protocol(
            id="preg_hiv",
            name="Pregnancy×HIV",
            conditions=frozenset({"pregnant", "HIV_positive"}),
        ))
        
        result = router.match({"pregnant", "HIV_positive", "fever"})
        
        # all three protocols should activate
        assert len(result) == 3
        
        # ordered by specificity (most conditions first)
        assert result[0].id == "preg_hiv"  # 2 conditions
        # then alphabetically
        assert {result[1].id, result[2].id} == {"pregnancy", "hiv"}

    def test_match_ordering(self):
        """Activated protocols are ordered by specificity then ID."""
        router = ProtocolRouter()
        router.add_protocol(Protocol(id="z", name="Z", conditions=frozenset({"a"})))
        router.add_protocol(Protocol(id="a", name="A", conditions=frozenset({"a"})))
        router.add_protocol(Protocol(id="ab", name="AB", conditions=frozenset({"a", "b"})))
        
        result = router.match({"a", "b"})
        
        assert [p.id for p in result] == ["ab", "a", "z"]

    def test_conditions_property(self):
        """Test that conditions property returns all unique conditions."""
        router = ProtocolRouter()
        router.add_protocol(Protocol(id="p1", name="P1", conditions=frozenset({"a", "b"})))
        router.add_protocol(Protocol(id="p2", name="P2", conditions=frozenset({"b", "c"})))
        
        assert router.conditions == frozenset({"a", "b", "c"})


class TestLoaderAndExport:
    """Tests for loading and exporting configurations."""

    def test_yaml_roundtrip(self):
        """Test YAML save and load."""
        router = ProtocolRouter(config_version="1.2.3")
        router.add_protocol(Protocol(
            id="test",
            name="Test",
            conditions=frozenset({"a", "b"}),
        ))
        
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "config.yaml"
            save_to_yaml(router, path)
            
            loaded = load_from_yaml(path)
        
        assert loaded.config_version == "1.2.3"
        assert loaded.protocol_count == 1
        assert loaded.get_protocol("test") is not None

    def test_json_roundtrip(self):
        """Test JSON save and load."""
        router = ProtocolRouter(config_version="1.2.3")
        router.add_protocol(Protocol(
            id="test",
            name="Test",
            conditions=frozenset({"x"}),
        ))
        
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "config.json"
            save_to_json(router, path)
            
            loaded = load_from_json(path)
        
        assert loaded.config_version == "1.2.3"
        assert loaded.protocol_count == 1

    def test_from_config_yaml(self):
        """Test ProtocolRouter.from_config with YAML."""
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "test.yaml"
            path.write_text("""
version: "1.0.0"
clinical_protocols:
  - id: test
    name: Test
    conditions: [a, b]
""")
            router = ProtocolRouter.from_config(path)
        
        assert router.protocol_count == 1

    def test_from_config_json(self):
        """Test ProtocolRouter.from_config with JSON."""
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "test.json"
            path.write_text(json.dumps({
                "version": "1.0.0",
                "clinical_protocols": [
                    {"id": "test", "name": "Test", "conditions": ["a"]}
                ]
            }))
            router = ProtocolRouter.from_config(path)
        
        assert router.protocol_count == 1

    def test_export_hypergraph(self):
        """Test hypergraph export for auditability."""
        router = ProtocolRouter()
        router.add_protocol(Protocol(
            id="p1",
            name="Protocol 1",
            conditions=frozenset({"a", "b"}),
        ))
        router.add_protocol(Protocol(
            id="p2",
            name="Protocol 2",
            conditions=frozenset({"b", "c"}),
        ))
        
        graph = router.export_hypergraph()
        
        assert graph["nodes"] == ["a", "b", "c"]
        assert len(graph["hyperedges"]) == 2


class TestUtils:
    """Tests for utility functions."""

    def test_normalize_conditions(self):
        """Test condition normalization."""
        result = normalize_conditions(["  a  ", "b", "  c"])
        assert result == frozenset({"a", "b", "c"})
        
        with pytest.raises(ValueError):
            normalize_conditions([])

    def test_validate_patient_conditions(self):
        """Test patient condition validation."""
        assert validate_patient_conditions({"a", "b"}) == []
        
        errors = validate_patient_conditions(set())
        assert len(errors) == 1
        assert "empty" in errors[0].lower()

    def test_find_interaction_protocols(self):
        """Test finding interaction protocols."""
        router = ProtocolRouter()
        router.add_protocol(Protocol(id="single", name="S", conditions=frozenset({"a"})))
        router.add_protocol(Protocol(id="multi", name="M", conditions=frozenset({"a", "b"})))
        
        interactions = find_interaction_protocols(router)
        
        assert len(interactions) == 1
        assert interactions[0].id == "multi"

    def test_find_protocols_for_condition(self):
        """Test finding protocols containing a specific condition."""
        router = ProtocolRouter()
        router.add_protocol(Protocol(id="p1", name="P1", conditions=frozenset({"a"})))
        router.add_protocol(Protocol(id="p2", name="P2", conditions=frozenset({"a", "b"})))
        router.add_protocol(Protocol(id="p3", name="P3", conditions=frozenset({"c"})))
        
        protocols = find_protocols_for_condition(router, "a")

        assert len(protocols) == 2
        assert {p.id for p in protocols} == {"p1", "p2"}

    def test_compute_coverage(self):
        """Test coverage computation."""
        router = ProtocolRouter()
        router.add_protocol(Protocol(id="p1", name="P1", conditions=frozenset({"a"})))
        router.add_protocol(Protocol(id="p2", name="P2", conditions=frozenset({"a", "b"})))
        
        coverage = compute_coverage(router, {"a", "b", "unknown"})
        
        assert coverage["total_patient_conditions"] == 3
        assert coverage["recognized_conditions"] == 2
        assert coverage["unrecognized_conditions"] == ["unknown"]
        assert coverage["activated_protocols"] == 2

    def test_diff_routers(self):
        """Test router comparison."""
        router_a = ProtocolRouter()
        router_a.add_protocol(Protocol(id="p1", name="P1", conditions=frozenset({"a"})))
        router_a.add_protocol(Protocol(id="p2", name="P2", conditions=frozenset({"b"})))
        
        router_b = ProtocolRouter()
        router_b.add_protocol(Protocol(id="p1", name="P1 Modified", conditions=frozenset({"a"})))
        router_b.add_protocol(Protocol(id="p3", name="P3", conditions=frozenset({"c"})))
        
        diff = diff_routers(router_a, router_b)
        
        assert diff["added"] == ["p3"]
        assert diff["removed"] == ["p2"]
        assert diff["modified"] == ["p1"]


class TestVersioning:
    """Tests for versioning functionality."""

    def test_config_version(self):
        """Test config version property."""
        router = ProtocolRouter(
            config_version="2.0.0",
            config_description="Test config",
            config_last_updated="2025-01-13",
        )
        
        assert router.config_version == "2.0.0"
        assert router.version == "2.0.0"  # backward compat alias
        assert router.config_description == "Test config"
        assert router.config_last_updated == "2025-01-13"

    def test_get_protocol_version(self):
        """Test getting individual protocol versions."""
        router = ProtocolRouter()
        router.add_protocol(Protocol(
            id="p1",
            name="Protocol 1",
            conditions=frozenset({"a"}),
            version="1.2.0",
        ))
        router.add_protocol(Protocol(
            id="p2",
            name="Protocol 2",
            conditions=frozenset({"b"}),
            version="1.1.0",
        ))
        
        assert router.get_protocol_version("p1") == "1.2.0"
        assert router.get_protocol_version("p2") == "1.1.0"
        assert router.get_protocol_version("nonexistent") is None

    def test_export_version_manifest(self):
        """Test version manifest export for audit logging."""
        router = ProtocolRouter(
            config_version="1.0.0",
            config_last_updated="2025-01-13",
        )
        router.add_protocol(Protocol(
            id="pregnancy_protocol",
            name="Pregnancy",
            conditions=frozenset({"pregnant"}),
            version="1.2.0",
            last_reviewed="2024-12-01",
        ))
        router.add_protocol(Protocol(
            id="hiv_protocol",
            name="HIV",
            conditions=frozenset({"HIV_positive"}),
            version="1.1.0",
            last_reviewed="2024-11-15",
        ))
        
        manifest = router.export_version_manifest()
        
        assert manifest["config_version"] == "1.0.0"
        assert manifest["last_updated"] == "2025-01-13"
        assert "pregnancy_protocol" in manifest["protocols"]
        assert manifest["protocols"]["pregnancy_protocol"]["version"] == "1.2.0"
        assert manifest["protocols"]["pregnancy_protocol"]["last_reviewed"] == "2024-12-01"
        assert manifest["protocols"]["hiv_protocol"]["version"] == "1.1.0"

    def test_metadata_config_format(self):
        """Test loading config with metadata block."""
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "test.yaml"
            path.write_text("""
metadata:
  config_version: "2.0.0"
  description: "Test configuration"
  last_updated: "2025-01-13"

clinical_protocols:
  - id: test
    version: "1.5.0"
    name: Test Protocol
    conditions: [a]
    last_reviewed: "2024-12-01"
""")
            router = ProtocolRouter.from_config(path)
        
        assert router.config_version == "2.0.0"
        assert router.config_description == "Test configuration"
        assert router.config_last_updated == "2025-01-13"
        assert router.get_protocol_version("test") == "1.5.0"
        assert router.get_protocol("test").last_reviewed == "2024-12-01"

    def test_backward_compat_old_format(self):
        """Test that old config format (version at root) still works."""
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "old.yaml"
            path.write_text("""
version: "1.0.0"
clinical_protocols:
  - id: test
    name: Test
    conditions: [a]
""")
            router = ProtocolRouter.from_config(path)
        
        assert router.config_version == "1.0.0"
        assert router.get_protocol("test") is not None


class TestIntegration:
    """Integration tests using the example config."""

    def test_load_example_config(self):
        """Load the example clinical_protocols.yaml config."""
        config_path = Path(__file__).parent.parent / "protocols" / "config" / "clinical_protocols.yaml"
        
        if not config_path.exists():
            pytest.skip("Example config not found")
        
        router = ProtocolRouter.from_config(config_path)
        
        assert router.protocol_count > 0
        assert router.config_version == "1.0.0"
        assert router.config_last_updated == "2025-01-13"

    def test_example_config_versions(self):
        """Test that example config has proper versioning."""
        config_path = Path(__file__).parent.parent / "protocols" / "config" / "clinical_protocols.yaml"
        
        if not config_path.exists():
            pytest.skip("Example config not found")
        
        router = ProtocolRouter.from_config(config_path)
        
        # check individual protocol versions
        assert router.get_protocol_version("pregnancy_protocol") == "1.2.0"
        assert router.get_protocol_version("hiv_protocol") == "1.1.0"
        
        # check last_reviewed dates exist
        pregnancy = router.get_protocol("pregnancy_protocol")
        assert pregnancy.last_reviewed == "2024-12-01"

    def test_realistic_patient_scenario(self):
        """Test a realistic patient matching scenario."""
        config_path = Path(__file__).parent.parent / "protocols" / "config" / "clinical_protocols.yaml"
        
        if not config_path.exists():
            pytest.skip("Example config not found")
        
        router = ProtocolRouter.from_config(config_path)
        
        # pregnant HIV+ patient with fever (unrelated symptom)
        patient = {"pregnant", "HIV_positive", "fever"}
        activated = router.match(patient)
        
        # should activate: pregnancy_protocol, hiv_protocol, pregnancy_hiv_interaction
        activated_ids = {p.id for p in activated}
        
        assert "pregnancy_protocol" in activated_ids
        assert "hiv_protocol" in activated_ids
        assert "pregnancy_hiv_interaction" in activated_ids
        
        # interaction protocol should be first (most specific)
        assert activated[0].id == "pregnancy_hiv_interaction"

    def test_version_manifest_from_example(self):
        """Test version manifest export from example config."""
        config_path = Path(__file__).parent.parent / "protocols" / "config" / "clinical_protocols.yaml"
        
        if not config_path.exists():
            pytest.skip("Example config not found")
        
        router = ProtocolRouter.from_config(config_path)
        manifest = router.export_version_manifest()
        
        assert manifest["config_version"] == "1.0.0"
        assert "pregnancy_protocol" in manifest["protocols"]
        assert "hiv_protocol" in manifest["protocols"]
        assert "pregnancy_hiv_interaction" in manifest["protocols"]
