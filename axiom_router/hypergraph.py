"""
Core hypergraph router for axiom pack matching.

The hypergraph model:
- Nodes: Patient conditions (e.g., 'pregnant', 'HIV_positive')
- Hyperedges: Axiom pack activation rules (connecting multiple condition nodes)

A hyperedge (axiom pack) activates when ALL its connected nodes (conditions)
are present in the patient context.
"""

from pathlib import Path
from typing import Iterator, Optional

from axiom_router.axiom_pack import AxiomPack


class AxiomRouter:
    """
    Hypergraph-based router for matching patient conditions to axiom packs.
    
    The router maintains a collection of axiom packs (hyperedges) and provides
    efficient matching against patient condition sets.
    
    Example:
        >>> router = AxiomRouter()
        >>> router.add_pack(AxiomPack(
        ...     id="pregnancy_pack",
        ...     name="Pregnancy Guidelines",
        ...     conditions=frozenset({"pregnant"})
        ... ))
        >>> activated = router.match({"pregnant", "fever"})
        >>> len(activated)
        1
    """
    
    def __init__(
        self,
        config_version: str = "1.0.0",
        config_description: str = "",
        config_last_updated: Optional[str] = None,
    ) -> None:
        """
        Initialize an empty axiom router.
        
        Args:
            config_version: Version identifier for this router configuration
            config_description: Description of this configuration
            config_last_updated: Date when config was last updated (ISO format)
        """
        self._packs: dict[str, AxiomPack] = {}
        self._config_version = config_version
        self._config_description = config_description
        self._config_last_updated = config_last_updated
        
        # index: condition -> set of pack ids that include this condition
        self._condition_index: dict[str, set[str]] = {}
    
    @property
    def config_version(self) -> str:
        """Version of this router configuration."""
        return self._config_version
    
    @property
    def version(self) -> str:
        """Alias for config_version (backward compatibility)."""
        return self._config_version
    
    @property
    def config_description(self) -> str:
        """Description of this configuration."""
        return self._config_description
    
    @property
    def config_last_updated(self) -> Optional[str]:
        """Date when this configuration was last updated."""
        return self._config_last_updated
    
    @property
    def pack_count(self) -> int:
        """Number of axiom packs registered."""
        return len(self._packs)
    
    @property
    def conditions(self) -> frozenset[str]:
        """All unique conditions across all packs."""
        return frozenset(self._condition_index.keys())
    
    @property
    def packs(self) -> list[AxiomPack]:
        """List of all registered axiom packs."""
        return list(self._packs.values())
    
    def get_all_conditions(self) -> set[str]:
        """Get all unique conditions across all packs as a mutable set."""
        return set(self._condition_index.keys())
    
    def add_pack(self, pack: AxiomPack) -> None:
        """
        Register an axiom pack with the router.
        
        Args:
            pack: AxiomPack to add
            
        Raises:
            ValueError: If a pack with the same id already exists
        """
        if pack.id in self._packs:
            raise ValueError(f"Pack with id '{pack.id}' already exists")
        
        self._packs[pack.id] = pack
        
        # update condition index
        for condition in pack.conditions:
            if condition not in self._condition_index:
                self._condition_index[condition] = set()
            self._condition_index[condition].add(pack.id)
    
    def remove_pack(self, pack_id: str) -> Optional[AxiomPack]:
        """
        Remove an axiom pack from the router.
        
        Args:
            pack_id: ID of the pack to remove
            
        Returns:
            The removed pack, or None if not found
        """
        pack = self._packs.pop(pack_id, None)
        if pack is None:
            return None
        
        # update condition index
        for condition in pack.conditions:
            self._condition_index[condition].discard(pack_id)
            if not self._condition_index[condition]:
                del self._condition_index[condition]
        
        return pack
    
    def delete_pack(self, pack_id: str) -> bool:
        """
        Delete an axiom pack from the router.
        
        Args:
            pack_id: ID of the pack to delete
            
        Returns:
            True if pack was deleted, False if not found
        """
        return self.remove_pack(pack_id) is not None
    
    def update_pack(self, pack_id: str, updates: dict) -> Optional[AxiomPack]:
        """
        Update an existing axiom pack.
        
        Args:
            pack_id: ID of the pack to update
            updates: Dictionary of fields to update
            
        Returns:
            Updated AxiomPack if found, None otherwise
        """
        existing = self._packs.get(pack_id)
        if existing is None:
            return None
        
        # build updated pack data
        pack_data = existing.to_dict()
        pack_data.update({k: v for k, v in updates.items() if v is not None})
        
        # remove old pack and add updated one
        self.remove_pack(pack_id)
        new_pack = AxiomPack.from_dict(pack_data)
        self.add_pack(new_pack)
        
        return new_pack
    
    def add_pack_from_dict(self, data: dict) -> AxiomPack:
        """
        Create and add an axiom pack from a dictionary.
        
        Args:
            data: Dictionary with pack fields
            
        Returns:
            The created AxiomPack
        """
        pack = AxiomPack.from_dict(data)
        self.add_pack(pack)
        return pack
    
    def get_pack(self, pack_id: str) -> Optional[AxiomPack]:
        """
        Retrieve an axiom pack by ID.
        
        Args:
            pack_id: ID of the pack to retrieve
            
        Returns:
            The pack if found, None otherwise
        """
        return self._packs.get(pack_id)
    
    def get_pack_version(self, pack_id: str) -> Optional[str]:
        """
        Get the version of a specific axiom pack.
        
        Args:
            pack_id: ID of the pack to query
            
        Returns:
            Version string if pack exists, None otherwise
        """
        pack = self._packs.get(pack_id)
        return pack.version if pack else None
    
    def match(self, patient_conditions: set[str]) -> list[AxiomPack]:
        """
        Find all axiom packs that activate for given patient conditions.
        
        A pack activates when ALL its conditions are present (exact matching).
        
        Args:
            patient_conditions: Set of active patient conditions
            
        Returns:
            List of activated axiom packs, ordered by condition count (most
            specific first), then by id for deterministic ordering
        """
        activated: list[AxiomPack] = []
        
        # find candidate packs that share at least one condition
        candidate_ids: set[str] = set()
        for condition in patient_conditions:
            if condition in self._condition_index:
                candidate_ids.update(self._condition_index[condition])
        
        # check each candidate for full match
        for pack_id in candidate_ids:
            pack = self._packs[pack_id]
            if pack.matches(patient_conditions):
                activated.append(pack)
        
        # sort: most specific (more conditions) first, then by id
        activated.sort(key=lambda p: (-p.condition_count, p.id))
        
        return activated
    
    def match_ids(self, patient_conditions: set[str]) -> list[str]:
        """
        Find IDs of all axiom packs that activate for given conditions.
        
        Convenience method returning just pack IDs.
        
        Args:
            patient_conditions: Set of active patient conditions
            
        Returns:
            List of activated pack IDs
        """
        return [p.id for p in self.match(patient_conditions)]
    
    def iter_packs(self) -> Iterator[AxiomPack]:
        """Iterate over all registered axiom packs."""
        yield from self._packs.values()
    
    def to_dict(self) -> dict:
        """
        Export router configuration to dictionary for serialization.
        
        Returns:
            Dictionary representation of the router
        """
        result = {
            "metadata": {
                "config_version": self._config_version,
            },
            "axiom_packs": [pack.to_dict() for pack in self._packs.values()],
        }
        
        if self._config_description:
            result["metadata"]["description"] = self._config_description
        if self._config_last_updated:
            result["metadata"]["last_updated"] = self._config_last_updated
        
        return result
    
    def export_version_manifest(self) -> dict:
        """
        Export version information for all packs for audit logging.
        
        Returns:
            Dictionary with config version and all pack versions
        """
        return {
            "config_version": self._config_version,
            "last_updated": self._config_last_updated,
            "packs": {
                pack.id: {
                    "version": pack.version,
                    "last_reviewed": pack.last_reviewed,
                }
                for pack in sorted(self._packs.values(), key=lambda p: p.id)
            },
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> "AxiomRouter":
        """
        Create an AxiomRouter from a dictionary.
        
        Supports both old format (version at root) and new format (metadata block).
        
        Args:
            data: Dictionary with router configuration
            
        Returns:
            New AxiomRouter instance
        """
        # support both old and new config formats
        metadata = data.get("metadata", {})
        
        # new format: metadata.config_version, old format: version at root
        config_version = metadata.get("config_version") or data.get("version", "1.0.0")
        config_description = metadata.get("description", "")
        config_last_updated = metadata.get("last_updated")
        
        router = cls(
            config_version=config_version,
            config_description=config_description,
            config_last_updated=config_last_updated,
        )
        
        packs_data = data.get("axiom_packs", [])
        for pack_data in packs_data:
            pack = AxiomPack.from_dict(pack_data)
            router.add_pack(pack)
        
        return router
    
    @classmethod
    def from_config(cls, path: str | Path) -> "AxiomRouter":
        """
        Load router from a YAML or JSON config file.
        
        Args:
            path: Path to config file (.yaml, .yml, or .json)
            
        Returns:
            New AxiomRouter instance
            
        Raises:
            ValueError: If file extension is not supported
            FileNotFoundError: If config file doesn't exist
        """
        from axiom_router.loader import load_from_json, load_from_yaml
        
        path = Path(path)
        
        if path.suffix in (".yaml", ".yml"):
            return load_from_yaml(path)
        elif path.suffix == ".json":
            return load_from_json(path)
        else:
            raise ValueError(f"Unsupported config file extension: {path.suffix}")
    
    def save_config(self, path: str | Path) -> None:
        """
        Save router configuration to a file.
        
        Args:
            path: Path to save config file (.yaml, .yml, or .json)
        """
        from axiom_router.loader import save_to_json, save_to_yaml
        
        path = Path(path)
        
        if path.suffix in (".yaml", ".yml"):
            save_to_yaml(self, path)
        elif path.suffix == ".json":
            save_to_json(self, path)
        else:
            raise ValueError(f"Unsupported config file extension: {path.suffix}")
    
    def export_hypergraph(self) -> dict:
        """
        Export the hypergraph structure for auditability.
        
        Returns a representation showing:
        - All nodes (conditions) in the hypergraph
        - All hyperedges (axiom packs) with their connected nodes
        
        Returns:
            Dictionary with hypergraph structure
        """
        return {
            "nodes": sorted(self.conditions),
            "hyperedges": [
                {
                    "id": pack.id,
                    "name": pack.name,
                    "nodes": sorted(pack.conditions),
                }
                for pack in sorted(self._packs.values(), key=lambda p: p.id)
            ],
        }
    
    def __len__(self) -> int:
        return len(self._packs)
    
    def __contains__(self, pack_id: str) -> bool:
        return pack_id in self._packs
    
    def __repr__(self) -> str:
        return f"AxiomRouter(config_version={self._config_version!r}, packs={self.pack_count})"

