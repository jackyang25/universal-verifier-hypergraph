# AGENTS.md

Project context for AI coding assistants.

## Project Overview

**Universal Protocol Hypergraph** - A protocol verification system that acts as the last safety layer in a clinical decision support pipeline. Retrieves formal safety axioms from a hypergraph ontology and verifies clinical actions via Lean 4 theorem proving.

**Role**: Blackbox verification module that receives conformal prediction sets + proposed actions, returns **verification certificates**.

### Purpose: Axiom-Based Verification → Certificate Generation

**Compile Time** (ontology load):
- YAML relations → Axiom generation → Pre-build Lean 4 proofs
- All proofs compiled and ready for runtime execution

**Runtime** (verification - 3 steps):

**Step 1: Axiom Retrieval**
- Query hypergraph for relevant pre-built axioms based on input
- Retrieve axioms for conditions in conformal set
- Retrieve axioms for patient context
- Retrieved axioms reference pre-built proofs

**Step 2: Proof Execution**
- Run pre-built Lean 4 proofs with patient state
- Execute axioms against proposed action
- Check disjunction proofs for conformal sets
- Proof execution returns: VERIFIED / BLOCKED / REPAIR_NEEDED

**Step 3: Certificate Generation**
- Generate certificate based on proof execution results
- Include violated/satisfied axioms with physiology-based rationale
- Query guideline graph for alternatives if blocked
- Add process trace showing axiom retrieval + proof execution

**Certificates enable**:

1. **Say VERIFIED/BLOCKED/REPAIR_NEEDED** - Clear verdict on proposed action
2. **Explain why violations occurred** - Physiology-based rationale (not "rule #42") + guideline citations
3. **Suggest alternatives when blocking** - Query guideline graph for valid repair options
4. **Provide dose warnings** - Informational (not blocking)
5. **Include audit trail** - Process trace for offline review and compliance evaluation

**Certificates enable**:
- **Immediate use**: System can auto-repair plan with alternatives
- **Offline review**: Clinicians and auditors understand what was checked and why
- **Formal verification**: Lean 4 theorem prover validates mathematical proofs
- **Compliance**: Full audit trail for regulatory/legal review

### Two Core Verification Patterns

Based on ACOG maternal care guidelines:
1. **Drug safety verification** - Catch contraindications (e.g., Asthma/Labetalol conflict)
2. **Delivery timing verification** - Verify "deliver vs. wait" decisions (e.g., HELLP/AFLP → Immediate Delivery)

## Module Purpose

This module is a **protocol retrieval and verification layer**.

### Three Core Inputs

**1. Conformal Prediction Set** (from upstream statistical layer)
- Multiple possible diagnoses with coverage guarantee
- Represents diagnostic uncertainty
- Examples:
  - `["hellp_syndrome", "aflp"]` - uncertain liver crisis
  - `["preeclampsia_severe", "gestational_htn"]` - uncertain HDP severity
  - `["eclampsia"]` - certain diagnosis (singleton set)

**2. Proposed Action/Plan** (from upstream LLM)
- LLM-generated clinical recommendation requiring verification
- Drug actions: `{type: "substance", id: "labetalol", dose: "20mg IV"}`
- Delivery actions: `{type: "action", id: "immediate_delivery"}`
- May include multiple steps (e.g., magnesium + delivery)

**3. Patient Context** (known facts, NOT uncertain)
- Comorbidities: `["asthma", "diabetes"]` - conditions with certainty
- Gestational age: `ga_weeks: 32` - exact timing
- Patient state: `"postpartum"`, `"breastfeeding"`
- (Future) Facility tier: `"community_health"`, `"hospital"` - resource constraints

### Verification Process (3 Steps at Runtime)

**Step 1: Axiom Retrieval**
- Query hypergraph for relevant pre-built axioms based on input
- Retrieve axioms for conditions in conformal set
- Retrieve axioms for patient context (comorbidities)
- Retrieve axioms for proposed action

**Step 2: Proof Execution** (proofs pre-built at compile time)
- Run pre-built Lean 4 proofs with patient state
- Disjunction proof: check action safe for ALL diagnoses in conformal set
- Contraindication check: check no violations in patient context
- Requirement check: check required actions satisfied

**Step 3: Certificate Generation**
- Generate certificate based on proof execution results
- Include violated axioms with physiology-based rationale
- Query guideline graph for alternatives if blocked
- Add process trace showing axiom retrieval + proof execution

### Output: Verification Certificate

A certificate containing:

1. **Verification Status**
   - `VERIFIED` - Action safe for all members of conformal set, no violations
   - `BLOCKED` - Hard constraint violation (contraindication, mutual exclusion, unsatisfied requirement)
   - `REPAIR_NEEDED` - Soft violation or missing required action

2. **Contraindications** (blocking)
   - Which substance/action violated which constraint
   - Strength (absolute, strong, moderate)
   - Rationale based on **physiology** (not "rule #42")
   - Guideline citation (ACOG 2019 Section 4.2.1, WHO 2023, etc.)

3. **Alternatives** (repair guidance)
   - Query guideline graph for valid alternatives
   - Suggest substances/actions without contraindications
   - Include dosing and guideline citations

4. **Dose Limits** (informational, NOT blocking)
   - Categorical warnings (use_with_caution, reduced, severely_restricted)
   - Displayed but not enforced as hard constraints

5. **Consistency Violations** (blocking)
   - Mutual exclusions in patient context
   - Missing requirements/dependencies

6. **Required Actions** (blocking if unsatisfied)
   - Red-flag scenarios requiring specific action classes
   - Shows if requirement satisfied and which action satisfies it

7. **Process Trace** (audit trail)
   - Steps taken during verification
   - Enables offline review and compliance evaluation

**Performance target**: < 2 seconds per verification cycle

**Design Principle**: Treats upstream AI as brilliant but fallible. This module never allows ACOG guideline violations through mathematical proof (not probability).

## Architecture

For detailed system design, data flow diagrams, and validation layers, see **ARCHITECTURE.md**.

### Key Components

```
┌─────────────────────────────────────────────────────────────┐
│ API Layer (api/)                                            │
│ /ontology/check - receives conformal set + action          │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ OntologyBridge (ontology/bridge.py)                         │
│ - Query interface for safety checks                         │
│ - Expands conformal set (parent inheritance)                │
│ - Returns violations + alternatives                         │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
┌────────▼────────┐            ┌─────────▼────────┐
│ EntityRegistry  │            │   CoreAxioms     │
│ (registry.py)   │            │ (axioms/)        │
│ - Entities      │            │ - Generate       │
│ - Relations     │            │ - Verify         │
│ - Query         │            │ - Export Lean    │
└────────┬────────┘            └─────────┬────────┘
         │                               │
         └───────────────┬───────────────┘
                         │
                ┌────────▼─────────┐
                │  YAML Ontology   │
                │ (ontology/data/) │
                │ - entities/      │
                │ - constraints/   │
                │ - recommendations/│
                └──────────────────┘
```

### Data Flow (3 Steps)

```
INPUT: conformal_set + proposed_action + patient_context
           ↓
STEP 1: AXIOM RETRIEVAL
  ├─ Bridge expands conformal set (parent inheritance)
  ├─ Registry queries relevant relations for conditions
  ├─ Registry queries relevant relations for comorbidities
  ├─ Registry queries relevant relations for proposed action
  └─ Retrieved axiom set: {axiom1, axiom2, ...}
           ↓
STEP 2: PROOF EXECUTION (proofs pre-built at compile time)
  ├─ Run pre-built proofs with patient state
  ├─ Execute contraindication proofs (blocking)
  ├─ Execute requirement proofs (blocking if unsatisfied)
  ├─ Execute dose restriction checks (informational)
  ├─ Run disjunction proofs for conformal sets
  └─ Proof execution result: VERIFIED | BLOCKED | REPAIR_NEEDED
           ↓
STEP 3: CERTIFICATE GENERATION
  ├─ Generate certificate with violated/satisfied axioms
  ├─ Add physiology-based rationale + guideline citations
  ├─ Query guideline graph for alternatives (if blocked)
  ├─ Add process trace (axiom retrieval + proof steps)
  └─ Export Lean 4 proof artifacts
           ↓
OUTPUT: Verification Certificate (7 components)
```

## Key Directories

### `ontology/`
Protocol hypergraph core.

- **`types.py`** - Core types: `EntityType`, `RelationType`, `Entity`, `Relation`
- **`schema.py`** - Loads and validates YAML definitions
- **`registry.py`** - In-memory hypergraph store for entities and relations
- **`bridge.py`** - Query interface for safety checks
- **`axioms/`** - Formal axiom generation for Lean export

### `ontology/data/`
YAML ontology (source of truth):

- **`entities/`** - Current scope: HDP syndrome pack (37 entities total)
  - `disorders.yaml` - Maternal conditions (preeclampsia, HELLP, AFLP, eclampsia, asthma) - 11 entities
  - `substances.yaml` - Antihypertensives (labetalol, hydralazine, nifedipine, magnesium sulfate) - 6 entities
  - `states.yaml` - Pregnancy states and gestational age categories - 8 entities
  - `findings.yaml` - Clinical findings (severe HTN, proteinuria, thrombocytopenia) - 8 entities
  - `actions.yaml` - Clinical actions (immediate_delivery, expectant_management) - 4 entities
- **`constraints/`** - Safety constraints that generate axioms for formal verification
  - `contraindications.yaml` - Drug-condition prohibitions (e.g., labetalol → asthma)
  - `dose_restrictions.yaml` - Categorical safety bounds (e.g., magnesium in renal impairment)
  - `exclusions.yaml` - Mutual exclusions (e.g., gestational HTN vs preeclampsia)
  - `requirements.yaml` - Required actions (e.g., HELLP → immediate_delivery)
- **`recommendations/`** - Clinical guidance (does NOT generate axioms)
  - `interactions.yaml` - Drug-drug interaction warnings (e.g., magnesium + nifedipine)
  - `treatments.yaml` - Therapy suggestions (e.g., labetalol treats severe HTN)

### `api/`
FastAPI REST endpoints.

- **`routers/ontology.py`** - `/ontology/check` safety verification
- **`routers/protocols.py`** - Protocol CRUD
- **`routers/routing.py`** - Patient condition routing

### `protocols/`
Hypergraph routing and export.

- **`router.py`** - ProtocolRouter class
- **`exporter.py`** - D3.js visualization export

## Core Concepts

### Entity Types
```python
EntityType.DISORDER           # maternal conditions (preeclampsia, HELLP, AFLP, asthma)
EntityType.SUBSTANCE          # antihypertensive drugs (labetalol, nifedipine, hydralazine)
EntityType.PHYSIOLOGIC_STATE  # pregnancy states (pregnant, term, ga_34_weeks, postpartum)
EntityType.FINDING            # clinical findings (severe HTN, proteinuria, thrombocytopenia)
EntityType.ACTION             # clinical actions (immediate_delivery, expectant_management)
```

### Relation Types (Constraints - Generate Axioms)
```python
RelationType.CONTRAINDICATED_IN      # drug-condition prohibition
RelationType.REQUIRES_DOSE_ADJUSTMENT # categorical safety bound
RelationType.EXCLUDES                # mutual exclusion
RelationType.REQUIRES                # required action/dependency
```

### Relation Types (Recommendations - Informational)
```python
RelationType.TREATS          # treatment suggestion
RelationType.INTERACTS_WITH  # drug-drug interaction warning
```

### Axiom Types
```python
AxiomType.CONTRAINDICATION   # drug safety (e.g., labetalol → asthma = BLOCKED)
AxiomType.DOSE_CONSTRAINT    # categorical dosing (e.g., magnesium dose reduced in renal impairment)
AxiomType.MUTUAL_EXCLUSION   # logical exclusions (e.g., gestational HTN excludes preeclampsia)
AxiomType.REQUIREMENT        # delivery timing (e.g., HELLP → immediate_delivery = REQUIRED)
```

## Important Patterns

### Parent-Child Inheritance
Entities can have `parent_id` for hierarchy:
```yaml
- id: hellp_syndrome
  parent_id: preeclampsia_severe  # inherits rules from severe preeclampsia
```

The bridge expands conditions to include ancestors:
- Selecting `hellp_syndrome` also checks rules for `preeclampsia_severe` and `preeclampsia`

### Constraint Types (Hard vs Soft)

**Hard Constraints** (blocking, enforced via Lean 4 proofs):
- **Contraindications**: Drug-condition prohibitions
  - Example: `labetalol contraindicated_in asthma` (beta-blocker bronchospasm risk)
  - Certificate: `BLOCKED` with alternatives
- **Requirements**: Required actions for life-threatening conditions
  - Example: `hellp_syndrome requires immediate_delivery` (ACOG guideline)
  - Certificate: `REPAIR_NEEDED` if unsatisfied
- **Mutual Exclusions**: Logically incompatible diagnoses
  - Example: `gestational_htn excludes preeclampsia` (mutually exclusive)
  - Certificate: `BLOCKED` with consistency violation

**Soft Constraints** (informational, NOT blocking):
- **Dose Limits**: Categorical safety warnings
  - Example: `magnesium_sulfate requires_dose_adjustment elevated_creatinine (reduced)`
  - Certificate: Listed in `dose_limits` field, displayed but not enforced
- **Interactions**: Drug-drug monitoring warnings
  - Example: `magnesium_sulfate interacts_with nifedipine` (hypotension risk)
  - Certificate: Listed but not blocking
- **Treatments**: Therapy suggestions
  - Example: `labetalol treats severe_hypertension`
  - Certificate: Used to query alternatives, not enforced

### Action Invariance (Disjunction Proofs)

System verifies action is safe across **entire conformal set**:

**Example 1: Delivery Timing Verification**
```
Conformal set: {HELLP, AFLP}
Proposed action: Immediate Delivery

Lean 4 verifies:
  Axiom_HELLP: has_condition HELLP → requires immediate_delivery
  Axiom_AFLP: has_condition AFLP → requires immediate_delivery
  ∴ (HELLP ∨ AFLP) → immediate_delivery is VERIFIED ✓
```

**Example 2: Drug Safety Verification**
```
Patient conditions: {Asthma}
Proposed action: Labetalol (antihypertensive)

Lean 4 verifies:
  Axiom_Asthma_Labetalol: has_condition Asthma → ¬ safe_action (administer labetalol)
  ∴ Labetalol is BLOCKED (beta-blocker bronchospasm risk) ✗
  
Certificate suggests alternatives: hydralazine, nifedipine
```

If action is NOT safe for all members of conformal set, verification fails.

### Axiom Generation and Proof Pre-building (Compile Time)

At ontology load time, axioms are generated and proofs pre-built:
```python
# Compile time (ontology load)
bridge.axioms.generate_from_relations()  # Generate axioms from YAML
bridge.axioms.prebuild_proofs()          # Pre-build Lean 4 proofs
export = bridge.axioms.to_dict()         # Export for Lean validator

# Runtime (verification)
relevant_axioms = bridge.axioms.query(patient_state, action)  # Axiom retrieval
results = bridge.axioms.execute(relevant_axioms)              # Proof execution
certificate = generate_certificate(results)                   # Certificate generation
```

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

### Verify ontology loads
```bash
PYTHONPATH=. python3 -c "
from pathlib import Path
from ontology.bridge import OntologyBridge
bridge = OntologyBridge.from_directory(Path('ontology/data'))
print(f'Entities: {len(list(bridge.registry.iter_entities()))}')
"
```

### Test drug safety check
```bash
PYTHONPATH=. python3 -c "
from pathlib import Path
from ontology.bridge import OntologyBridge
bridge = OntologyBridge.from_directory(Path('ontology/data'))

# Patient with asthma, proposed drug: labetalol
conditions = {'asthma'}
contra = bridge.get_contraindicated_substances(conditions)
print('Contraindicated drugs:', [s.name for s in contra])
# Expected: ['Labetalol'] (beta-blocker contraindicated in asthma)
"
```

### Test delivery timing verification for conformal set
```bash
PYTHONPATH=. python3 -c "
from pathlib import Path
from ontology.bridge import OntologyBridge
bridge = OntologyBridge.from_directory(Path('ontology/data'))

# Conformal set: uncertain between HELLP and AFLP
conformal_set = {'hellp_syndrome', 'aflp'}
proposed_action = 'immediate_delivery'

# Check if action is required for ALL conditions in set
required_for_all = True
for condition in conformal_set:
    # Query required actions for this condition
    relations = bridge.registry.get_outgoing_relations(condition)
    requires = [r.target_id for r in relations if r.relation_type.value == 'requires']
    if proposed_action not in requires:
        required_for_all = False
        break

print(f'Immediate delivery required for all conditions: {required_for_all}')
# Expected: True (both HELLP and AFLP require immediate delivery per ACOG)
"
```

## Common Tasks

### Add New Maternal Condition
Edit `ontology/data/entities/disorders.yaml`:
```yaml
- id: gestational_htn
  name: Gestational Hypertension
  description: New-onset hypertension after 20 weeks without proteinuria
  codes:
    - system: ICD-10
      code: O13
```

### Add Drug Contraindication
Edit `ontology/data/constraints/contraindications.yaml`:
```yaml
- source_id: labetalol
  target_id: asthma
  strength: absolute
  evidence: "Beta-blockers cause bronchospasm; contraindicated in asthma per ACOG"
```

### Add Delivery Requirement
Edit `ontology/data/constraints/requirements.yaml`:
```yaml
- source_id: hellp_syndrome
  target_id: immediate_delivery
  strength: absolute
  evidence: "ACOG 2020: HELLP syndrome requires prompt delivery regardless of gestational age"
```

### Add Clinical Action
Edit `ontology/data/entities/actions.yaml`:
```yaml
- id: immediate_delivery
  name: Immediate Delivery
  description: Delivery within 24-48 hours (emergent/urgent)
```

### Expand to New Syndrome Pack

To add a new syndrome pack (e.g., Obstetric Hemorrhage):

1. **Add disorders** to `entities/disorders.yaml`:
```yaml
- id: postpartum_hemorrhage
  name: Postpartum Hemorrhage
  description: Blood loss >500mL after vaginal delivery or >1000mL after cesarean
  codes:
    - system: ICD-10
      code: O72.1
```

2. **Add substances** to `entities/substances.yaml`:
```yaml
- id: oxytocin
  name: Oxytocin
  description: Uterotonic for hemorrhage prevention/treatment
  codes:
    - system: RxNorm
      code: "7034"
```

3. **Add findings** to `entities/findings.yaml`:
```yaml
- id: severe_bleeding
  name: Severe Active Bleeding
  description: Heavy, persistent vaginal bleeding with hemodynamic instability
```

4. **Add constraints** to `constraints/requirements.yaml`:
```yaml
- source_id: postpartum_hemorrhage
  target_id: oxytocin
  strength: absolute
  evidence: "WHO 2018: Oxytocin first-line for PPH treatment"
```

5. **Add LMIC alternatives** (facility-tier aware):
```yaml
- source_id: postpartum_hemorrhage
  target_id: oxytocin
  strength: absolute
  alternative_if_unavailable:
    - substance_id: misoprostol
      route: sublingual
      dose: 800mcg
  facility_tier: [community_health, health_center]
  evidence: "Misoprostol acceptable when oxytocin unavailable in LMIC"
```

## Verification Examples

### Example 1: Drug Safety Verification (Asthma/Labetalol Conflict)

**Scenario**: Patient with severe preeclampsia and asthma. LLM proposes labetalol.

**Input**:
- **Conformal set**: `["preeclampsia_severe"]` (certain diagnosis)
- **Proposed action**: Labetalol 20mg IV (first-line antihypertensive)
- **Patient context**: `comorbidities: ["asthma"]`, `ga_weeks: 32`

**Verification Process**:

**Step 1: Axiom Retrieval**
1. Expand conformal set with parent hierarchy: preeclampsia_severe → preeclampsia
2. Retrieve axioms for patient comorbidities: asthma
3. Retrieve axioms for proposed action: labetalol
4. Retrieved axiom: `contraindication_labetalol_asthma`
   ```
   ∀ (p : Patient), p.has_condition Asthma → 
   ¬ safe_action p (administer labetalol)
   ```

**Step 2: Proof Execution** (proof pre-built at compile time)
5. Run pre-built proof with patient state: patient.has_asthma → TRUE
6. Execute axiom: labetalol is NOT safe_action
7. Proof execution result: BLOCKED

**Step 3: Certificate Generation**
8. Generate certificate with violated axiom
9. Query guideline graph for alternatives: substances treating severe_hypertension without asthma contraindication
10. Found alternatives: hydralazine, nifedipine
11. Add physiology-based rationale and guideline citations

**Output Certificate**:
```json
{
  "verification_status": "BLOCKED",
  "contraindications": [
    {
      "substance": "labetalol",
      "condition": "asthma",
      "strength": "absolute",
      "rationale": "Beta-blockers cause bronchospasm via β2-receptor blockade in bronchial smooth muscle",
      "guideline": "ACOG Practice Bulletin 222 (2020), Section 4.2"
    }
  ],
  "alternatives": [
    {
      "substance": "hydralazine",
      "dose": "5-10mg IV bolus, repeat q20min PRN (max 30mg)",
      "rationale": "Direct vasodilator, no bronchial effects",
      "guideline": "ACOG Practice Bulletin 222 (2020), Section 4.2.1"
    },
    {
      "substance": "nifedipine",
      "dose": "10mg PO immediate release, repeat q20min PRN (max 50mg)",
      "rationale": "Calcium channel blocker, safe in asthma",
      "guideline": "ACOG Practice Bulletin 222 (2020), Section 4.2.1"
    }
  ],
  "dose_limits": [],
  "consistency_violations": [],
  "process_trace": [
    "Expanded conformal set: preeclampsia_severe → preeclampsia",
    "Checked contraindications: labetalol vs {asthma}",
    "Violation found: labetalol contraindicated_in asthma (strength: absolute)",
    "Queried alternatives: substances treating severe_hypertension without contraindications",
    "Found 2 alternatives: hydralazine, nifedipine"
  ],
  "lean_proof_id": "axiom_contraindication_labetalol_asthma"
}
```

### Example 2: Delivery Timing Verification (HELLP/AFLP Conformal Set)

**Scenario**: Uncertain diagnosis between HELLP and AFLP. LLM proposes immediate delivery.

**Input**:
- **Conformal set**: `["hellp_syndrome", "aflp"]` (95% coverage, uncertain which)
- **Proposed action**: Immediate delivery
- **Patient context**: `ga_weeks: 32`, `platelet_count: 78000`

**Verification Process**:

**Step 1: Axiom Retrieval**
1. Expand conformal set: hellp_syndrome → preeclampsia_severe → preeclampsia
2. Retrieve requirement axioms for each condition:
   - Axiom: `requirement_hellp_immediate_delivery`
     ```
     ∀ (p : Patient), p.has_condition HELLP → 
     required_action p immediate_delivery
     ```
   - Axiom: `requirement_aflp_immediate_delivery`
     ```
     ∀ (p : Patient), p.has_condition AFLP → 
     required_action p immediate_delivery
     ```

**Step 2: Proof Execution** (disjunction proof pre-built at compile time)
3. Run HELLP requirement proof: immediate_delivery REQUIRED ✓
4. Run AFLP requirement proof: immediate_delivery REQUIRED ✓
5. Execute disjunction proof: `(HELLP ∨ AFLP) → immediate_delivery`
6. Proof execution result: VERIFIED (action required for ALL conditions in conformal set)

**Step 3: Certificate Generation**
7. Generate certificate with satisfied requirements
8. Include physiology-based rationale for each condition
9. Add guideline citations (ACOG 2020, Section 5.3)
10. Add process trace showing axiom retrieval and proof steps

**Output Certificate**:
```json
{
  "verification_status": "VERIFIED",
  "contraindications": [],
  "required_actions": [
    {
      "action": "immediate_delivery",
      "condition": "hellp_syndrome",
      "satisfied": true,
      "rationale": "HELLP syndrome causes severe maternal hepatic dysfunction with hemolysis and thrombocytopenia, requiring prompt delivery to prevent liver rupture and maternal death",
      "guideline": "ACOG Practice Bulletin 222 (2020), Section 5.3"
    },
    {
      "action": "immediate_delivery",
      "condition": "aflp",
      "satisfied": true,
      "rationale": "Acute fatty liver of pregnancy causes hepatic failure with coagulopathy and encephalopathy, requiring immediate delivery as definitive treatment",
      "guideline": "ACOG/SMFM Clinical Guidance (2019)"
    }
  ],
  "alternatives": [],
  "dose_limits": [],
  "consistency_violations": [],
  "process_trace": [
    "Expanded conformal set: hellp_syndrome → preeclampsia_severe → preeclampsia",
    "Expanded conformal set: aflp (no parent)",
    "Checked requirements for hellp_syndrome: immediate_delivery REQUIRED",
    "Checked requirements for aflp: immediate_delivery REQUIRED",
    "Disjunction proof satisfied: ALL conditions require same action",
    "Verification: VERIFIED"
  ],
  "lean_proof_id": "disjunction_proof_hellp_aflp_immediate_delivery"
}
```

### Example 3: Failed Verification (Action Not Required for All Conditions)

**Scenario**: Uncertain diagnosis between severe preeclampsia and gestational HTN. LLM proposes expectant management.

**Input**:
- **Conformal set**: `["preeclampsia_severe", "gestational_htn"]`
- **Proposed action**: Expectant management (continue pregnancy with monitoring)
- **Patient context**: `ga_weeks: 35`

**Verification Process**:
1. Check severe preeclampsia at ≥34 weeks: immediate_delivery REQUIRED
2. Check gestational HTN at 35 weeks: expectant_management allowed
3. Conflict detected: proposed action satisfies gestational_htn but violates preeclampsia_severe requirement
4. Disjunction proof fails: action NOT safe for all members of conformal set

**Output Certificate**:
```json
{
  "verification_status": "REPAIR_NEEDED",
  "contraindications": [],
  "required_actions": [
    {
      "action": "immediate_delivery",
      "condition": "preeclampsia_severe",
      "satisfied": false,
      "rationale": "Severe preeclampsia at ≥34 weeks risks eclampsia, placental abruption, and maternal organ damage; delivery is definitive treatment",
      "guideline": "ACOG Practice Bulletin 222 (2020), Section 5.2"
    }
  ],
  "alternatives": [
    {
      "action": "immediate_delivery",
      "rationale": "Required for preeclampsia_severe, acceptable for gestational_htn at 35 weeks (term approaching)",
      "guideline": "ACOG Practice Bulletin 222 (2020)"
    }
  ],
  "consistency_violations": [
    {
      "type": "requirement_not_satisfied",
      "condition": "preeclampsia_severe",
      "required_action": "immediate_delivery",
      "proposed_action": "expectant_management",
      "explanation": "Disjunction proof failed: action must be safe for ALL members of conformal set"
    }
  ],
  "dose_limits": [],
  "process_trace": [
    "Expanded conformal set: preeclampsia_severe → preeclampsia",
    "Checked requirements for preeclampsia_severe at GA 35 weeks: immediate_delivery REQUIRED",
    "Checked requirements for gestational_htn at GA 35 weeks: no absolute requirement",
    "Proposed action 'expectant_management' does NOT satisfy requirement for preeclampsia_severe",
    "Disjunction proof FAILED: action not safe for all conditions",
    "Verification: REPAIR_NEEDED"
  ],
  "lean_proof_id": null
}
```

## Interoperability

### API Input Format

**Example 1: Drug Safety Verification**
```json
{
  "conformal_set": ["preeclampsia_severe"],
  "proposed_action": {
    "type": "substance",
    "id": "labetalol",
    "dose": "20mg IV bolus"
  },
  "patient_context": {
    "comorbidities": ["asthma"],
    "ga_weeks": 32
  }
}
```

**Example 2: Delivery Timing Verification**
```json
{
  "conformal_set": ["hellp_syndrome", "aflp"],
  "proposed_action": {
    "type": "action",
    "id": "immediate_delivery"
  },
  "patient_context": {
    "ga_weeks": 32,
    "platelet_count": 78000
  }
}
```

### API Output Format (Certificate Structure)

All certificates contain these 7 components:

```json
{
  "verification_status": "VERIFIED | BLOCKED | REPAIR_NEEDED",
  "contraindications": [...],
  "alternatives": [...],
  "dose_limits": [...],
  "consistency_violations": [...],
  "required_actions": [...],
  "process_trace": [...],
  "lean_proof_id": "string or null"
}
```

**Example 1: BLOCKED (Drug Contraindication)**
```json
{
  "verification_status": "BLOCKED",
  "contraindications": [
    {
      "substance": "labetalol",
      "condition": "asthma",
      "strength": "absolute",
      "rationale": "Beta-blockers cause bronchospasm via β2-receptor blockade in bronchial smooth muscle",
      "guideline": "ACOG Practice Bulletin 222 (2020), Section 4.2"
    }
  ],
  "alternatives": [
    {
      "substance": "hydralazine",
      "dose": "5-10mg IV bolus, repeat q20min PRN (max 30mg)",
      "rationale": "Direct vasodilator, no bronchial effects",
      "guideline": "ACOG Practice Bulletin 222 (2020), Section 4.2.1"
    },
    {
      "substance": "nifedipine",
      "dose": "10mg PO immediate release, repeat q20min PRN (max 50mg)",
      "rationale": "Calcium channel blocker, safe in asthma",
      "guideline": "ACOG Practice Bulletin 222 (2020), Section 4.2.1"
    }
  ],
  "dose_limits": [],
  "consistency_violations": [],
  "required_actions": [],
  "process_trace": [
    "Expanded conformal set: preeclampsia_severe → preeclampsia",
    "Checked contraindications: labetalol vs {asthma}",
    "Violation found: labetalol contraindicated_in asthma (strength: absolute)",
    "Queried alternatives: substances treating severe_hypertension",
    "Found 2 alternatives: hydralazine, nifedipine"
  ],
  "lean_proof_id": "axiom_contraindication_labetalol_asthma"
}
```

**Example 2: VERIFIED (Delivery Required for All Conditions)**
```json
{
  "verification_status": "VERIFIED",
  "contraindications": [],
  "alternatives": [],
  "dose_limits": [],
  "consistency_violations": [],
  "required_actions": [
    {
      "action": "immediate_delivery",
      "condition": "hellp_syndrome",
      "satisfied": true,
      "rationale": "HELLP syndrome causes severe maternal hepatic dysfunction with hemolysis and thrombocytopenia, requiring prompt delivery to prevent liver rupture",
      "guideline": "ACOG Practice Bulletin 222 (2020), Section 5.3"
    },
    {
      "action": "immediate_delivery",
      "condition": "aflp",
      "satisfied": true,
      "rationale": "Acute fatty liver causes hepatic failure requiring immediate delivery as definitive treatment",
      "guideline": "ACOG/SMFM Clinical Guidance (2019)"
    }
  ],
  "process_trace": [
    "Expanded conformal set: hellp_syndrome → preeclampsia_severe",
    "Checked requirements for hellp_syndrome: immediate_delivery REQUIRED",
    "Checked requirements for aflp: immediate_delivery REQUIRED",
    "Disjunction proof satisfied: ALL conditions require same action"
  ],
  "lean_proof_id": "disjunction_proof_hellp_aflp_immediate_delivery"
}
```

**Example 3: REPAIR_NEEDED (Requirement Unsatisfied)**
```json
{
  "verification_status": "REPAIR_NEEDED",
  "contraindications": [],
  "alternatives": [
    {
      "action": "immediate_delivery",
      "rationale": "Required for preeclampsia_severe, acceptable for gestational_htn at 35 weeks",
      "guideline": "ACOG Practice Bulletin 222 (2020)"
    }
  ],
  "dose_limits": [],
  "consistency_violations": [
    {
      "type": "requirement_not_satisfied",
      "condition": "preeclampsia_severe",
      "required_action": "immediate_delivery",
      "proposed_action": "expectant_management",
      "explanation": "Disjunction proof failed: action must be safe for ALL members of conformal set"
    }
  ],
  "required_actions": [
    {
      "action": "immediate_delivery",
      "condition": "preeclampsia_severe",
      "satisfied": false,
      "rationale": "Severe preeclampsia at ≥34 weeks risks eclampsia and organ damage; delivery is definitive treatment",
      "guideline": "ACOG Practice Bulletin 222 (2020), Section 5.2"
    }
  ],
  "process_trace": [
    "Checked requirements for preeclampsia_severe at GA 35w: immediate_delivery REQUIRED",
    "Checked requirements for gestational_htn at GA 35w: no requirement",
    "Proposed 'expectant_management' does NOT satisfy requirement",
    "Disjunction proof FAILED"
  ],
  "lean_proof_id": null
}
```

### Lean 4 Export

**Contraindication Axiom**
```json
{
  "id": "contraindication_labetalol_asthma",
  "axiom_type": "contraindication",
  "antecedent": ["asthma"],
  "consequent": ["labetalol"],
  "strength": "absolute",
  "evidence": "Beta-blockers cause bronchospasm; contraindicated in asthma per ACOG"
}
```

Maps to Lean 4:
```lean
axiom contraindication_labetalol_asthma : 
  ∀ (p : Patient), p.has_condition Asthma → 
  ¬ safe_action p (administer labetalol)
```

**Requirement Axiom**
```json
{
  "id": "requirement_hellp_immediate_delivery",
  "axiom_type": "requirement",
  "antecedent": ["hellp_syndrome"],
  "consequent": ["immediate_delivery"],
  "strength": "absolute",
  "evidence": "ACOG 2020: HELLP syndrome requires prompt delivery"
}
```

Maps to Lean 4:
```lean
axiom requirement_hellp_immediate_delivery :
  ∀ (p : Patient), p.has_condition HELLP →
  required_action p immediate_delivery
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

## Performance Requirements

**Target**: < 2 seconds per verification cycle

**Optimization strategies**:
- **Pre-built proofs at compile time** (no proof construction at runtime)
- In-memory axiom lookup via indexed registry
- Fast proof execution (proofs already compiled)
- Early exit on first hard violation (fail-fast)
- Batch execution of multiple proofs
- Parallel proof execution where possible

## Constraints

### System Design Constraints
- This module verifies actions, it does NOT generate or propose them
- Do NOT add probabilistic inference, belief updates, or decision logic
- Do NOT add prescribing guidance or treatment selection logic
- Focus is safety verification: block violations, suggest alternatives

### Data Integrity Constraints
- Always verify entity references exist before adding relations
- Parent-child hierarchies must not be circular
- All constraints must cite ACOG guideline evidence

### Verification Constraints
- **Contraindications** (blocking): Drug-condition prohibitions verified via Lean 4 proofs
- **Requirements** (enforced): Required actions for life-threatening conditions
- Disjunction proofs must verify safety across ALL items in conformal set
- Zero tolerance for guideline violations (mathematical proof, not probability)

### Explicability Constraints
- **Rationales must be physiology-based**, not "rule #42"
  - Good: "Beta-blockers cause bronchospasm via β2-receptor blockade in bronchial smooth muscle"
  - Bad: "Contraindication rule violated"
- **Guideline citations must include section numbers**
  - Format: "ACOG Practice Bulletin 222 (2020), Section 4.2.1"
  - WHO, SMFM, and other authoritative sources
- **Process trace must enable audit**
  - Every verification step logged
  - Offline review possible for compliance evaluation
- **Alternatives must include repair guidance**
  - Dosing: "5-10mg IV bolus, repeat q20min PRN (max 30mg)"
  - Rationale: "Direct vasodilator, no bronchial effects"
  - Guideline: Full citation with section

## Clinical Focus

**Primary domain**: Maternal care safety verification (ACOG/WHO guidelines)

### Current Implementation (Proof-of-Concept)

**Scope**: Hypertensive Disorders of Pregnancy (HDP) - 1 of 10 syndrome packs

**Two core verification patterns demonstrated**:

1. **Drug Safety Verification**
   - Antihypertensive contraindications for maternal comorbidities
   - Example: Labetalol blocked in asthma (beta-blocker bronchospasm risk)
   - Alternatives suggested: hydralazine, nifedipine

2. **Delivery Timing Verification**
   - "Deliver vs. wait" decisions for hypertensive disorders
   - Example: HELLP/AFLP/Eclampsia → Immediate delivery required
   - Verification across conformal prediction sets (disjunction proofs)

**Current ontology**: 37 entities (11 disorders, 6 substances, 8 states, 8 findings, 4 actions)

**Key guideline source**: ACOG Practice Bulletins for Hypertension in Pregnancy (2019, 2020)

### Full Vision: 10 Maternal Care Syndrome Packs

1. **Hypertensive disorders of pregnancy (HDP)** ✓ *Current implementation*
2. Obstetric hemorrhage (antepartum + postpartum)
3. Maternal sepsis / severe infection
4. Obstructed / prolonged labor; uterine rupture risk
5. Preterm labor / threatened preterm birth
6. PROM/PPROM
7. Early pregnancy bleeding & pain (ectopic vs miscarriage)
8. Severe anemia (pregnancy/postpartum)
9. VTE / suspected PE-DVT (pregnancy/postpartum)
10. Fetal well-being risk syndromes

**LMIC Features** (planned):
- Facility-tier aware constraints (community health, health center, hospital)
- Resource-based alternatives (e.g., oxytocin vs misoprostol)
- Red-flag emergency bundles for life-threatening presentations

**Extensibility path**: Primary care syndrome packs beyond maternal health

## Upstream Context (Blackbox Interface)

This module is the **last safety layer** in a maternal care decision support pipeline.

### Pipeline Context

**What happens upstream** (not in this codebase):
1. **Reasoning Engine**: Clinical AI generates differential diagnoses via causal reasoning
2. **Statistical Harness**: Produces conformal prediction set (e.g., {HELLP, AFLP} with 95% coverage)
3. **Decision Layer**: LLM proposes action (antihypertensive drug or delivery timing)

**This module's job**:

**Compile Time** (ontology load):
- Generate axioms from YAML relations
- Pre-build all Lean 4 proofs
- Store in AxiomRegistry for fast runtime execution

**Runtime** (verification - 3 steps):
1. **Axiom Retrieval**: Query hypergraph for relevant pre-built axioms based on input
2. **Proof Execution**: Run pre-built Lean 4 proofs to get categorization (VERIFIED/BLOCKED/REPAIR_NEEDED)
3. **Certificate Generation**: Return verification certificate with 7 components based on proof execution results

**What happens downstream**:
- **Lean 4 Theorem Prover**: Validates mathematical proofs in certificate
- **System**: Uses alternatives for auto-repair if BLOCKED
- **Clinician**: Reviews certificate with transparent ACOG-based reasoning and audit trail

### Critical Output Boundaries

**This module outputs in certificates**:
- ✓ Verification status (VERIFIED/BLOCKED/REPAIR_NEEDED)
- ✓ Contraindication violations with physiology-based rationale
- ✓ Alternative suggestions with dosing and guideline citations
- ✓ Dose warnings (informational)
- ✓ Consistency violations and unsatisfied requirements
- ✓ Process trace for audit trail
- ✓ Lean 4 proof identifiers

**This module does NOT output**:
- ❌ Probabilities or confidence scores (that's Statistical Harness)
- ❌ Diagnostic reasoning or differential (that's Reasoning Engine)
- ❌ Treatment recommendations beyond safety bounds (that's Decision Layer)
- ❌ Clinical decisions about what to do (only verification)

**Key principle**: This module treats upstream AI as "brilliant but fallible" and never allows ACOG guideline violations through mathematical proof (not probability).

## Quick Reference

### Certificate-Centric Purpose

This module's **sole output** is a verification certificate containing:

1. **Status**: VERIFIED | BLOCKED | REPAIR_NEEDED
2. **Contraindications**: Which constraints violated, why (physiology-based), guideline citation
3. **Alternatives**: Valid repair options with dosing and guidelines
4. **Dose Limits**: Informational warnings (not blocking)
5. **Consistency Violations**: Mutual exclusions, missing requirements
6. **Required Actions**: Red-flag scenarios and satisfaction status
7. **Process Trace**: Audit trail for offline review

### What This Module Does (3-Step Process)

**Step 1: Axiom Retrieval**
- Query hypergraph for relevant pre-built axioms based on input
- Retrieve contraindication axioms, requirement axioms, dose restriction axioms
- Retrieved axioms reference pre-built Lean 4 proofs (compiled at ontology load time)

**Step 2: Proof Execution** (proofs pre-built at compile time)
- Run pre-built Lean 4 proofs with patient state and proposed action
- Execute proofs:
  - **Drug safety**: Run contraindication proof (Asthma/Labetalol)
  - **Delivery timing**: Run requirement proof (HELLP/AFLP → delivery)
  - **Disjunction proofs**: Check action safe for ALL members of conformal set
- Proof execution result: VERIFIED / BLOCKED / REPAIR_NEEDED

**Step 3: Certificate Generation**
- Generate certificate based on proof execution results
- Include violated/satisfied axioms with physiology-based rationale (NOT "rule #42")
- Query guideline graph for alternatives if blocked
- Add guideline citations (ACOG with section numbers)
- Add process trace (axiom retrieval + proof execution)
- Reference pre-built Lean 4 proof artifacts

### What This Module Does NOT Output

- ❌ Probabilities or confidence scores (upstream Statistical Harness)
- ❌ Diagnostic reasoning (upstream Reasoning Engine)
- ❌ Treatment recommendations beyond safety bounds
- ❌ Clinical decision about what to do (only verification)

### Two Core Verification Patterns

1. **Drug safety**: Block contraindications → suggest alternatives
2. **Delivery timing**: Verify "deliver vs. wait" → enforce requirements

### Critical Targets

- **100% ACOG guideline compliance** (zero violations allowed)
- **< 2 second verification cycle** (certificate generation + Lean 4 proof)
- **0% hallucination rate** for guideline citations (all facts grounded in ontology)
- **Full audit trail** for offline review and compliance evaluation

### Design Priority

**Safety over convenience.** When in doubt, block and cite ACOG alternatives with physiology-based rationale.
