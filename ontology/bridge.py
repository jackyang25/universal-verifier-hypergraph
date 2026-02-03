"""Bridge between ontology module and protocol router."""

from pathlib import Path
from typing import List, Optional, Set, Tuple

from ontology.types import Entity, EntityType
from ontology.schema import OntologySchema, ValidationResult
from ontology.axioms.core import CoreAxioms


class OntologyBridge:
    """
    Bridge connecting the ontology module to the protocol router.
    
    Provides:
    - Validation of protocol conditions against ontology entities
    - Translation between string conditions and typed entities
    - Consistency checking using domain axioms
    """
    
    def __init__(self, schema: OntologySchema) -> None:
        self.schema = schema
        self.registry = schema.registry
        self.axioms = CoreAxioms(self.registry)
    
    @classmethod
    def from_directory(cls, path: Path) -> "OntologyBridge":
        """Load ontology data from a data directory."""
        schema = OntologySchema()
        schema.load_directory(path)
        return cls(schema)
    
    def validate_conditions(self, conditions: Set[str]) -> Tuple[bool, List[str]]:
        """
        Validate that all conditions reference valid universe entities.
        
        Args:
            conditions: Set of condition strings
            
        Returns:
            Tuple of (all_valid, list of invalid conditions)
        """
        invalid = self.registry.validate_entity_references(conditions)
        return len(invalid) == 0, invalid
    
    def resolve_condition(self, condition: str) -> Optional[Entity]:
        """
        Resolve a string condition to a typed entity.
        
        Args:
            condition: Condition string (entity id)
            
        Returns:
            Entity if found, None otherwise
        """
        return self.registry.get_entity(condition)
    
    def resolve_conditions(self, conditions: Set[str]) -> List[Entity]:
        """Resolve multiple conditions to entities (skips unresolved)."""
        entities = []
        for cond in conditions:
            entity = self.registry.get_entity(cond)
            if entity:
                entities.append(entity)
        return entities
    
    def check_consistency(self, conditions: Set[str]) -> List[str]:
        """
        Check if a set of conditions is consistent with domain axioms.
        
        Args:
            conditions: Set of condition strings
            
        Returns:
            List of axiom violations (empty if consistent)
        """
        return self.axioms.check_consistency(frozenset(conditions))
    
    def get_contraindicated_substances(self, conditions: Set[str]) -> List[Entity]:
        """
        Get substances contraindicated for given conditions.
        
        Also checks parent entities (e.g., first_trimester inherits from pregnant).
        
        Args:
            conditions: Patient conditions
            
        Returns:
            List of contraindicated substance entities
        """
        from ontology.types import RelationType
        
        contraindicated = []
        
        # expand conditions to include ancestors
        expanded_conditions = self._expand_conditions_with_ancestors(conditions)
        
        for condition in expanded_conditions:
            relations = self.registry.get_incoming_relations(condition)
            for rel in relations:
                if rel.relation_type == RelationType.CONTRAINDICATED_IN:
                    substance = self.registry.get_entity(rel.source_id)
                    if substance and substance not in contraindicated:
                        contraindicated.append(substance)
        
        return contraindicated
    
    def get_recommended_treatments(self, conditions: Set[str]) -> List[Entity]:
        """
        Get substances that treat disorders in the condition set.
        
        Args:
            conditions: Patient conditions
            
        Returns:
            List of treatment substance entities
        """
        from ontology.types import RelationType
        
        treatments = []
        
        for condition in conditions:
            entity = self.registry.get_entity(condition)
            if not entity or entity.entity_type != EntityType.DISORDER:
                continue
            
            relations = self.registry.get_incoming_relations(condition)
            for rel in relations:
                if rel.relation_type == RelationType.TREATS:
                    substance = self.registry.get_entity(rel.source_id)
                    if substance and substance not in treatments:
                        treatments.append(substance)
        
        return treatments
    
    def get_drug_interactions(self, substance_ids: Set[str]) -> List[dict]:
        """
        Get interactions between a set of substances.
        
        Args:
            substance_ids: Set of substance entity IDs to check
            
        Returns:
            List of interaction dicts with substance pairs and details
        """
        from ontology.types import RelationType
        
        interactions = []
        checked = set()
        
        for substance_id in substance_ids:
            relations = self.registry.get_interactions_for(substance_id)
            for rel in relations:
                # Get the other substance in the interaction
                other_id = rel.target_id if rel.source_id == substance_id else rel.source_id
                
                # Only include if both substances are in our set
                if other_id not in substance_ids:
                    continue
                
                # Avoid duplicates (A-B and B-A)
                pair = tuple(sorted([substance_id, other_id]))
                if pair in checked:
                    continue
                checked.add(pair)
                
                substance1 = self.registry.get_entity(pair[0])
                substance2 = self.registry.get_entity(pair[1])
                
                interactions.append({
                    "substance1_id": pair[0],
                    "substance1_name": substance1.name if substance1 else pair[0],
                    "substance2_id": pair[1],
                    "substance2_name": substance2.name if substance2 else pair[1],
                    "strength": rel.strength,
                    "evidence": rel.evidence,
                })
        
        return interactions
    
    def get_safe_treatments(self, conditions: Set[str]) -> List[Entity]:
        """
        Get treatments that are not contraindicated for given conditions.
        
        Combines treatment recommendations with contraindication filtering.
        
        Args:
            conditions: Patient conditions
            
        Returns:
            List of safe treatment substance entities
        """
        all_treatments = self.get_recommended_treatments(conditions)
        contraindicated = set(e.id for e in self.get_contraindicated_substances(conditions))
        
        return [t for t in all_treatments if t.id not in contraindicated]
    
    def generate_axioms_from_relations(self) -> int:
        """
        Generate domain axioms from universe relations.
        
        Returns:
            Number of axioms generated
        """
        generated = self.axioms.generate_from_relations()
        return len(generated)
    
    def validate_protocol_definition(
        self,
        protocol_id: str,
        required_conditions: Set[str],
        excluded_conditions: Optional[Set[str]] = None,
    ) -> ValidationResult:
        """
        Validate a protocol definition against the universe.
        
        Checks:
        - All conditions reference valid entities
        - Required conditions are logically consistent
        - Exclusions don't contradict requirements
        
        Args:
            protocol_id: Protocol identifier
            required_conditions: Conditions required for activation
            excluded_conditions: Conditions that must not be present
            
        Returns:
            ValidationResult with any errors/warnings
        """
        from ontology.schema import ValidationResult
        
        result = ValidationResult(valid=True)
        
        # check required conditions exist
        valid, invalid = self.validate_conditions(required_conditions)
        if not valid:
            for cond in invalid:
                result.add_error(
                    "unknown_entity",
                    f"Unknown entity '{cond}'",
                    f"{protocol_id}.required_conditions",
                )
        
        # check excluded conditions exist
        if excluded_conditions:
            valid, invalid = self.validate_conditions(excluded_conditions)
            if not valid:
                for cond in invalid:
                    result.add_error(
                        "unknown_entity",
                        f"Unknown entity '{cond}'",
                        f"{protocol_id}.excluded_conditions",
                    )
        
        # check consistency of required conditions
        violations = self.check_consistency(required_conditions)
        for violation in violations:
            result.add_error(
                "axiom_violation",
                violation,
                f"{protocol_id}.required_conditions",
            )
        
        # check for overlap between required and excluded
        if excluded_conditions:
            overlap = required_conditions & excluded_conditions
            if overlap:
                result.add_error(
                    "logical_contradiction",
                    f"Conditions cannot be both required and excluded: {sorted(overlap)}",
                    protocol_id,
                )
        
        return result
    
    def export_summary(self) -> dict:
        """Export summary of the loaded ontology."""
        return {
            "schema": self.schema.export_summary(),
            "axiom_count": self.axioms.axiom_registry.count,
        }
    
    def get_contraindication_reason(self, substance_id: str, conditions: Set[str]) -> str:
        """
        Get human-readable contraindication reason for a substance.
        
        Args:
            substance_id: Substance entity ID
            conditions: Patient conditions
            
        Returns:
            Human-readable reason string
        """
        from ontology.types import RelationType
        
        # expand conditions to include ancestors
        expanded_conditions = self._expand_conditions_with_ancestors(conditions)
        
        try:
            relations = self.registry.get_outgoing_relations(substance_id)
            for rel in relations:
                if rel.relation_type == RelationType.CONTRAINDICATED_IN:
                    if rel.target_id in expanded_conditions:
                        target = self.registry.get_entity(rel.target_id)
                        state_name = target.name if target else rel.target_id
                        return f"Contraindicated in {state_name}"
        except Exception:
            pass
        
        return "Contraindicated"
    
    def get_treatment_indication(self, substance_id: str, conditions: Set[str]) -> str:
        """
        Get human-readable treatment indication for a substance.
        
        Args:
            substance_id: Substance entity ID
            conditions: Patient conditions
            
        Returns:
            Human-readable indication string
        """
        from ontology.types import RelationType
        
        try:
            relations = self.registry.get_outgoing_relations(substance_id)
            treats = []
            for rel in relations:
                if rel.relation_type == RelationType.TREATS:
                    if rel.target_id in conditions:
                        target = self.registry.get_entity(rel.target_id)
                        disorder_name = target.name if target else rel.target_id
                        treats.append(disorder_name)
            
            if treats:
                return f"Treats {', '.join(treats)}"
        except Exception:
            pass
        
        return "Recommended"
    
    def _get_condition_with_ancestors(self, condition: str) -> Set[str]:
        """Get a condition and all its ancestor entities (parent chain)."""
        result = {condition}
        entity = self.registry.get_entity(condition)
        while entity and entity.parent_id:
            result.add(entity.parent_id)
            entity = self.registry.get_entity(entity.parent_id)
        return result
    
    def _expand_conditions_with_ancestors(self, conditions: Set[str]) -> Set[str]:
        """Expand conditions to include all ancestor entities."""
        expanded = set()
        for condition in conditions:
            expanded.update(self._get_condition_with_ancestors(condition))
        return expanded
    
    def get_dose_limits(self, conditions: Set[str]) -> dict[str, List[dict]]:
        """
        Get dose safety categories for substances given patient conditions.
        
        Also checks parent entities (e.g., first_trimester inherits from pregnant).
        
        Args:
            conditions: Patient conditions
            
        Returns:
            Dictionary mapping substance_id to list of dose restrictions
        """
        from ontology.types import RelationType
        
        limits = {}
        
        # expand conditions to include ancestors
        expanded_conditions = self._expand_conditions_with_ancestors(conditions)
        
        for condition in expanded_conditions:
            relations = self.registry.get_incoming_relations(condition)
            for rel in relations:
                if rel.relation_type == RelationType.REQUIRES_DOSE_ADJUSTMENT:
                    substance_id = rel.source_id
                    if substance_id not in limits:
                        limits[substance_id] = []
                    
                    limit = {
                        "condition": condition,
                        "strength": rel.strength,
                        "evidence": rel.evidence,
                    }
                    
                    if rel.dose_category is not None:
                        limit["dose_category"] = rel.dose_category.value
                    
                    limits[substance_id].append(limit)
        
        return limits
    
    def get_dose_limit_for_substance(
        self, substance_id: str, conditions: Set[str]
    ) -> List[dict]:
        """
        Get dose safety categories for a specific substance given conditions.
        
        Args:
            substance_id: Substance entity ID
            conditions: Patient conditions
            
        Returns:
            List of dose restrictions with categorical safety levels
        """
        from ontology.types import RelationType
        
        limits = []
        
        try:
            relations = self.registry.get_outgoing_relations(substance_id)
            for rel in relations:
                if rel.relation_type == RelationType.REQUIRES_DOSE_ADJUSTMENT:
                    if rel.target_id in conditions:
                        target = self.registry.get_entity(rel.target_id)
                        state_name = target.name if target else rel.target_id
                        
                        limit = {
                            "condition": rel.target_id,
                            "condition_name": state_name,
                            "strength": rel.strength,
                            "evidence": rel.evidence,
                        }
                        
                        if rel.dose_category is not None:
                            limit["dose_category"] = rel.dose_category.value
                        
                        limits.append(limit)
        except Exception:
            pass
        
        return limits
