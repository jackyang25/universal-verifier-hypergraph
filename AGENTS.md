# AGENTS.md

Project context for AI coding assistants.

## Project Overview

**Clinical Safety Verification System** - A formally verified clinical safety framework using ontology and hypergraph-based protocol routing. Designed for Lean theorem proving integration.

### Core Purpose

This is a **safety layer** for clinical decision support:
- Defines what's safe vs not safe (contraindications, dose limits)
- Does NOT prescribe treatments, only verifies safety bounds
- Supports formal verification via Lean theorem prover

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Dashboard (UI)                        │
│                 dashboard/index.html                     │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                    FastAPI (api/)                        │
│   /ontology/check - safety verification                  │
│   /routing - protocol activation                         │
│   /graph - hypergraph export for visualization           │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│              Ontology Bridge (ontology/bridge.py)        │
│   - Connects ontology to protocol router                 │
│   - Validates conditions against axioms                  │
│   - Returns contraindications + dose limits              │
└────────────┬────────────────────────────┬───────────────┘
             │                            │
┌────────────▼────────────┐  ┌────────────▼───────────────┐
│   Ontology (ontology/)  │  │   Protocols (protocols/)   │
│   - Entities (YAML)     │  │   - Clinical protocols     │
│   - Relations (YAML)    │  │   - Hypergraph routing     │
│   - Axioms (generated)  │  │   - D3 export              │
└─────────────────────────┘  └────────────────────────────┘
```

## Key Directories

### `ontology/`
Formal clinical knowledge representation.

- **`types.py`** - Core types: `EntityType`, `RelationType`, `Entity`, `Relation`
- **`schema.py`** - Loads and validates YAML definitions
- **`registry.py`** - In-memory store for entities and relations
- **`bridge.py`** - API interface for safety queries
- **`axioms/`** - Formal axiom generation for Lean

### `ontology/data/`
YAML definitions (source of truth):

- **`entities/`** - Disorders, substances, states, findings
- **`constraints/`** - Safety constraints that generate axioms for formal verification
  - contraindications.yaml, dose_restrictions.yaml, exclusions.yaml, requirements.yaml
- **`recommendations/`** - Clinical guidance that doesn't generate axioms
  - interactions.yaml (monitoring warnings), treatments.yaml (therapy suggestions)

### `api/`
FastAPI REST endpoints.

- **`routers/ontology.py`** - `/ontology/check` safety verification
- **`routers/protocols.py`** - Protocol CRUD
- **`routers/routing.py`** - Patient condition routing

### `protocols/`
Hypergraph-based protocol routing.

- **`router.py`** - ProtocolRouter class
- **`exporter.py`** - D3.js visualization export

### `dashboard/`
Frontend UI for testing.

- Select patient conditions
- View contraindications, dose limits, safe treatments
- Visualize hypergraph

## Core Concepts

### Entity Types
```python
EntityType.DISORDER           # diseases (diabetes, hypertension)
EntityType.SUBSTANCE          # medications (metformin, lisinopril)
EntityType.PHYSIOLOGIC_STATE  # patient states (pregnant, geriatric)
EntityType.FINDING            # clinical findings (eGFR values)
```

### Relation Types
```python
RelationType.CONTRAINDICATED_IN      # absolute prohibition
RelationType.REQUIRES_DOSE_ADJUSTMENT # dose ceiling (safety bound)
RelationType.TREATS                   # therapeutic relationship
RelationType.EXCLUDES                 # mutual exclusion
```

### Axiom Types
```python
AxiomType.CONTRAINDICATION   # validated in consistency check
AxiomType.DOSE_CONSTRAINT    # informational, not validated
AxiomType.MUTUAL_EXCLUSION   # validated in consistency check
AxiomType.REQUIREMENT        # validated in consistency check
```

## Important Patterns

### Parent-Child Inheritance
Entities can have `parent_id` for hierarchy:
```yaml
- id: first_trimester
  parent_id: pregnant  # inherits contraindications from pregnant
```

The bridge expands conditions to include ancestors:
- Selecting `first_trimester` also checks rules for `pregnant`

### Contraindications vs Dose Limits
- **Contraindication**: Binary prohibition (don't use substance X in condition Y)
- **Dose Limit**: Safety bound (max safe dose of X when Y is present)

Spectrum example for renal impairment:
- Mild → dose limit (reduce dose)
- Moderate → tighter dose limit
- Severe → contraindication (don't use)

### Axiom Generation
Axioms are auto-generated from relations for Lean export:
```python
bridge.axioms.generate_from_relations()
export = bridge.axioms.to_dict()  # JSON for Lean
```

Dose constraints include `constraint_value` (mg) for formal proofs.

## Development Commands

```bash
make start   # Docker: run at localhost:8000
make stop    # Stop containers
make logs    # View logs
make test    # Run pytest
```

Local development:
```bash
PYTHONPATH=. python3 -m uvicorn api.main:app --reload
```

## Testing Patterns

Verify ontology loads:
```bash
PYTHONPATH=. python3 -c "
from pathlib import Path
from ontology.bridge import OntologyBridge
bridge = OntologyBridge.from_directory(Path('ontology/data'))
print(f'Entities: {len(list(bridge.registry.iter_entities()))}')
"
```

Test safety check:
```bash
PYTHONPATH=. python3 -c "
from pathlib import Path
from ontology.bridge import OntologyBridge
bridge = OntologyBridge.from_directory(Path('ontology/data'))
conditions = {'diabetes_mellitus_type_2', 'pregnant'}
contra = bridge.get_contraindicated_substances(conditions)
limits = bridge.get_dose_limits(conditions)
print('Contraindicated:', [s.name for s in contra])
print('Dose limits:', {k: v for k, v in limits.items()})
"
```

## Common Tasks

### Add New Entity
Edit `ontology/data/entities/<type>.yaml`:
```yaml
- id: new_condition
  name: New Condition
  description: Description here
  parent_id: optional_parent  # for hierarchy
```

### Add Contraindication
Edit `ontology/data/constraints/contraindications.yaml`:
```yaml
- source_id: substance_id
  target_id: condition_id
  strength: absolute|strong|moderate
  evidence: "Clinical reasoning"
```

### Add Dose Restriction
Edit `ontology/data/constraints/dose_restrictions.yaml`:
```yaml
- id: unique_id
  source_id: substance_id
  target_id: condition_id
  dose_category: reduced  # categorical safety level
  strength: strong
  evidence: "Safety reasoning"
```

**Dose Categories** (most to least restrictive):
- `avoid_if_possible` - use only if no alternatives
- `severely_restricted` - significant reduction required
- `reduced` - reduce from standard dose
- `use_with_caution` - monitor closely, may need adjustment
- `standard` - no adjustment needed

## Interoperability

### Lean Export
Axioms export with categorical data for formal verification:
```json
{
  "id": "dose_constraint_metformin_pregnant",
  "axiom_type": "dose_constraint",
  "antecedent": ["pregnant"],
  "consequent": ["metformin"],
  "dose_category": "use_with_caution",
  "evidence": "..."
}
```

Maps to Lean:
```lean
inductive DoseCategory
  | standard
  | use_with_caution
  | reduced
  | severely_restricted
  | avoid_if_possible

axiom dose_category_metformin_pregnant : 
  patient.has_condition pregnant → 
  safe_dose_category metformin = .use_with_caution
```

### SNOMED/ICD-10 Codes
Entities include standard codes for interoperability:
```yaml
codes:
  - system: SNOMED-CT
    code: "73211009"
  - system: ICD-10
    code: E11
```

## Constraints

- Do NOT add prescribing guidance (only safety bounds)
- Dose limits are informational, not logical constraints
- Always verify entity references exist before adding relations
- Parent-child hierarchies must not be circular
