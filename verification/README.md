# Verification Module

Runtime verification using pre-built Lean 4 proofs.

## Architecture

**Key Concept**: Each axiom (protocol) has a **linked proof**.

```
Axiom (Protocol) ─────→ Linked Proof (executable)
     │                        │
     │                        │
 Step 1: Retrieve        Step 2: Execute
 (query axioms)         (run linked proof)
                             │
                             ▼
                    Step 3: Generate Certificate
```

This module performs **runtime verification** in 3 steps:

```
STEP 1: AXIOM RETRIEVAL (axiom_retrieval.py)
  Query which axioms apply → Each axiom has a linked proof
  
STEP 2: PROOF EXECUTION (proof_execution.py)
  Execute the specific proofs linked to retrieved axioms
  
STEP 3: CERTIFICATE GENERATION (certificate_generator.py)
  Generate certificate from proof execution results
```

**Proof Linking**: See `PROOF_LINKING.md` for details.

## Components

### `verifier.py`
Main orchestrator that runs the 3-step verification process.

```python
from verification import ClinicalVerifier

verifier = ClinicalVerifier(bridge)

certificate = verifier.verify(
    conformal_set=["hellp_syndrome", "aflp"],
    proposed_action={"type": "action", "id": "immediate_delivery"},
    patient_context={"ga_weeks": 32}
)

print(certificate.verification_status)  # VERIFIED | BLOCKED | REPAIR_NEEDED
```

### `axiom_retrieval.py`
Step 1: Query hypergraph for relevant pre-built axioms.

- Expands conformal set with parent hierarchy
- Retrieves contraindication axioms for patient comorbidities
- Retrieves requirement axioms for conditions
- Retrieves dose constraint axioms
- Retrieves exclusion axioms

### `proof_execution.py`
Step 2: Execute pre-built Lean 4 proofs.

For each retrieved axiom:
1. Get the linked proof: `proof_func = PROOF_REGISTRY[axiom_id]`
2. Execute it: `result = proof_func(patient_state, proposed_action)`
3. Returns True/False for categorization

Proof types:
- Contraindication proofs (blocking)
- Requirement proofs (blocking if unsatisfied)
- Dose constraint checks (informational)
- Exclusion proofs (blocking)

### `protocol_proofs.py`
Protocol-level proof executables.

Each protocol has a linked proof that:
- Takes retrieved axioms + patient_state + proposed_action
- Returns verification result (VERIFIED/BLOCKED/REPAIR_NEEDED)

Currently: Python functions that will be **replaced with Lean executables later**.

```python
def proof_drug_comorbidity_safety(axioms, patient_state, proposed_action):
    """Protocol proof for drug-comorbidity contraindication checking."""
    violations = []
    # Check each axiom against patient state
    return {"violations": violations, "result": "VERIFIED" or "BLOCKED"}

PROTOCOL_PROOF_REGISTRY = {
    "proof_drug_comorbidity_safety": proof_drug_comorbidity_safety,
    "proof_delivery_timing_conformal": proof_delivery_timing_conformal,
}
```

### `certificate_generator.py`
Step 3: Generate verification certificate.

Creates certificate with 7 required components:
1. **Verification Status** - VERIFIED | BLOCKED | REPAIR_NEEDED
2. **Contraindications** - Hard violations (blocking)
3. **Alternatives** - Repair guidance
4. **Dose Limits** - Informational warnings
5. **Consistency Violations** - Mutual exclusions, unsatisfied requirements
6. **Required Actions** - Red-flag scenarios
7. **Process Trace** - Audit trail

### `certificate.py`
Certificate data structures.

## Usage Example

```python
from pathlib import Path
from ontology.bridge import OntologyBridge
from verification import ClinicalVerifier

# Load ontology and generate axioms (compile time)
bridge = OntologyBridge.from_directory(Path('ontology/data'))
bridge.generate_axioms_from_relations()

# Create verifier
verifier = ClinicalVerifier(bridge)

# Verify drug safety
certificate = verifier.verify(
    conformal_set=["preeclampsia_severe"],
    proposed_action={
        "type": "substance",
        "id": "labetalol",
        "dose": "20mg IV"
    },
    patient_context={
        "comorbidities": ["asthma"],
        "ga_weeks": 32
    }
)

# Check result
if certificate.verification_status == VerificationStatus.BLOCKED:
    print("Action blocked!")
    for c in certificate.contraindications:
        print(f"{c.substance} contraindicated in {c.condition}")
        print(f"Rationale: {c.rationale}")
    
    print("\nAlternatives:")
    for alt in certificate.alternatives:
        print(f"- {alt.substance}: {alt.dose}")

# Export certificate
cert_dict = certificate.to_dict()
```

## Performance

Target: < 2 seconds per verification cycle

Optimization strategies:
- Pre-built proofs at compile time (no runtime proof construction)
- Fast axiom retrieval via indexed registry
- Parallel proof execution where possible
- Early exit on first hard violation

## Testing

```bash
# Test verification system
PYTHONPATH=. python3 -c "
from pathlib import Path
from ontology.bridge import OntologyBridge
from verification import ClinicalVerifier

bridge = OntologyBridge.from_directory(Path('ontology/data'))
bridge.generate_axioms_from_relations()
verifier = ClinicalVerifier(bridge)

# Test drug safety
cert = verifier.verify(
    conformal_set=['preeclampsia_severe'],
    proposed_action={'type': 'substance', 'id': 'labetalol'},
    patient_context={'comorbidities': ['asthma']}
)
print(f'Status: {cert.verification_status.value}')
print(f'Contraindications: {len(cert.contraindications)}')
print(f'Alternatives: {len(cert.alternatives)}')
"
```
