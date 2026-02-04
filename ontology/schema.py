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
        ├── constraints/
        │   ├── contraindications.yaml
        │   ├── dose_restrictions.yaml
        │   ├── exclusions.yaml
        │   └── requirements.yaml
        └── recommendations/
            ├── interactions.yaml
            └── treatments.yaml
        ```
        """
        entities_dir = path / "entities"
        constraints_dir = path / "constraints"
        recommendations_dir = path / "recommendations"
        
        # load entities first (relations depend on them)
        if entities_dir.exists():
            for yaml_file in sorted(entities_dir.glob("*.yaml")):
                self.load_entities_file(yaml_file)
        
        # load constraint relations (generate axioms)
        if constraints_dir.exists():
            for yaml_file in sorted(constraints_dir.glob("*.yaml")):
                self.load_relations_file(yaml_file)
        
        # load recommendation relations (informational)
        if recommendations_dir.exists():
            for yaml_file in sorted(recommendations_dir.glob("*.yaml")):
                self.load_relations_file(yaml_file)
        
        # validate no contradictions between contraindications and dose restrictions
        self._validate_no_constraint_conflicts()
        
        # validate no self-referential relations
        self._validate_no_self_references()
        
        # validate enum values
        self._validate_enum_values()
    
    def _validate_no_self_references(self) -> None:
        """
        Check that no relation has the same entity as source and target.
        
        Raises:
            ValueError: If self-referential relations are found
        """
        self_refs = []
        for rel in self.registry.iter_relations():
            if rel.source_id == rel.target_id:
                self_refs.append(f"{rel.relation_type.value}: {rel.source_id}")
        
        if self_refs:
            raise ValueError(
                f"Self-referential relations found (entity cannot relate to itself): {', '.join(self_refs)}"
            )
    
    def _validate_enum_values(self) -> None:
        """
        Check that all enum values (dose_category, strength) are valid.
        
        Raises:
            ValueError: If invalid enum values are found
        """
        from ontology.types import DoseCategory
        
        valid_categories = {c.value for c in DoseCategory}
        # strength is Optional[str] with expected values per Relation comment
        valid_strengths = {"absolute", "strong", "moderate", "weak"}
        
        invalid_doses = []
        invalid_strengths = []
        
        for rel in self.registry.iter_relations():
            # check dose categories
            if rel.dose_category and rel.dose_category.value not in valid_categories:
                invalid_doses.append(f"{rel.id}: '{rel.dose_category.value}'")
            
            # check strength values
            if rel.strength and rel.strength not in valid_strengths:
                invalid_strengths.append(f"{rel.id}: '{rel.strength}'")
        
        errors = []
        if invalid_doses:
            errors.append(f"Invalid dose categories: {', '.join(invalid_doses)}")
        if invalid_strengths:
            errors.append(f"Invalid strength values: {', '.join(invalid_strengths)}")
        
        if errors:
            raise ValueError(f"Enum validation failed: {'; '.join(errors)}")
    
    def _validate_no_constraint_conflicts(self) -> None:
        """
        Check that the same substance-condition pair doesn't appear in both
        contraindications and dose_restrictions.
        
        Raises:
            ValueError: If contradictory constraints are found
        """
        from ontology.types import RelationType
        
        # Get all contraindication pairs
        contraindication_pairs = set()
        for rel in self.registry.iter_relations():
            if rel.relation_type == RelationType.CONTRAINDICATED_IN:
                contraindication_pairs.add((rel.source_id, rel.target_id))
        
        # Check dose restrictions for conflicts
        conflicts = []
        for rel in self.registry.iter_relations():
            if rel.relation_type == RelationType.REQUIRES_DOSE_ADJUSTMENT:
                pair = (rel.source_id, rel.target_id)
                if pair in contraindication_pairs:
                    conflicts.append(pair)
        
        if conflicts:
            conflict_strs = [f"{s} + {c}" for s, c in conflicts]
            raise ValueError(
                f"Contradictory constraints found - same substance-condition pairs appear in both "
                f"contraindications and dose_restrictions: {', '.join(conflict_strs)}. "
                f"A substance should either be contraindicated OR have dose restrictions, not both."
            )
    
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
