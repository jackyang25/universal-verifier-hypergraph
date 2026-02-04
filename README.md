# Clinical Safety Verification System - Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                 │
├─────────────────────────────────────────────────────────────────────┤
│  Dashboard UI (HTML/JS)          │  External API Clients            │
│  - Condition Selection            │  - Protocol Verifiers            │
│  - Safety Check Display           │  - Clinical Decision Support     │
│  - Graph Visualization            │  - EHR Integrations              │
└──────────────────┬──────────────────────────────────┬───────────────┘
                   │                                  │
                   ▼                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         API LAYER (FastAPI)                          │
├─────────────────────────────────────────────────────────────────────┤
│  /ontology/check    │  /ontology/status  │  /protocols/verify      │
│  - Safety checks    │  - Health status   │  - Protocol routing     │
│  - Contraindications│  - Metadata        │  - Hypergraph queries   │
│  - Dose restrictions│                    │                         │
│  - Drug interactions│                    │                         │
│  - Safe treatments  │                    │                         │
└──────────────────┬──────────────────────────────────┬───────────────┘
                   │                                  │
                   ▼                                  ▼
┌────────────────────────────────────┐  ┌────────────────────────────┐
│      ONTOLOGY BRIDGE               │  │   PROTOCOL ROUTER          │
│  (Clinical Knowledge Interface)    │  │   (Hypergraph Routing)     │
├────────────────────────────────────┤  ├────────────────────────────┤
│  • get_contraindicated_substances  │  │  • route_protocol()        │
│  • get_safe_treatments             │  │  • find_valid_paths()      │
│  • get_dose_limits                 │  │  • check_dependencies()    │
│  • get_drug_interactions           │  │                            │
│  • validate_conditions             │  │                            │
│  • check_consistency               │  │                            │
└──────────────────┬─────────────────┘  └────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    AXIOM LAYER (Formal Verification)                 │
├─────────────────────────────────────────────────────────────────────┤
│  CoreAxioms                                                          │
│  ├─ generate_from_relations()   ← Convert relations to axioms       │
│  ├─ check_consistency()         ← Validate patient state            │
│  └─ AxiomRegistry               ← Store & query axioms              │
│                                                                      │
│  Axiom Types (82 total):                                            │
│  • CONTRAINDICATION (28)        ← Absolute prohibitions             │
│  • DOSE_CONSTRAINT (77)         ← Categorical safety bounds         │
│  • MUTUAL_EXCLUSION (14)        ← Logical incompatibilities         │
│  • REQUIREMENT (10)             ← Dependencies                       │
└──────────────────┬──────────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    ONTOLOGY CORE (Domain Model)                      │
├─────────────────────────────────────────────────────────────────────┤
│  OntologySchema                                                      │
│  ├─ load_directory()            ← Load YAML data                    │
│  ├─ validate()                  ← Schema validation                 │
│  └─ Validation Checks:                                              │
│      • Entity reference validation                                  │
│      • Contraindication vs dose_restriction conflicts               │
│      • Self-referential relations                                   │
│      • Invalid enum values                                          │
│      • Circular parent hierarchies                                  │
│      • Type constraints                                             │
│                                                                      │
│  EntityRegistry                                                      │
│  ├─ register_entity()           ← Store entities                    │
│  ├─ register_relation()         ← Store relations                   │
│  ├─ get_entity()                ← Query by ID                       │
│  ├─ get_incoming_relations()    ← Query relations                   │
│  └─ get_interactions_for()      ← Drug-drug interactions            │
└──────────────────┬──────────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    DATA LAYER (YAML Ontology)                        │
├─────────────────────────────────────────────────────────────────────┤
│  ontology/data/                                                      │
│  ├── entities/              (82 total)                              │
│  │   ├── substances.yaml    ← 22 medications                        │
│  │   ├── disorders.yaml     ← 18 conditions                         │
│  │   ├── states.yaml        ← 20 physiologic states                 │
│  │   └── findings.yaml      ← 14 clinical findings                  │
│  │                                                                   │
│  ├── constraints/           (generates axioms)                       │
│  │   ├── contraindications.yaml    ← 28 absolute prohibitions       │
│  │   ├── dose_restrictions.yaml    ← 77 categorical safety bounds   │
│  │   ├── exclusions.yaml           ← 14 mutual exclusions           │
│  │   └── requirements.yaml         ← 10 dependencies                │
│  │                                                                   │
│  └── recommendations/       (informational only)                     │
│      ├── interactions.yaml   ← 23 drug-drug warnings                │
│      └── treatments.yaml     ← 20 therapy suggestions               │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow: Safety Check

```
1. User selects conditions
   ↓
2. Dashboard → POST /ontology/check
   {
     "conditions": ["pregnant", "diabetes_mellitus_type_2", "hiv_infection"]
   }
   ↓
3. API Router → OntologyBridge
   ↓
4. Bridge queries EntityRegistry
   ├─ Expand conditions with ancestors (pregnant → first_trimester)
   ├─ Get contraindicated substances
   ├─ Get safe treatments
   ├─ Get dose limits
   └─ Get drug interactions
   ↓
5. CoreAxioms.check_consistency()
   ├─ Check MUTUAL_EXCLUSION violations
   └─ Check REQUIREMENT violations
   ↓
6. API returns SafetyCheckResponse
   {
     "contraindicated_substances": [
       {"name": "Lisinopril", "reason": "Contraindicated in Pregnant"}
     ],
     "safe_treatments": [
       {"name": "Insulin", "indication": "Treats Diabetes"}
     ],
     "dose_limits": [
       {"name": "Metformin", "category": "use_with_caution", 
        "limits": [{"condition_name": "Pregnant"}]}
     ],
     "drug_interactions": [
       {"substance1_name": "Metformin", "substance2_name": "Insulin"}
     ],
     "consistency_violations": []
   }
   ↓
7. Dashboard renders safety assessment
```

## Axiom Generation Pipeline

```
YAML Relations → EntityRegistry → CoreAxioms → AxiomRegistry → Lean Export

constraints/contraindications.yaml
    └─> CONTRAINDICATED_IN relations
        └─> CONTRAINDICATION axioms
            ├─> check_consistency() (enforced)
            └─> export to Lean

constraints/dose_restrictions.yaml
    └─> REQUIRES_DOSE_ADJUSTMENT relations
        └─> DOSE_CONSTRAINT axioms
            ├─> check_consistency() (skipped)
            └─> export to Lean (for formal verification)

constraints/exclusions.yaml
    └─> EXCLUDES relations
        └─> MUTUAL_EXCLUSION axioms
            ├─> check_consistency() (enforced)
            └─> export to Lean

constraints/requirements.yaml
    └─> REQUIRES relations
        └─> REQUIREMENT axioms
            ├─> check_consistency() (enforced)
            └─> export to Lean
```

## Key Design Patterns

### 1. Separation of Concerns

```
constraints/     → Formal safety rules  → Generate axioms
recommendations/ → Clinical guidance    → Display only
```

### 2. Parent-Child Inheritance

```
pregnant (parent)
  ├─ first_trimester (child)   ← Inherits all parent rules
  ├─ second_trimester (child)  ← Inherits all parent rules
  └─ third_trimester (child)   ← Inherits all parent rules
```

### 3. Hybrid Axiom Model

```
CONTRAINDICATION  → Runtime blocking + Lean verification
DOSE_CONSTRAINT   → Display warnings + Lean verification (not blocking)
MUTUAL_EXCLUSION  → Runtime blocking + Lean verification
REQUIREMENT       → Runtime blocking + Lean verification
```

## Validation Layers

### Schema Load Time (Automatic)
- Entity references exist
- No self-referential relations
- No contraindication + dose_restriction conflicts
- Valid enum values (dose categories, strength)

### Schema.validate() (On Demand)
- Orphan entities
- Circular parent hierarchies
- Type constraints

### Runtime (Per Query)
- Consistency violations (mutual exclusions, requirements)
- Contraindication checks
- Dose restriction lookups

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML, JavaScript, CSS |
| API | FastAPI (Python) |
| Data | YAML (human-editable) |
| Validation | Pydantic, Custom validators |
| Formal Verification | Lean (export target) |
| Server | Uvicorn (ASGI) |

## Extension Points

1. **Add new entities**: Edit `ontology/data/entities/*.yaml`
2. **Add safety rules**: Edit `ontology/data/constraints/*.yaml`
3. **Add interactions**: Edit `ontology/data/recommendations/interactions.yaml`
4. **Custom axioms**: Extend `CoreAxioms.generate_from_relations()`
5. **New API endpoints**: Add to `api/routers/`
6. **Lean export**: Implement in `protocols/exporter.py`

## Deployment Architecture

```
┌─────────────────────────────────────────────────┐
│              Docker Container                    │
├─────────────────────────────────────────────────┤
│  Uvicorn (Port 8000)                            │
│  ├── FastAPI Application                        │
│  ├── Ontology Data (loaded at startup)         │
│  └── Dashboard Static Files                     │
└─────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────┐
│              Reverse Proxy (Optional)           │
│  Nginx / Traefik                                │
└─────────────────────────────────────────────────┘
```
