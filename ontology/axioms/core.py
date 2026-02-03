"""Core domain axioms for clinical verification."""

from pathlib import Path
from typing import List
import yaml

from ontology.axioms.base import Axiom, AxiomType, AxiomRegistry
from ontology.registry import OntologyRegistry


class CoreAxioms:
    """
    Manager for core domain axioms.
    
    Provides methods to:
    - Load axioms from YAML definitions
    - Generate axioms from universe relations
    - Validate axiom consistency
    """
    
    def __init__(self, ontology_registry: OntologyRegistry) -> None:
        self.registry = ontology_registry
        self.axiom_registry = AxiomRegistry()
    
    def load_axioms_file(self, path: Path) -> None:
        """Load axioms from a YAML file."""
        with open(path, "r") as f:
            data = yaml.safe_load(f)
        
        for axiom_data in data.get("axioms", []):
            axiom = Axiom.from_dict(axiom_data)
            self.axiom_registry.register(axiom)
    
    def generate_from_relations(self) -> List[Axiom]:
        """
        Generate axioms from universe relations.
        
        Automatically creates axioms from:
        - CONTRAINDICATED_IN relations -> contraindication axioms
        - EXCLUDES relations -> mutual exclusion axioms
        - REQUIRES relations -> requirement axioms
        - REQUIRES_DOSE_ADJUSTMENT relations -> dose constraint axioms
        
        Returns:
            List of generated axioms
        """
        from ontology.types import RelationType
        
        generated = []
        
        # generate contraindication axioms
        contraindications = self.registry.get_relations_by_type(
            RelationType.CONTRAINDICATED_IN
        )
        for rel in contraindications:
            axiom = Axiom(
                id=f"contraindication_{rel.source_id}_{rel.target_id}",
                axiom_type=AxiomType.CONTRAINDICATION,
                name=f"{rel.source_id} contraindicated in {rel.target_id}",
                description=f"Substance {rel.source_id} is contraindicated when {rel.target_id} is present",
                antecedent=frozenset({rel.target_id}),
                consequent=frozenset({rel.source_id}),
                negated=True,  # cannot use source when target is present
                evidence=rel.evidence,
            )
            generated.append(axiom)
            self.axiom_registry.register(axiom)
        
        # generate mutual exclusion axioms
        exclusions = self.registry.get_relations_by_type(RelationType.EXCLUDES)
        for rel in exclusions:
            axiom = Axiom(
                id=f"exclusion_{rel.source_id}_{rel.target_id}",
                axiom_type=AxiomType.MUTUAL_EXCLUSION,
                name=f"{rel.source_id} excludes {rel.target_id}",
                description=f"{rel.source_id} and {rel.target_id} cannot coexist",
                antecedent=frozenset({rel.source_id}),
                consequent=frozenset({rel.target_id}),
                negated=True,
                evidence=rel.evidence,
            )
            generated.append(axiom)
            self.axiom_registry.register(axiom)
        
        # generate requirement axioms
        requirements = self.registry.get_relations_by_type(RelationType.REQUIRES)
        for rel in requirements:
            axiom = Axiom(
                id=f"requirement_{rel.source_id}_{rel.target_id}",
                axiom_type=AxiomType.REQUIREMENT,
                name=f"{rel.source_id} requires {rel.target_id}",
                description=f"When {rel.source_id} is used, {rel.target_id} must be present",
                antecedent=frozenset({rel.source_id}),
                consequent=frozenset({rel.target_id}),
                negated=False,
                evidence=rel.evidence,
            )
            generated.append(axiom)
            self.axiom_registry.register(axiom)
        
        # generate dose constraint axioms
        dose_limits = self.registry.get_relations_by_type(
            RelationType.REQUIRES_DOSE_ADJUSTMENT
        )
        for rel in dose_limits:
            # build description focused on categorical safety constraint
            category = rel.dose_category.value if rel.dose_category else "restricted"
            description = (
                f"Substance {rel.source_id} is {category.replace('_', ' ')} "
                f"when {rel.target_id} is present"
            )
            
            # use relation's actual ID to ensure uniqueness
            axiom = Axiom(
                id=f"dose_constraint_{rel.id}",
                axiom_type=AxiomType.DOSE_CONSTRAINT,
                name=f"{rel.source_id} {category} in {rel.target_id}",
                description=description,
                antecedent=frozenset({rel.target_id}),
                consequent=frozenset({rel.source_id}),
                negated=False,  # constraint applies, not prohibition
                evidence=rel.evidence,
                dose_category=category,  # categorical safety level for Lean formalization
            )
            generated.append(axiom)
            self.axiom_registry.register(axiom)
        
        return generated
    
    def get_contraindications_for_state(self, state_id: str) -> List[Axiom]:
        """Get all contraindication axioms for a physiologic state."""
        return [
            a for a in self.axiom_registry.get_by_type(AxiomType.CONTRAINDICATION)
            if state_id in a.antecedent
        ]
    
    def get_exclusions_for_entity(self, entity_id: str) -> List[Axiom]:
        """Get all mutual exclusion axioms involving an entity."""
        return [
            a for a in self.axiom_registry.get_by_type(AxiomType.MUTUAL_EXCLUSION)
            if entity_id in a.antecedent or entity_id in a.consequent
        ]
    
    def get_dose_constraints_for_state(self, state_id: str) -> List[Axiom]:
        """Get all dose constraint axioms for a physiologic state."""
        return [
            a for a in self.axiom_registry.get_by_type(AxiomType.DOSE_CONSTRAINT)
            if state_id in a.antecedent
        ]
    
    def get_dose_constraints_for_substance(self, substance_id: str) -> List[Axiom]:
        """Get all dose constraint axioms for a substance."""
        return [
            a for a in self.axiom_registry.get_by_type(AxiomType.DOSE_CONSTRAINT)
            if substance_id in a.consequent
        ]
    
    def check_consistency(self, entity_ids: frozenset) -> List[str]:
        """
        Check if a set of entities is consistent with axioms.
        
        Note: DOSE_CONSTRAINT axioms are informational safety bounds, not logical
        constraints. They are excluded from consistency checking - dose limits
        are reported separately via get_dose_limits().
        
        Returns:
            List of violated axiom descriptions (empty if consistent)
        """
        violations = []
        
        for axiom in self.axiom_registry.iter_axioms():
            # skip dose constraints - they're informational, not logical requirements
            if axiom.axiom_type == AxiomType.DOSE_CONSTRAINT:
                continue
            
            # check if antecedent is satisfied
            if not axiom.antecedent.issubset(entity_ids):
                continue
            
            # antecedent satisfied, check consequent
            if axiom.negated:
                # consequent must NOT be present
                if axiom.consequent.intersection(entity_ids):
                    violations.append(
                        f"Axiom '{axiom.name}' violated: "
                        f"{sorted(axiom.consequent)} cannot coexist with {sorted(axiom.antecedent)}"
                    )
            else:
                # consequent MUST be present
                if not axiom.consequent.issubset(entity_ids):
                    missing = axiom.consequent - entity_ids
                    violations.append(
                        f"Axiom '{axiom.name}' violated: "
                        f"{sorted(missing)} required when {sorted(axiom.antecedent)} present"
                    )
        
        return violations
    
    def to_dict(self) -> dict:
        """Export axioms to dictionary."""
        return self.axiom_registry.to_dict()
