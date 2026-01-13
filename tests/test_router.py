"""Tests for axiom router functionality."""

import json
import tempfile
from pathlib import Path

import pytest

from axiom_router import AxiomPack, AxiomRouter, load_from_yaml, load_from_json
from axiom_router.loader import save_to_yaml, save_to_json
from axiom_router.utils import (
    compute_coverage,
    diff_routers,
    find_interaction_packs,
    find_packs_for_condition,
    normalize_conditions,
    validate_patient_conditions,
)


class TestAxiomPack:
    """Tests for AxiomPack dataclass."""

    def test_create_pack(self):
        """Test basic pack creation."""
        pack = AxiomPack(
            id="test_pack",
            name="Test Pack",
            conditions=frozenset({"condition_a", "condition_b"}),
        )
        assert pack.id == "test_pack"
        assert pack.name == "Test Pack"
        assert pack.conditions == frozenset({"condition_a", "condition_b"})
        assert pack.condition_count == 2
        assert pack.is_interaction_pack is True

    def test_single_condition_not_interaction(self):
        """Single-condition pack is not an interaction pack."""
        pack = AxiomPack(
            id="single",
            name="Single",
            conditions=frozenset({"only_one"}),
        )
        assert pack.is_interaction_pack is False

    def test_pack_validation(self):
        """Test that invalid packs raise errors."""
        with pytest.raises(ValueError, match="id cannot be empty"):
            AxiomPack(id="", name="Test", conditions=frozenset({"a"}))

        with pytest.raises(ValueError, match="name cannot be empty"):
            AxiomPack(id="test", name="", conditions=frozenset({"a"}))

        with pytest.raises(ValueError, match="at least one condition"):
            AxiomPack(id="test", name="Test", conditions=frozenset())

    def test_pack_matches(self):
        """Test condition matching logic."""
        pack = AxiomPack(
            id="test",
            name="Test",
            conditions=frozenset({"a", "b"}),
        )
        
        # exact match
        assert pack.matches({"a", "b"}) is True
        
        # superset matches
        assert pack.matches({"a", "b", "c"}) is True
        
        # partial match does not activate
        assert pack.matches({"a"}) is False
        assert pack.matches({"b"}) is False
        
        # no match
        assert pack.matches({"c", "d"}) is False
        assert pack.matches(set()) is False

    def test_pack_serialization(self):
        """Test to_dict and from_dict roundtrip."""
        original = AxiomPack(
            id="test",
            name="Test Pack",
            conditions=frozenset({"x", "y"}),
            version="2.0.0",
            description="A test pack",
            last_reviewed="2024-12-01",
        )
        
        data = original.to_dict()
        restored = AxiomPack.from_dict(data)
        
        assert restored.id == original.id
        assert restored.name == original.name
        assert restored.conditions == original.conditions
        assert restored.description == original.description
        assert restored.version == original.version
        assert restored.last_reviewed == original.last_reviewed

    def test_pack_with_version_and_review(self):
        """Test pack creation with version and last_reviewed fields."""
        pack = AxiomPack(
            id="versioned",
            name="Versioned Pack",
            conditions=frozenset({"a"}),
            version="1.2.3",
            last_reviewed="2024-11-15",
        )
        
        assert pack.version == "1.2.3"
        assert pack.last_reviewed == "2024-11-15"


class TestAxiomRouter:
    """Tests for AxiomRouter."""

    def test_add_pack(self):
        """Test adding packs to router."""
        router = AxiomRouter()
        pack = AxiomPack(
            id="test",
            name="Test",
            conditions=frozenset({"a"}),
        )
        
        router.add_pack(pack)
        
        assert router.pack_count == 1
        assert "test" in router
        assert router.get_pack("test") == pack

    def test_add_duplicate_raises(self):
        """Duplicate pack IDs raise an error."""
        router = AxiomRouter()
        pack = AxiomPack(id="test", name="Test", conditions=frozenset({"a"}))
        
        router.add_pack(pack)
        
        with pytest.raises(ValueError, match="already exists"):
            router.add_pack(pack)

    def test_remove_pack(self):
        """Test pack removal."""
        router = AxiomRouter()
        pack = AxiomPack(id="test", name="Test", conditions=frozenset({"a"}))
        router.add_pack(pack)
        
        removed = router.remove_pack("test")
        
        assert removed == pack
        assert "test" not in router
        assert router.remove_pack("nonexistent") is None

    def test_match_single_condition_pack(self):
        """Test matching single-condition packs."""
        router = AxiomRouter()
        router.add_pack(AxiomPack(
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

    def test_match_interaction_pack(self):
        """Test matching multi-condition (interaction) packs."""
        router = AxiomRouter()
        router.add_pack(AxiomPack(
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

    def test_match_multiple_packs(self):
        """Test matching activates multiple applicable packs."""
        router = AxiomRouter()
        router.add_pack(AxiomPack(
            id="pregnancy",
            name="Pregnancy",
            conditions=frozenset({"pregnant"}),
        ))
        router.add_pack(AxiomPack(
            id="hiv",
            name="HIV",
            conditions=frozenset({"HIV_positive"}),
        ))
        router.add_pack(AxiomPack(
            id="preg_hiv",
            name="Pregnancy×HIV",
            conditions=frozenset({"pregnant", "HIV_positive"}),
        ))
        
        result = router.match({"pregnant", "HIV_positive", "fever"})
        
        # all three packs should activate
        assert len(result) == 3
        
        # ordered by specificity (most conditions first)
        assert result[0].id == "preg_hiv"  # 2 conditions
        # then alphabetically
        assert {result[1].id, result[2].id} == {"pregnancy", "hiv"}

    def test_match_ordering(self):
        """Activated packs are ordered by specificity then ID."""
        router = AxiomRouter()
        router.add_pack(AxiomPack(id="z", name="Z", conditions=frozenset({"a"})))
        router.add_pack(AxiomPack(id="a", name="A", conditions=frozenset({"a"})))
        router.add_pack(AxiomPack(id="ab", name="AB", conditions=frozenset({"a", "b"})))
        
        result = router.match({"a", "b"})
        
        assert [p.id for p in result] == ["ab", "a", "z"]

    def test_conditions_property(self):
        """Test that conditions property returns all unique conditions."""
        router = AxiomRouter()
        router.add_pack(AxiomPack(id="p1", name="P1", conditions=frozenset({"a", "b"})))
        router.add_pack(AxiomPack(id="p2", name="P2", conditions=frozenset({"b", "c"})))
        
        assert router.conditions == frozenset({"a", "b", "c"})


class TestLoaderAndExport:
    """Tests for loading and exporting configurations."""

    def test_yaml_roundtrip(self):
        """Test YAML save and load."""
        router = AxiomRouter(config_version="1.2.3")
        router.add_pack(AxiomPack(
            id="test",
            name="Test",
            conditions=frozenset({"a", "b"}),
        ))
        
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "config.yaml"
            save_to_yaml(router, path)
            
            loaded = load_from_yaml(path)
        
        assert loaded.config_version == "1.2.3"
        assert loaded.pack_count == 1
        assert loaded.get_pack("test") is not None

    def test_json_roundtrip(self):
        """Test JSON save and load."""
        router = AxiomRouter(config_version="1.2.3")
        router.add_pack(AxiomPack(
            id="test",
            name="Test",
            conditions=frozenset({"x"}),
        ))
        
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "config.json"
            save_to_json(router, path)
            
            loaded = load_from_json(path)
        
        assert loaded.config_version == "1.2.3"
        assert loaded.pack_count == 1

    def test_from_config_yaml(self):
        """Test AxiomRouter.from_config with YAML."""
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "test.yaml"
            path.write_text("""
version: "1.0.0"
axiom_packs:
  - id: test
    name: Test
    conditions: [a, b]
""")
            router = AxiomRouter.from_config(path)
        
        assert router.pack_count == 1

    def test_from_config_json(self):
        """Test AxiomRouter.from_config with JSON."""
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "test.json"
            path.write_text(json.dumps({
                "version": "1.0.0",
                "axiom_packs": [
                    {"id": "test", "name": "Test", "conditions": ["a"]}
                ]
            }))
            router = AxiomRouter.from_config(path)
        
        assert router.pack_count == 1

    def test_export_hypergraph(self):
        """Test hypergraph export for auditability."""
        router = AxiomRouter()
        router.add_pack(AxiomPack(
            id="p1",
            name="Pack 1",
            conditions=frozenset({"a", "b"}),
        ))
        router.add_pack(AxiomPack(
            id="p2",
            name="Pack 2",
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

    def test_find_interaction_packs(self):
        """Test finding interaction packs."""
        router = AxiomRouter()
        router.add_pack(AxiomPack(id="single", name="S", conditions=frozenset({"a"})))
        router.add_pack(AxiomPack(id="multi", name="M", conditions=frozenset({"a", "b"})))
        
        interactions = find_interaction_packs(router)
        
        assert len(interactions) == 1
        assert interactions[0].id == "multi"

    def test_find_packs_for_condition(self):
        """Test finding packs containing a specific condition."""
        router = AxiomRouter()
        router.add_pack(AxiomPack(id="p1", name="P1", conditions=frozenset({"a"})))
        router.add_pack(AxiomPack(id="p2", name="P2", conditions=frozenset({"a", "b"})))
        router.add_pack(AxiomPack(id="p3", name="P3", conditions=frozenset({"c"})))
        
        packs = find_packs_for_condition(router, "a")
        
        assert len(packs) == 2
        assert {p.id for p in packs} == {"p1", "p2"}

    def test_compute_coverage(self):
        """Test coverage computation."""
        router = AxiomRouter()
        router.add_pack(AxiomPack(id="p1", name="P1", conditions=frozenset({"a"})))
        router.add_pack(AxiomPack(id="p2", name="P2", conditions=frozenset({"a", "b"})))
        
        coverage = compute_coverage(router, {"a", "b", "unknown"})
        
        assert coverage["total_patient_conditions"] == 3
        assert coverage["recognized_conditions"] == 2
        assert coverage["unrecognized_conditions"] == ["unknown"]
        assert coverage["activated_packs"] == 2

    def test_diff_routers(self):
        """Test router comparison."""
        router_a = AxiomRouter()
        router_a.add_pack(AxiomPack(id="p1", name="P1", conditions=frozenset({"a"})))
        router_a.add_pack(AxiomPack(id="p2", name="P2", conditions=frozenset({"b"})))
        
        router_b = AxiomRouter()
        router_b.add_pack(AxiomPack(id="p1", name="P1 Modified", conditions=frozenset({"a"})))
        router_b.add_pack(AxiomPack(id="p3", name="P3", conditions=frozenset({"c"})))
        
        diff = diff_routers(router_a, router_b)
        
        assert diff["added"] == ["p3"]
        assert diff["removed"] == ["p2"]
        assert diff["modified"] == ["p1"]


class TestVersioning:
    """Tests for versioning functionality."""

    def test_config_version(self):
        """Test config version property."""
        router = AxiomRouter(
            config_version="2.0.0",
            config_description="Test config",
            config_last_updated="2025-01-13",
        )
        
        assert router.config_version == "2.0.0"
        assert router.version == "2.0.0"  # backward compat alias
        assert router.config_description == "Test config"
        assert router.config_last_updated == "2025-01-13"

    def test_get_pack_version(self):
        """Test getting individual pack versions."""
        router = AxiomRouter()
        router.add_pack(AxiomPack(
            id="p1",
            name="Pack 1",
            conditions=frozenset({"a"}),
            version="1.2.0",
        ))
        router.add_pack(AxiomPack(
            id="p2",
            name="Pack 2",
            conditions=frozenset({"b"}),
            version="1.1.0",
        ))
        
        assert router.get_pack_version("p1") == "1.2.0"
        assert router.get_pack_version("p2") == "1.1.0"
        assert router.get_pack_version("nonexistent") is None

    def test_export_version_manifest(self):
        """Test version manifest export for audit logging."""
        router = AxiomRouter(
            config_version="1.0.0",
            config_last_updated="2025-01-13",
        )
        router.add_pack(AxiomPack(
            id="pregnancy_pack",
            name="Pregnancy",
            conditions=frozenset({"pregnant"}),
            version="1.2.0",
            last_reviewed="2024-12-01",
        ))
        router.add_pack(AxiomPack(
            id="hiv_pack",
            name="HIV",
            conditions=frozenset({"HIV_positive"}),
            version="1.1.0",
            last_reviewed="2024-11-15",
        ))
        
        manifest = router.export_version_manifest()
        
        assert manifest["config_version"] == "1.0.0"
        assert manifest["last_updated"] == "2025-01-13"
        assert "pregnancy_pack" in manifest["packs"]
        assert manifest["packs"]["pregnancy_pack"]["version"] == "1.2.0"
        assert manifest["packs"]["pregnancy_pack"]["last_reviewed"] == "2024-12-01"
        assert manifest["packs"]["hiv_pack"]["version"] == "1.1.0"

    def test_metadata_config_format(self):
        """Test loading config with metadata block."""
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "test.yaml"
            path.write_text("""
metadata:
  config_version: "2.0.0"
  description: "Test configuration"
  last_updated: "2025-01-13"

axiom_packs:
  - id: test
    version: "1.5.0"
    name: Test Pack
    conditions: [a]
    last_reviewed: "2024-12-01"
""")
            router = AxiomRouter.from_config(path)
        
        assert router.config_version == "2.0.0"
        assert router.config_description == "Test configuration"
        assert router.config_last_updated == "2025-01-13"
        assert router.get_pack_version("test") == "1.5.0"
        assert router.get_pack("test").last_reviewed == "2024-12-01"

    def test_backward_compat_old_format(self):
        """Test that old config format (version at root) still works."""
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "old.yaml"
            path.write_text("""
version: "1.0.0"
axiom_packs:
  - id: test
    name: Test
    conditions: [a]
""")
            router = AxiomRouter.from_config(path)
        
        assert router.config_version == "1.0.0"
        assert router.get_pack("test") is not None


class TestIntegration:
    """Integration tests using the example config."""

    def test_load_example_config(self):
        """Load the example axiom_packs.yaml config."""
        config_path = Path(__file__).parent.parent / "config" / "axiom_packs.yaml"
        
        if not config_path.exists():
            pytest.skip("Example config not found")
        
        router = AxiomRouter.from_config(config_path)
        
        assert router.pack_count > 0
        assert router.config_version == "1.0.0"
        assert router.config_last_updated == "2025-01-13"

    def test_example_config_versions(self):
        """Test that example config has proper versioning."""
        config_path = Path(__file__).parent.parent / "config" / "axiom_packs.yaml"
        
        if not config_path.exists():
            pytest.skip("Example config not found")
        
        router = AxiomRouter.from_config(config_path)
        
        # check individual pack versions
        assert router.get_pack_version("pregnancy_pack") == "1.2.0"
        assert router.get_pack_version("hiv_pack") == "1.1.0"
        
        # check last_reviewed dates exist
        pregnancy = router.get_pack("pregnancy_pack")
        assert pregnancy.last_reviewed == "2024-12-01"

    def test_realistic_patient_scenario(self):
        """Test a realistic patient matching scenario."""
        config_path = Path(__file__).parent.parent / "config" / "axiom_packs.yaml"
        
        if not config_path.exists():
            pytest.skip("Example config not found")
        
        router = AxiomRouter.from_config(config_path)
        
        # pregnant HIV+ patient with fever (unrelated symptom)
        patient = {"pregnant", "HIV_positive", "fever"}
        activated = router.match(patient)
        
        # should activate: pregnancy_pack, hiv_pack, pregnancy_hiv_interaction
        activated_ids = {p.id for p in activated}
        
        assert "pregnancy_pack" in activated_ids
        assert "hiv_pack" in activated_ids
        assert "pregnancy_hiv_interaction" in activated_ids
        
        # interaction pack should be first (most specific)
        assert activated[0].id == "pregnancy_hiv_interaction"

    def test_version_manifest_from_example(self):
        """Test version manifest export from example config."""
        config_path = Path(__file__).parent.parent / "config" / "axiom_packs.yaml"
        
        if not config_path.exists():
            pytest.skip("Example config not found")
        
        router = AxiomRouter.from_config(config_path)
        manifest = router.export_version_manifest()
        
        assert manifest["config_version"] == "1.0.0"
        assert "pregnancy_pack" in manifest["packs"]
        assert "hiv_pack" in manifest["packs"]
        assert "pregnancy_hiv_interaction" in manifest["packs"]
