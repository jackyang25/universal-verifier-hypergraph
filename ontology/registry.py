"""Central registry for ontology entities and relations."""

from typing import Dict, List, Optional, Set, Iterator
from pathlib import Path
import yaml

from ontology.types import Entity, Relation, EntityType, RelationType


class OntologyRegistry:
    """
    Central registry for all ontology entities and relations.
    
    Provides lookup, validation, and query capabilities.
    Maintains indices for efficient access patterns.
    """
    
    def __init__(self) -> None:
        self._entities: Dict[str, Entity] = {}
        self._relations: Dict[str, Relation] = {}
        
        # indices for efficient lookups
        self._entities_by_type: Dict[EntityType, Set[str]] = {t: set() for t in EntityType}
        self._relations_by_type: Dict[RelationType, Set[str]] = {t: set() for t in RelationType}
        self._relations_by_source: Dict[str, Set[str]] = {}
        self._relations_by_target: Dict[str, Set[str]] = {}
        self._children_by_parent: Dict[str, Set[str]] = {}
    
    @property
    def entity_count(self) -> int:
        return len(self._entities)
    
    @property
    def relation_count(self) -> int:
        return len(self._relations)
    
    def register_entity(self, entity: Entity) -> None:
        """
        Register an entity in the universe.
        
        Args:
            entity: Entity to register
            
        Raises:
            ValueError: If entity with same id already exists
        """
        if entity.id in self._entities:
            raise ValueError(f"Entity '{entity.id}' already registered")
        
        self._entities[entity.id] = entity
        self._entities_by_type[entity.entity_type].add(entity.id)
        
        if entity.parent_id:
            if entity.parent_id not in self._children_by_parent:
                self._children_by_parent[entity.parent_id] = set()
            self._children_by_parent[entity.parent_id].add(entity.id)
    
    def register_relation(self, relation: Relation) -> None:
        """
        Register a relation in the universe.
        
        Args:
            relation: Relation to register
            
        Raises:
            ValueError: If relation with same id already exists
            ValueError: If source or target entity not found
        """
        if relation.id in self._relations:
            raise ValueError(f"Relation '{relation.id}' already registered")
        
        # validate referenced entities exist
        if relation.source_id not in self._entities:
            raise ValueError(f"Source entity '{relation.source_id}' not found")
        if relation.target_id not in self._entities:
            raise ValueError(f"Target entity '{relation.target_id}' not found")
        
        self._relations[relation.id] = relation
        self._relations_by_type[relation.relation_type].add(relation.id)
        
        if relation.source_id not in self._relations_by_source:
            self._relations_by_source[relation.source_id] = set()
        self._relations_by_source[relation.source_id].add(relation.id)
        
        if relation.target_id not in self._relations_by_target:
            self._relations_by_target[relation.target_id] = set()
        self._relations_by_target[relation.target_id].add(relation.id)
    
    def get_entity(self, entity_id: str) -> Optional[Entity]:
        """Get entity by id."""
        return self._entities.get(entity_id)
    
    def get_relation(self, relation_id: str) -> Optional[Relation]:
        """Get relation by id."""
        return self._relations.get(relation_id)
    
    def has_entity(self, entity_id: str) -> bool:
        """Check if entity exists."""
        return entity_id in self._entities
    
    def has_relation(self, relation_id: str) -> bool:
        """Check if relation exists."""
        return relation_id in self._relations
    
    def get_entities_by_type(self, entity_type: EntityType) -> List[Entity]:
        """Get all entities of a specific type."""
        return [self._entities[eid] for eid in self._entities_by_type[entity_type]]
    
    def get_relations_by_type(self, relation_type: RelationType) -> List[Relation]:
        """Get all relations of a specific type."""
        return [self._relations[rid] for rid in self._relations_by_type[relation_type]]
    
    def get_outgoing_relations(self, entity_id: str) -> List[Relation]:
        """Get all relations where entity is the source."""
        relation_ids = self._relations_by_source.get(entity_id, set())
        return [self._relations[rid] for rid in relation_ids]
    
    def get_incoming_relations(self, entity_id: str) -> List[Relation]:
        """Get all relations where entity is the target."""
        relation_ids = self._relations_by_target.get(entity_id, set())
        return [self._relations[rid] for rid in relation_ids]
    
    def get_children(self, parent_id: str) -> List[Entity]:
        """Get all child entities of a parent."""
        child_ids = self._children_by_parent.get(parent_id, set())
        return [self._entities[cid] for cid in child_ids]
    
    def get_contraindications_for(self, entity_id: str) -> List[Relation]:
        """Get all contraindication relations for an entity."""
        outgoing = self.get_outgoing_relations(entity_id)
        return [r for r in outgoing if r.relation_type == RelationType.CONTRAINDICATED_IN]
    
    def get_interactions_for(self, entity_id: str) -> List[Relation]:
        """Get all interaction relations involving an entity."""
        outgoing = self.get_outgoing_relations(entity_id)
        incoming = self.get_incoming_relations(entity_id)
        all_relations = outgoing + incoming
        return [r for r in all_relations if r.relation_type == RelationType.INTERACTS_WITH]
    
    def validate_entity_reference(self, entity_id: str) -> bool:
        """Validate that an entity reference is valid."""
        return entity_id in self._entities
    
    def validate_entity_references(self, entity_ids: Set[str]) -> List[str]:
        """
        Validate multiple entity references.
        
        Returns:
            List of invalid entity ids
        """
        return [eid for eid in entity_ids if eid not in self._entities]
    
    def iter_entities(self) -> Iterator[Entity]:
        """Iterate over all entities."""
        yield from self._entities.values()
    
    def iter_relations(self) -> Iterator[Relation]:
        """Iterate over all relations."""
        yield from self._relations.values()
    
    def to_dict(self) -> dict:
        """Export registry to dictionary."""
        return {
            "entities": [e.to_dict() for e in self._entities.values()],
            "relations": [r.to_dict() for r in self._relations.values()],
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> "OntologyRegistry":
        """Create registry from dictionary."""
        registry = cls()
        
        for entity_data in data.get("entities", []):
            entity = Entity.from_dict(entity_data)
            registry.register_entity(entity)
        
        for relation_data in data.get("relations", []):
            relation = Relation.from_dict(relation_data)
            registry.register_relation(relation)
        
        return registry
    
    @classmethod
    def from_yaml(cls, path: Path) -> "OntologyRegistry":
        """Load registry from YAML file."""
        with open(path, "r") as f:
            data = yaml.safe_load(f)
        return cls.from_dict(data)
    
    def save_yaml(self, path: Path) -> None:
        """Save registry to YAML file."""
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w") as f:
            yaml.dump(self.to_dict(), f, default_flow_style=False, sort_keys=False)
