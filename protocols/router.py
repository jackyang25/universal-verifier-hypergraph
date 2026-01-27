"""
Core hypergraph router for clinical protocol activation.

The hypergraph model:
- Nodes: Patient conditions (e.g., 'pregnant', 'HIV_positive')
- Hyperedges: Clinical protocols (activation rules connecting one or more nodes)

A hyperedge (protocol) activates when ALL its connected nodes (conditions)
are present in the patient context.
"""

from pathlib import Path
from typing import Iterator, Optional, Union

from protocols.protocol import Protocol


class ProtocolRouter:
    """
    Hypergraph-based router for matching patient conditions to clinical protocols.
    
    The router maintains a collection of clinical protocols (hyperedges) and provides
    efficient matching against patient condition sets.
    
    Example:
        >>> router = ProtocolRouter()
        >>> router.add_protocol(Protocol(
        ...     id="pregnancy_protocol",
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
        Initialize an empty clinical protocol router.
        
        Args:
            config_version: Version identifier for this router configuration
            config_description: Description of this configuration
            config_last_updated: Date when config was last updated (ISO format)
        """
        self._protocols: dict[str, Protocol] = {}
        self._config_version = config_version
        self._config_description = config_description
        self._config_last_updated = config_last_updated
        
        # index: condition -> set of protocol ids that include this condition
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
    def protocol_count(self) -> int:
        """Number of clinical protocols registered."""
        return len(self._protocols)
    
    @property
    def conditions(self) -> frozenset[str]:
        """All unique conditions across all protocols."""
        return frozenset(self._condition_index.keys())
    
    @property
    def protocols(self) -> list[Protocol]:
        """List of all registered clinical protocols."""
        return list(self._protocols.values())
    
    def get_all_conditions(self) -> set[str]:
        """Get all unique conditions across all protocols as a mutable set."""
        return set(self._condition_index.keys())
    
    def add_protocol(self, protocol: Protocol) -> None:
        """
        Register a clinical protocol with the router.
        
        Args:
            protocol: Protocol to add
            
        Raises:
            ValueError: If a protocol with the same id already exists
        """
        if protocol.id in self._protocols:
            raise ValueError(f"Protocol with id '{protocol.id}' already exists")
        
        self._protocols[protocol.id] = protocol
        
        # update condition index
        for condition in protocol.conditions:
            if condition not in self._condition_index:
                self._condition_index[condition] = set()
            self._condition_index[condition].add(protocol.id)
    
    def remove_protocol(self, protocol_id: str) -> Optional[Protocol]:
        """
        Remove a clinical protocol from the router.
        
        Args:
            protocol_id: ID of the protocol to remove
            
        Returns:
            The removed protocol, or None if not found
        """
        protocol = self._protocols.pop(protocol_id, None)
        if protocol is None:
            return None
        
        # update condition index
        for condition in protocol.conditions:
            self._condition_index[condition].discard(protocol_id)
            if not self._condition_index[condition]:
                del self._condition_index[condition]
        
        return protocol
    
    def delete_protocol(self, protocol_id: str) -> bool:
        """
        Delete a clinical protocol from the router.
        
        Args:
            protocol_id: ID of the protocol to delete
            
        Returns:
            True if protocol was deleted, False if not found
        """
        return self.remove_protocol(protocol_id) is not None
    
    def update_protocol(self, protocol_id: str, updates: dict) -> Optional[Protocol]:
        """
        Update an existing clinical protocol.
        
        Args:
            protocol_id: ID of the protocol to update
            updates: Dictionary of fields to update
            
        Returns:
            Updated Protocol if found, None otherwise
        """
        existing = self._protocols.get(protocol_id)
        if existing is None:
            return None
        
        # build updated protocol data
        protocol_data = existing.to_dict()
        protocol_data.update({k: v for k, v in updates.items() if v is not None})
        
        # remove old protocol and add updated one
        self.remove_protocol(protocol_id)
        new_protocol = Protocol.from_dict(protocol_data)
        self.add_protocol(new_protocol)
        
        return new_protocol
    
    def add_protocol_from_dict(self, data: dict) -> Protocol:
        """
        Create and add a clinical protocol from a dictionary.
        
        Args:
            data: Dictionary with protocol fields
            
        Returns:
            The created Protocol
        """
        protocol = Protocol.from_dict(data)
        self.add_protocol(protocol)
        return protocol
    
    def get_protocol(self, protocol_id: str) -> Optional[Protocol]:
        """
        Retrieve a clinical protocol by ID.
        
        Args:
            protocol_id: ID of the protocol to retrieve
            
        Returns:
            The protocol if found, None otherwise
        """
        return self._protocols.get(protocol_id)
    
    def get_protocol_version(self, protocol_id: str) -> Optional[str]:
        """
        Get the version of a specific clinical protocol.
        
        Args:
            protocol_id: ID of the protocol to query
            
        Returns:
            Version string if protocol exists, None otherwise
        """
        protocol = self._protocols.get(protocol_id)
        return protocol.version if protocol else None
    
    def match(self, patient_conditions: set[str]) -> list[Protocol]:
        """
        Find all clinical protocols that activate for given patient conditions.
        
        A protocol activates when ALL its conditions are present (exact matching).
        
        Args:
            patient_conditions: Set of active patient conditions
            
        Returns:
            List of activated protocols, ordered by condition count (most
            specific first), then by id for deterministic ordering
        """
        activated: list[Protocol] = []
        
        # find candidate protocols that share at least one condition
        candidate_ids: set[str] = set()
        for condition in patient_conditions:
            if condition in self._condition_index:
                candidate_ids.update(self._condition_index[condition])
        
        # check each candidate for full match
        for protocol_id in candidate_ids:
            protocol = self._protocols[protocol_id]
            if protocol.matches(patient_conditions):
                activated.append(protocol)
        
        # sort: most specific (more conditions) first, then by id
        activated.sort(key=lambda p: (-p.condition_count, p.id))
        
        return activated
    
    def match_ids(self, patient_conditions: set[str]) -> list[str]:
        """
        Find IDs of all clinical protocols that activate for given conditions.
        
        Convenience method returning just protocol IDs.
        
        Args:
            patient_conditions: Set of active patient conditions
            
        Returns:
            List of activated protocol IDs
        """
        return [p.id for p in self.match(patient_conditions)]
    
    def iter_protocols(self) -> Iterator[Protocol]:
        """Iterate over all registered clinical protocols."""
        yield from self._protocols.values()
    
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
            "clinical_protocols": [p.to_dict() for p in self._protocols.values()],
        }
        
        if self._config_description:
            result["metadata"]["description"] = self._config_description
        if self._config_last_updated:
            result["metadata"]["last_updated"] = self._config_last_updated
        
        return result
    
    def export_version_manifest(self) -> dict:
        """
        Export version information for all protocols for audit logging.
        
        Returns:
            Dictionary with config version and all protocol versions
        """
        return {
            "config_version": self._config_version,
            "last_updated": self._config_last_updated,
            "protocols": {
                p.id: {
                    "version": p.version,
                    "last_reviewed": p.last_reviewed,
                }
                for p in sorted(self._protocols.values(), key=lambda p: p.id)
            },
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> "ProtocolRouter":
        """
        Create a ProtocolRouter from a dictionary.
        
        Supports multiple config formats for backwards compatibility.
        
        Args:
            data: Dictionary with router configuration
            
        Returns:
            New ProtocolRouter instance
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
        
        # Support multiple config key names for backwards compatibility
        # New schema: verified_contexts
        # Old schema: clinical_protocols
        contexts_data = data.get("verified_contexts") or data.get("clinical_protocols") or []
        
        for context_data in contexts_data:
            # New schema: flatten hyperedge and protocol into Protocol
            if "hyperedge" in context_data:
                proof = context_data["hyperedge"]["proof"]
                protocol_info = context_data.get("protocol", {})
                
                protocol_dict = {
                    "id": context_data.get("context_id"),
                    "alias": context_data.get("alias"),
                    "conditions": context_data["hyperedge"]["conditions"],
                    "proof_type": proof.get("type"),
                    "proof_file": proof.get("lean_file"),
                    "proof_status": proof.get("status"),
                    "proof_encapsulates": proof.get("encapsulates"),
                    "proof_conflicts_with": proof.get("resolves_conflicts_between"),
                    "name": protocol_info.get("name"),
                    "description": protocol_info.get("description"),
                    "guideline": protocol_info.get("guideline_source"),
                    "version": protocol_info.get("version", "1.0.0"),
                }
                
                # Handle regulatory info
                if "regulatory" in protocol_info:
                    reg = protocol_info["regulatory"]
                    protocol_dict["country"] = reg.get("country")
                    protocol_dict["regulatory_body"] = reg.get("body")
                    protocol_dict["reviewer"] = reg.get("reviewer")
                    protocol_dict["approval_status"] = reg.get("approval_status")
                
                # Handle composition metadata
                if "composition" in protocol_info:
                    comp = protocol_info["composition"]
                    protocol_dict["composition_draws_from"] = comp.get("draws_from")
                    protocol_dict["composition_replaces"] = comp.get("replaces")
                    protocol_dict["composition_coordination"] = comp.get("coordination")
                    protocol_dict["composition_reason"] = comp.get("reason")
            else:
                # Old schema: use as-is
                protocol_dict = context_data
            
            protocol = Protocol.from_dict(protocol_dict)
            router.add_protocol(protocol)
        
        return router
    
    @classmethod
    def from_config(cls, path: Union[str, Path]) -> "ProtocolRouter":
        """
        Load router from a YAML or JSON config file.
        
        Args:
            path: Path to config file (.yaml, .yml, or .json)
            
        Returns:
            New ProtocolRouter instance
            
        Raises:
            ValueError: If file extension is not supported
            FileNotFoundError: If config file doesn't exist
        """
        from protocols.loader import load_from_json, load_from_yaml
        
        path = Path(path)
        
        if path.suffix in (".yaml", ".yml"):
            return load_from_yaml(path)
        elif path.suffix == ".json":
            return load_from_json(path)
        else:
            raise ValueError(f"Unsupported config file extension: {path.suffix}")
    
    def save_config(self, path: Union[str, Path]) -> None:
        """
        Save router configuration to a file.
        
        Args:
            path: Path to save config file (.yaml, .yml, or .json)
        """
        from protocols.loader import save_to_json, save_to_yaml
        
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
        - All hyperedges (clinical protocols) with their connected nodes
        
        Returns:
            Dictionary with hypergraph structure
        """
        return {
            "nodes": sorted(self.conditions),
            "hyperedges": [
                {
                    "id": p.id,
                    "name": p.name,
                    "nodes": sorted(p.conditions),
                }
                for p in sorted(self._protocols.values(), key=lambda p: p.id)
            ],
        }
    
    def __len__(self) -> int:
        return len(self._protocols)
    
    def __contains__(self, protocol_id: str) -> bool:
        return protocol_id in self._protocols
    
    def __repr__(self) -> str:
        return f"ProtocolRouter(config_version={self._config_version!r}, protocols={self.protocol_count})"

