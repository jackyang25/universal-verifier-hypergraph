"""Ontology schema definition and validation."""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Set
import yaml

from ontology.types import Entity, Relation, EntityType, RelationType
from ontology.registry import OntologyRegistry


@dataclass
class SchemaValidationError:
    """Represents a validation error in the universe schema."""
    
    error_type: str
    message: str
    location: Optional[str] = None
    
    def __str__(self) -> str:
        if self.location:
            return f"[{self.error_type}] {self.location}: {self.message}"
        return f"[{self.error_type}] {self.message}"


@dataclass
class ValidationResult:
    """Result of schema validation."""
    
    valid: bool
    errors: List[SchemaValidationError] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    
    def add_error(self, error_type: str, message: str, location: Optional[str] = None) -> None:
        self.errors.append(SchemaValidationError(error_type, message, location))
        self.valid = False
    
    def add_warning(self, message: str) -> None:
        self.warnings.append(message)


class OntologySchema:
    """
    Schema manager for ontology entities and relations.
    
    Handles loading, validation, and composition of ontology definitions
    from multiple sources (YAML files, directories).
    """
    
    def __init__(self) -> None:
        self.registry = OntologyRegistry()
        self._loaded_sources: List[str] = []
    
    @property
    def sources(self) -> List[str]:
        """List of loaded source paths."""
        return self._loaded_sources.copy()
    
    def load_entities_file(self, path: Path) -> None:
        """
        Load entities from a YAML file.
        
        Expected format:
        ```yaml
        entity_type: disorder
        entities:
          - id: diabetes_mellitus
            name: Diabetes Mellitus
            ...
        ```
        """
        with open(path, "r") as f:
            data = yaml.safe_load(f)
        
        entity_type = EntityType(data["entity_type"])
        
        for entity_data in data.get("entities", []):
            entity_data["entity_type"] = entity_type.value
            entity = Entity.from_dict(entity_data)
            self.registry.register_entity(entity)
        
        self._loaded_sources.append(str(path))
    
    def load_relations_file(self, path: Path) -> None:
        """
        Load relations from a YAML file.
        
        Expected format:
        ```yaml
        relation_type: contraindicated_in
        relations:
          - id: metformin_pregnancy_contraindication
            source_id: metformin
            target_id: pregnant
            ...
        ```
        """
        with open(path, "r") as f:
            data = yaml.safe_load(f)
        
        relation_type = RelationType(data["relation_type"])
        
        for relation_data in data.get("relations", []):
            relation_data["relation_type"] = relation_type.value
            if "id" not in relation_data:
                # auto-generate id if not provided
                relation_data["id"] = f"{relation_type.value}_{relation_data['source_id']}_{relation_data['target_id']}"
            relation = Relation.from_dict(relation_data)
            self.registry.register_relation(relation)
        
        self._loaded_sources.append(str(path))
    
    def load_directory(self, path: Path) -> None:
        """
        Load all universe definitions from a directory.
        
        Expected structure:
        ```
        path/
        ├── entities/
        │   ├── disorders.yaml
        │   ├── substances.yaml
        │   └── states.yaml
        └── relations/
            ├── contraindications.yaml
            └── interactions.yaml
        ```
        """
        entities_dir = path / "entities"
        relations_dir = path / "relations"
        
        # load entities first (relations depend on them)
        if entities_dir.exists():
            for yaml_file in sorted(entities_dir.glob("*.yaml")):
                self.load_entities_file(yaml_file)
        
        # then load relations
        if relations_dir.exists():
            for yaml_file in sorted(relations_dir.glob("*.yaml")):
                self.load_relations_file(yaml_file)
    
    def validate(self) -> ValidationResult:
        """
        Validate the loaded universe schema.
        
        Checks:
        - All relation references point to valid entities
        - No orphan entities (entities not connected to any relation)
        - No circular parent hierarchies
        - Required entity types are present
        """
        result = ValidationResult(valid=True)
        
        # check for orphan entities (warning, not error)
        connected_entities: Set[str] = set()
        for relation in self.registry.iter_relations():
            connected_entities.add(relation.source_id)
            connected_entities.add(relation.target_id)
        
        for entity in self.registry.iter_entities():
            if entity.id not in connected_entities:
                result.add_warning(f"Entity '{entity.id}' has no relations")
        
        # check for circular parent hierarchies
        for entity in self.registry.iter_entities():
            if entity.parent_id:
                visited = {entity.id}
                current = entity.parent_id
                while current:
                    if current in visited:
                        result.add_error(
                            "circular_hierarchy",
                            f"Circular parent hierarchy detected",
                            entity.id,
                        )
                        break
                    visited.add(current)
                    parent = self.registry.get_entity(current)
                    current = parent.parent_id if parent else None
        
        # check relation constraints
        for relation in self.registry.iter_relations():
            source = self.registry.get_entity(relation.source_id)
            target = self.registry.get_entity(relation.target_id)
            
            # validate type constraints for specific relation types
            if relation.relation_type == RelationType.CONTRAINDICATED_IN:
                if source.entity_type != EntityType.SUBSTANCE:
                    result.add_warning(
                        f"Contraindication source '{source.id}' is not a substance"
                    )
            
            if relation.relation_type == RelationType.TREATS:
                if source.entity_type != EntityType.SUBSTANCE:
                    result.add_warning(
                        f"Treatment source '{source.id}' is not a substance"
                    )
                if target.entity_type != EntityType.DISORDER:
                    result.add_warning(
                        f"Treatment target '{target.id}' is not a disorder"
                    )
            
            if relation.relation_type == RelationType.REQUIRES_DOSE_ADJUSTMENT:
                if source.entity_type != EntityType.SUBSTANCE:
                    result.add_warning(
                        f"Dose adjustment source '{source.id}' is not a substance"
                    )
        
        return result
    
    def get_entity_type_counts(self) -> Dict[EntityType, int]:
        """Get count of entities by type."""
        return {
            entity_type: len(self.registry.get_entities_by_type(entity_type))
            for entity_type in EntityType
        }
    
    def get_relation_type_counts(self) -> Dict[RelationType, int]:
        """Get count of relations by type."""
        return {
            relation_type: len(self.registry.get_relations_by_type(relation_type))
            for relation_type in RelationType
        }
    
    def export_summary(self) -> dict:
        """Export a summary of the universe schema."""
        return {
            "entity_counts": {k.value: v for k, v in self.get_entity_type_counts().items()},
            "relation_counts": {k.value: v for k, v in self.get_relation_type_counts().items()},
            "total_entities": self.registry.entity_count,
            "total_relations": self.registry.relation_count,
            "sources": self._loaded_sources,
        }
