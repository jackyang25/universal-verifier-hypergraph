# Clinical Protocol Verification System

This directory contains the **LEAN 4 formal verification system** for clinical protocols. It translates clinical guidelines into mathematical proofs to ensure logical consistency and safety.

## Architecture

```
verifiers/
├── __init__.py                 # Package initialization
├── base_verifier.py            # Abstract base classes
├── lean_translator.py          # YAML → LEAN code translator
├── lean_executor.py            # LEAN proof executor
├── guidelines/                 # Clinical guideline definitions (YAML)
│   ├── README.md
│   ├── pregnancy_protocol.yaml
│   └── pregnancy_diabetes_interaction.yaml
└── protocols/                  # Generated LEAN files (auto-created)
    └── *.lean                  # Auto-generated LEAN proofs
```

## How It Works

### 1. Guideline Definition (YAML)

You define clinical protocol verification requirements in YAML:

```yaml
# verifiers/guidelines/pregnancy_diabetes_interaction.yaml
protocol_id: pregnancy_diabetes_interaction
version: "1.0.0"

activation:
  requires_all: [pregnant, diabetic]

exclusions:
  - cannot_coexist_with: [pediatric]
    reason: "Pediatric patients cannot be pregnant"

safety:
  medication_conflicts:
    - then_avoid: ["metformin_high_dose"]
      then_require: ["insulin"]

regulatory:
  approval_status: "approved"
```

### 2. Translation to LEAN 4

The system automatically translates your YAML to LEAN theorems:

```lean
theorem pregnancy_diabetes_activation_correctness (patient : PatientState) :
  protocol_activates pregnancy_diabetes_protocol patient ↔
  ("pregnant" ∈ patient.conditions ∧ "diabetic" ∈ patient.conditions) := by
  -- Auto-generated proof
```

### 3. Formal Verification

LEAN 4 proves your theorems to verify:
- ✅ Protocol activation logic is correct
- ✅ No mutually exclusive conditions can coexist
- ⚠️ Missing interaction protocols detected

### 4. API Integration

Call `/api/verify/run` with patient conditions:

```bash
POST /api/verify/run
{
  "conditions": ["pregnant", "diabetic"]
}
```

Response includes verification results:

```json
{
  "results": [
    {
      "protocol_id": "pregnancy_diabetes_interaction",
      "status": "proved",
      "message": "All theorems verified successfully",
      "lean_code": "...",
      "verifications_passed": [
        "activation_correctness verified",
        "medication_safety verified"
      ]
    }
  ]
}
```

## Verification Types

### 1. Protocol Activation Logic ✅

**What it verifies**: Protocol activates if and only if all required conditions are present.

**YAML**:
```yaml
activation:
  requires_all: [condition1, condition2]
```

**LEAN Theorem**: Proves `protocol_active ↔ (condition1 ∧ condition2)`

---

### 2. Mutual Exclusion ⊥

**What it verifies**: Incompatible conditions cannot coexist.

**YAML**:
```yaml
exclusions:
  - cannot_coexist_with: [incompatible_condition]
    reason: "Explanation"
```

**LEAN Theorem**: Proves `protocol_active → ¬incompatible_condition`

---

### 3. Missing Interaction Detection ⚠️

**What it detects**: Patient has multiple conditions but no interaction protocol exists.

**Example**:
- Patient: `["diabetic", "age_over_65"]`
- Activated: `diabetes_protocol`, `elderly_protocol` ✓
- Missing: `diabetes_elderly_interaction` protocol ⚠️

**Response**:
```json
{
  "status": "warning",
  "message": "No interaction protocol found for 2 conditions",
  "warnings": [
    "No interaction protocol found for conditions: [age_over_65, diabetic]"
  ]
}
```

## Creating New Guidelines

### Step 1: Create YAML File

Create `verifiers/guidelines/{protocol_id}.yaml`:

```yaml
protocol_id: my_protocol
version: "1.0.0"
name: "My Clinical Protocol"

activation:
  requires_all: [condition1, condition2]

# Add other verification types as needed
```

### Step 2: Test Verification

```bash
curl -X POST http://localhost:8000/api/verify/run \
  -H "Content-Type: application/json" \
  -d '{"conditions": ["condition1", "condition2"]}'
```

### Step 3: Review Results

Check the response for:
- `status`: "proved" | "failed" | "warning"
- `verifications_passed`: List of verified theorems
- `errors`: Any proof failures
- `lean_code`: Generated LEAN code (for debugging)

## LEAN 4 Installation

### Local Development

Install LEAN 4:
```bash
curl https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh -sSf | sh
```

Verify installation:
```bash
lean --version
```

### Docker

LEAN 4 is automatically installed in the Docker container (see `Dockerfile`).

## Troubleshooting

### "LEAN 4 is not installed"

**Solution**: Install LEAN locally or use Docker:
```bash
make start  # Uses Docker with LEAN pre-installed
```

### "No guideline found"

**Solution**: Create guideline YAML file:
```bash
cp verifiers/guidelines/pregnancy_protocol.yaml \
   verifiers/guidelines/your_protocol.yaml
# Edit your_protocol.yaml
```

### Proof contains "sorry"

**Meaning**: Theorem admitted without proof (placeholder).

**Solution**: This is expected for now. Actual proofs require domain-specific axioms about:
- Condition incompatibilities
- Medication interactions
- Clinical safety rules

These axioms will be added as the system matures.

## Files Generated at Runtime

```
verifiers/protocols/
├── pregnancy_protocol.lean              # Auto-generated
├── pregnancy_diabetes_interaction.lean  # Auto-generated
└── ...
```

These files are created when you call `/api/verify/run` and can be inspected for debugging.

## Next Steps

1. **Create guidelines** for all protocols in `config/clinical_protocols.yaml`
2. **Define domain axioms** in LEAN for clinical rules
3. **Complete proofs** by replacing `sorry` with actual proof tactics
4. **Add more verification types** as needed

## Resources

- [LEAN 4 Documentation](https://lean-lang.org/lean4/doc/)
- [Mathlib4 Tactics](https://leanprover-community.github.io/mathlib4_docs/tactics.html)
- [Clinical Protocol Config](../config/clinical_protocols.yaml)
