"""Protocol verification endpoints with LEAN 4 integration."""

from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends

from protocol_router import ProtocolRouter
from api.dependencies import get_protocol_router_dependency
from api.models import VerifyRequest, VerifyResponse, VerifyProtocolResult
from verifiers.base_verifier import check_missing_interactions
from verifiers.lean_translator import LeanTranslator
from verifiers.lean_executor import LeanExecutor

router = APIRouter()

# Initialize verifier components
lean_translator = LeanTranslator()
lean_executor = LeanExecutor()

# Paths
VERIFIERS_DIR = Path(__file__).parent.parent.parent / "verifiers"
GUIDELINES_DIR = VERIFIERS_DIR / "guidelines"
PROTOCOLS_DIR = VERIFIERS_DIR / "protocols"


@router.post("/run", response_model=VerifyResponse)
def verify_protocols(
    request: VerifyRequest,
    protocol_router: ProtocolRouter = Depends(get_protocol_router_dependency),
):
    """
    Execute LEAN 4 verifiers for activated protocols.

    This endpoint:
    1. Routes patient conditions to protocols
    2. Checks for missing interaction protocols
    3. For each protocol with a guideline:
       - Translates guideline YAML → LEAN code
       - Executes LEAN proof
       - Returns verification results

    Returns verification results including:
    - Protocol activation correctness
    - Mutual exclusion checks
    - Safety constraint verification
    - Approval status validation
    """
    # Step 1: Match protocols
    activated = protocol_router.match(request.conditions)

    # Step 2: Check for missing interaction protocols
    results = []
    activated_dicts = [p.to_dict() for p in activated]
    missing_warning = check_missing_interactions(request.conditions, activated_dicts)

    if missing_warning:
        missing_result = missing_warning.to_verification_result()
        # Convert VerificationResult to VerifyProtocolResult
        results.append(VerifyProtocolResult(
            protocol_id=missing_result.protocol_id,
            protocol_name=missing_result.protocol_name,
            version=missing_result.version,
            status=missing_result.status,
            message=missing_result.message,
            lean_code=missing_result.lean_code,
            proof_output=missing_result.proof_output,
            errors=missing_result.errors,
            warnings=missing_result.warnings,
            verifications_passed=missing_result.verifications_passed,
            verifications_failed=missing_result.verifications_failed,
        ))

    # Step 3: Verify each activated protocol
    for protocol in activated:
        result = verify_single_protocol(
            protocol_id=protocol.id,
            protocol_name=protocol.name,
            protocol_version=protocol.version,
            patient_conditions=request.conditions
        )
        results.append(result)

    return VerifyResponse(
        matched_conditions=sorted(request.conditions),
        results=results,
        timestamp=datetime.now(timezone.utc),
    )


def verify_single_protocol(
    protocol_id: str,
    protocol_name: str,
    protocol_version: str,
    patient_conditions: set
) -> VerifyProtocolResult:
    """
    Verify a single protocol using LEAN 4.

    Args:
        protocol_id: Protocol identifier
        protocol_name: Protocol name
        protocol_version: Protocol version
        patient_conditions: Set of patient conditions

    Returns:
        VerifyProtocolResult with verification status
    """
    # Check if guideline exists
    guideline_path = GUIDELINES_DIR / f"{protocol_id}.yaml"

    if not guideline_path.exists():
        return VerifyProtocolResult(
            protocol_id=protocol_id,
            protocol_name=protocol_name,
            version=protocol_version,
            status="not_implemented",
            message=f"No guideline found at {guideline_path}",
            warnings=[f"Create guideline file: {guideline_path}"]
        )

    try:
        # Step 1: Load guideline and check exclusions FIRST
        import yaml
        with open(guideline_path, 'r') as f:
            guideline = yaml.safe_load(f)

        # Check if patient has any excluded conditions
        exclusions = guideline.get("exclusions", [])
        exclusion_violations = []

        for exclusion in exclusions:
            excluded_conditions = exclusion.get("cannot_coexist_with", [])
            reason = exclusion.get("reason", "Condition incompatibility")

            for excl_cond in excluded_conditions:
                if excl_cond in patient_conditions:
                    exclusion_violations.append({
                        "condition": excl_cond,
                        "reason": reason
                    })

        # If exclusions are violated, fail immediately without LEAN verification
        if exclusion_violations:
            violation_msgs = [f"'{v['condition']}': {v['reason']}" for v in exclusion_violations]
            return VerifyProtocolResult(
                protocol_id=protocol_id,
                protocol_name=protocol_name,
                version=protocol_version,
                status="failed",
                message=f"Mutual exclusion violated: {len(exclusion_violations)} incompatible condition(s) detected",
                errors=violation_msgs,
                verifications_failed=[f"Exclusion check failed for: {v['condition']}" for v in exclusion_violations]
            )

        # Step 2: Translate guideline to LEAN
        lean_code = lean_translator.translate_from_file(guideline_path, protocol_id)

        # Step 3: Save LEAN file
        lean_file = PROTOCOLS_DIR / f"{protocol_id}.lean"
        lean_translator.save_lean_file(lean_code, lean_file)

        # Step 4: Execute LEAN proof
        result = lean_executor.execute_lean_file(
            lean_file=lean_file,
            protocol_id=protocol_id,
            protocol_name=protocol_name,
            version=protocol_version
        )

        return VerifyProtocolResult(
            protocol_id=result.protocol_id,
            protocol_name=result.protocol_name,
            version=result.version,
            status=result.status,
            message=result.message,
            lean_code=result.lean_code,
            proof_output=result.proof_output,
            errors=result.errors,
            warnings=result.warnings,
            verifications_passed=result.verifications_passed,
            verifications_failed=result.verifications_failed,
        )

    except Exception as e:
        return VerifyProtocolResult(
            protocol_id=protocol_id,
            protocol_name=protocol_name,
            version=protocol_version,
            status="failed",
            message=f"Error during verification: {str(e)}",
            errors=[str(e)]
        )

