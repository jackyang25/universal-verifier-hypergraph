from __future__ import annotations

import json
import os
import re
import subprocess
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from src.api.schemas import (
    CohereVerifyRequest,
    CohereVerifyResponse,
    HypergraphCandidateEdgeResponse,
    HypergraphRetrieveRequest,
    HypergraphRetrieveResponse,
    HypergraphVerificationSummaryResponse,
    IncompatibilityPairInput,
    IncompatibilityPairResponse,
    InfeasibilityEntryInput,
    InfeasibilityEntryResponse,
    KernelActiveArtifactsResponse,
    KernelArtifactManifestResponse,
    KernelPublishSnapshotRequest,
    KernelPublishSnapshotResponse,
    KernelReplaceRulesetRequest,
    KernelRuleInput,
    KernelRuleResponse,
    KernelRuntimeArtifactsResponse,
    KernelRuntimeVerificationResponse,
    OntologyMappingResponse,
    OntologyNormalizeRequest,
    ConflictWarningResponse,
    FactExclusionInput,
    FactExclusionResponse,
    OntologyNormalizeResponse,
)
from src.hypergraph.hyperedges import Hyperedge
from src.kernel.certgen import CertificateVerifyResult, verify_certificate, write_certificate
from src.kernel.conflicts import ConflictWarning, detect_conflicts
from src.kernel.store import (
    SESSION_MANAGER,
    InMemoryKernelArtifactStore,
    KernelArtifactBundle,
    KernelArtifactManifest,
    RuleProvenance,
)
from src.ontology.normalize import OntologyInput, normalize_ontology_input
from src.ontology.registry import build_token_registry

_registry_cache: dict[str, object] | None = None


def _get_registry() -> dict[str, object]:
    global _registry_cache  # noqa: PLW0603
    if _registry_cache is None:
        _registry_cache = build_token_registry()
    return _registry_cache


def _validate_action_token(action: str) -> None:
    reg = _get_registry()
    if action not in reg["actions"]:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid action token: '{action}'. Valid actions: {reg['actions']}",
        )


def _validate_fact_tokens(facts: list[str]) -> None:
    reg = _get_registry()
    allowed = set(reg["facts"])
    invalid = [f for f in facts if f not in allowed]
    if invalid:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid fact tokens: {invalid}",
        )


_valid_outcomes_cache: set[str] | None = None


def _get_valid_outcomes() -> set[str]:
    global _valid_outcomes_cache  # noqa: PLW0603
    if _valid_outcomes_cache is None:
        reg = _get_registry()
        _valid_outcomes_cache = {
            f"{v}({a})" for v in reg["verdicts"] for a in reg["actions"]
        }
    return _valid_outcomes_cache


def _validate_outcome_token(outcome: str) -> None:
    if outcome not in _get_valid_outcomes():
        raise HTTPException(
            status_code=422,
            detail=f"Invalid outcome: '{outcome}'. Expected format: Verdict(Action).",
        )


app = FastAPI(
    title="Verified Protocol Hypergraph API",
    description=(
        "Build-time verified clinical decision protocol service. "
        "This API currently provides ontology normalization and hypergraph retrieval."
    ),
    version="0.1.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

cors_origins_env = os.getenv("CORS_ORIGINS", "*")
allowed_origins = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]
if not allowed_origins:
    raise RuntimeError("CORS_ORIGINS is set but does not contain any valid origins.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Session helpers
# ---------------------------------------------------------------------------

_DEFAULT_SESSION_ID = "default"


def _get_session_id(request: Request) -> str:
    return request.headers.get("x-session-id", _DEFAULT_SESSION_ID)


def _get_session_store(request: Request) -> InMemoryKernelArtifactStore:
    return SESSION_MANAGER.get_or_create(_get_session_id(request))


def _get_session_artifact_dir(request: Request) -> Path:
    session_id = _get_session_id(request)
    base = os.getenv("KERNEL_ARTIFACT_DIR", "/tmp/verified-protocol-hypergraph-artifacts")
    return Path(base) / session_id


# ---------------------------------------------------------------------------
# Response helpers
# ---------------------------------------------------------------------------


def _manifest_to_response(manifest: KernelArtifactManifest) -> KernelArtifactManifestResponse:
    return KernelArtifactManifestResponse(
        artifactSource=manifest.artifact_source,
        rulesetVersion=manifest.ruleset_version,
        revision=manifest.revision,
        updatedAt=manifest.updated_at.isoformat(),
        updatedBy=manifest.updated_by,
        changeSummary=manifest.change_summary,
    )


def _rule_to_response(
    edge: Hyperedge,
    provenance: dict[str, RuleProvenance],
    fallback_by: str,
    fallback_at: datetime,
) -> KernelRuleResponse:
    prov = provenance.get(edge.edge_id)
    return KernelRuleResponse(
        ruleId=edge.edge_id,
        premises=sorted(edge.premises),
        outcome=edge.expected_outcome,
        note=edge.note,
        createdBy=prov.created_by if prov else fallback_by,
        createdAt=prov.created_at.isoformat() if prov else fallback_at.isoformat(),
    )


def _run_verifier(file_args: list[str], timeout_seconds: float) -> CohereVerifyResponse:
    """Invoke the cohere-verify CLI and return a structured result."""
    verify_cmd = os.getenv("COHERE_VERIFY_CMD", "cohere-verify").strip()
    if not verify_cmd:
        raise HTTPException(status_code=500, detail="COHERE_VERIFY_CMD is set but empty.")

    started = time.perf_counter()
    try:
        proc = subprocess.run(
            [verify_cmd, *file_args],
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            check=False,
        )
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                f"Verifier binary not found: '{verify_cmd}'. "
                "Ensure it is installed in the container/image, or set COHERE_VERIFY_CMD."
            ),
        ) from exc
    except subprocess.TimeoutExpired as exc:
        duration_ms = int((time.perf_counter() - started) * 1000)
        stdout = (exc.stdout or "") if isinstance(exc.stdout, str) else ""
        stderr = (exc.stderr or "") if isinstance(exc.stderr, str) else ""
        raise HTTPException(
            status_code=504,
            detail={
                "message": "Verification timed out.",
                "durationMs": duration_ms,
                "stdout": stdout[-10_000:],
                "stderr": stderr[-10_000:],
            },
        ) from exc

    duration_ms = int((time.perf_counter() - started) * 1000)
    return CohereVerifyResponse(
        ok=proc.returncode == 0,
        exitCode=proc.returncode,
        durationMs=duration_ms,
        stdout=(proc.stdout or "")[-50_000:],
        stderr=(proc.stderr or "")[-50_000:],
    )


def _sanitize_dir_component(value: str) -> str:
    trimmed = value.strip()
    if not trimmed:
        return "untitled"
    safe = re.sub(r"[^a-zA-Z0-9._-]+", "-", trimmed)
    safe = safe.strip("-._")
    return safe or "untitled"


def _incompat_to_response(pairs: tuple[dict[str, object], ...]) -> list[IncompatibilityPairResponse]:
    result: list[IncompatibilityPairResponse] = []
    for pair in pairs:
        a = pair.get("a")
        b = pair.get("b")
        if isinstance(a, str) and isinstance(b, str):
            result.append(IncompatibilityPairResponse(
                a=a, b=b,
                createdBy=str(pair.get("created_by", "")),
                createdAt=str(pair.get("created_at", "")),
            ))
    return result


def _infeasibility_to_response(entries: tuple[dict[str, object], ...]) -> list[InfeasibilityEntryResponse]:
    result: list[InfeasibilityEntryResponse] = []
    for entry in entries:
        action = entry.get("action")
        premises = entry.get("premises")
        if isinstance(action, str) and isinstance(premises, list):
            result.append(InfeasibilityEntryResponse(
                action=action,
                premises=[str(f) for f in premises],
                createdBy=str(entry.get("created_by", "")),
                createdAt=str(entry.get("created_at", "")),
            ))
    return result


def _fact_exclusions_to_response(groups: tuple[dict[str, object], ...]) -> list[FactExclusionResponse]:
    result: list[FactExclusionResponse] = []
    for group in groups:
        facts = group.get("facts")
        if isinstance(facts, list):
            result.append(FactExclusionResponse(
                facts=[str(f) for f in facts],
                createdBy=str(group.get("created_by", "")),
                createdAt=str(group.get("created_at", "")),
            ))
    return result


def _conflict_to_response(w: ConflictWarning) -> ConflictWarningResponse:
    return ConflictWarningResponse(
        ruleAId=w.rule_a_id,
        ruleBId=w.rule_b_id,
        action=w.action,
        verdictA=w.verdict_a,
        verdictB=w.verdict_b,
        resolvable=w.resolvable,
    )


def _draft_to_active_response(store: InMemoryKernelArtifactStore) -> KernelActiveArtifactsResponse:
    draft = store.get_draft()
    manifest = _manifest_to_response(draft.manifest)
    ruleset = [
        _rule_to_response(edge, draft.rule_provenance, draft.manifest.updated_by, draft.manifest.updated_at)
        for edge in draft.proposals
    ]
    candidate = store.build_candidate_runtime_bundle()
    warnings = detect_conflicts(candidate.ruleset)
    return KernelActiveArtifactsResponse(
        manifest=manifest,
        rulesetRuleCount=len(draft.proposals),
        ruleset=ruleset,
        incompatibilityPairCount=len(draft.incompatibility),
        incompatibility=_incompat_to_response(draft.incompatibility),
        infeasibilityEntryCount=len(draft.infeasibility),
        infeasibility=_infeasibility_to_response(draft.infeasibility),
        factExclusionCount=len(draft.fact_exclusions),
        factExclusions=_fact_exclusions_to_response(draft.fact_exclusions),
        proofReport={"status": "draft", "notes": "Pending proposals only."},
        conflictWarnings=[_conflict_to_response(w) for w in warnings],
    )


def _runtime_to_response(
    bundle: KernelArtifactBundle | None,
    verification_payload: KernelRuntimeVerificationResponse,
) -> KernelRuntimeArtifactsResponse:
    if bundle is None:
        return KernelRuntimeArtifactsResponse(
            verification=verification_payload,
            manifest=None,
            rulesetRuleCount=0,
            ruleset=[],
            incompatibilityPairCount=0,
            incompatibility=[],
            infeasibilityEntryCount=0,
            infeasibility=[],
            proofReport={},
        )

    manifest = _manifest_to_response(bundle.manifest)
    ruleset = [
        _rule_to_response(edge, bundle.rule_provenance, bundle.manifest.updated_by, bundle.manifest.updated_at)
        for edge in bundle.ruleset
    ]
    return KernelRuntimeArtifactsResponse(
        verification=verification_payload,
        manifest=manifest,
        rulesetRuleCount=len(bundle.ruleset),
        ruleset=ruleset,
        incompatibilityPairCount=len(bundle.incompatibility),
        incompatibility=_incompat_to_response(bundle.incompatibility),
        infeasibilityEntryCount=len(bundle.infeasibility),
        infeasibility=_infeasibility_to_response(bundle.infeasibility),
        factExclusionCount=len(bundle.fact_exclusions),
        factExclusions=_fact_exclusions_to_response(bundle.fact_exclusions),
        proofReport=bundle.proof_report,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/kernel/registry")
def get_token_registry() -> dict[str, object]:
    return _get_registry()


@app.post("/api/ontology/normalize", response_model=OntologyNormalizeResponse)
def normalize_ontology(payload: OntologyNormalizeRequest) -> OntologyNormalizeResponse:
    try:
        normalized = normalize_ontology_input(
            OntologyInput(
                selected_diagnoses=payload.selectedDiagnoses,
                diagnosis_attributes_by_diagnosis=payload.diagnosisAttributesByDiagnosis,
                selected_comorbidities=payload.selectedComorbidities,
                selected_physiologic_states=payload.selectedPhysiologicStates,
                gestational_weeks=payload.gestationalWeeks,
                maternal_age_years=payload.maternalAgeYears,
                bmi=payload.bmi,
                selected_action=payload.selectedAction,
            )
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return OntologyNormalizeResponse(
        facts=normalized.facts,
        diagnosisFacts=normalized.diagnosis_facts,
        diagnosisAttributeFacts=normalized.diagnosis_attribute_facts,
        contextFacts=normalized.context_facts,
        actionToken=normalized.action_token,
        mappings=[
            OntologyMappingResponse(
                sourceGroup=mapping.source_group,
                sourceValue=mapping.source_value,
                normalizedTokens=mapping.normalized_tokens,
                ruleExplanations=mapping.rule_explanations,
            )
            for mapping in normalized.mappings
        ],
    )


@app.post("/api/hypergraph/retrieve", response_model=HypergraphRetrieveResponse)
def retrieve_hypergraph(payload: HypergraphRetrieveRequest, request: Request) -> HypergraphRetrieveResponse:
    store = _get_session_store(request)
    runtime_verification = store.get_runtime_verification()
    if runtime_verification.status != "verified":
        raise HTTPException(
            status_code=412,
            detail=(
                "Runtime ruleset is not verified. "
                "Publish a snapshot with verification enabled in Build to activate it."
            ),
        )

    facts = set(payload.facts)
    candidate_edges: list[HypergraphCandidateEdgeResponse] = []

    for edge in store.get_runtime_ruleset():
        matching_premises = sorted(edge.premises.intersection(facts))
        missing_premises = sorted(edge.premises.difference(facts))
        candidate_edges.append(
            HypergraphCandidateEdgeResponse(
                edgeId=edge.edge_id,
                premises=sorted(edge.premises),
                expectedOutcome=edge.expected_outcome,
                note=edge.note,
                isMatched=len(missing_premises) == 0,
                matchingPremises=matching_premises,
                missingPremises=missing_premises,
            )
        )

    matched_edges = [edge for edge in candidate_edges if edge.isMatched]
    derived_outcomes = sorted({edge.expectedOutcome for edge in matched_edges})

    verification: HypergraphVerificationSummaryResponse | None = None
    if payload.proposedActionToken:
        obligated_target = f"Obligated({payload.proposedActionToken})"
        allowed_target = f"Allowed({payload.proposedActionToken})"

        obligated_support = [edge.edgeId for edge in matched_edges if edge.expectedOutcome == obligated_target]
        allowed_support = [edge.edgeId for edge in matched_edges if edge.expectedOutcome == allowed_target]

        if obligated_support:
            verification = HypergraphVerificationSummaryResponse(
                proposedActionToken=payload.proposedActionToken,
                isSupported=True,
                supportLevel="obligated",
                supportingEdgeIds=sorted(obligated_support),
            )
        elif allowed_support:
            verification = HypergraphVerificationSummaryResponse(
                proposedActionToken=payload.proposedActionToken,
                isSupported=True,
                supportLevel="allowed",
                supportingEdgeIds=sorted(allowed_support),
            )
        else:
            verification = HypergraphVerificationSummaryResponse(
                proposedActionToken=payload.proposedActionToken,
                isSupported=False,
                supportLevel="unsupported",
                supportingEdgeIds=[],
            )

    return HypergraphRetrieveResponse(
        candidateEdgeCount=len(candidate_edges),
        matchedEdgeCount=len(matched_edges),
        derivedOutcomes=derived_outcomes,
        candidateEdges=candidate_edges,
        verification=verification,
    )


@app.get("/api/kernel/active", response_model=KernelActiveArtifactsResponse)
def get_active_kernel_artifacts(request: Request) -> KernelActiveArtifactsResponse:
    store = _get_session_store(request)
    return _draft_to_active_response(store)


@app.put("/api/kernel/active/ruleset", response_model=KernelActiveArtifactsResponse)
def replace_active_ruleset(payload: KernelReplaceRulesetRequest, request: Request) -> KernelActiveArtifactsResponse:
    rule_ids = [rule.ruleId for rule in payload.ruleset]
    if len(set(rule_ids)) != len(rule_ids):
        raise HTTPException(status_code=400, detail="Ruleset contains duplicate ruleId values.")

    store = _get_session_store(request)
    edges: list[Hyperedge] = []
    for rule in payload.ruleset:
        edges.append(
            Hyperedge(
                edge_id=rule.ruleId,
                premises=frozenset(rule.premises),
                expected_outcome=rule.outcome,
                note=rule.note,
            )
        )

    store.replace_draft_proposals(
        ruleset_version=payload.rulesetVersion,
        updated_by=payload.updatedBy,
        change_summary=payload.changeSummary,
        rules=edges,
    )
    return _draft_to_active_response(store)


# -- individual rule CRUD -----------------------------------------------------


@app.post("/api/kernel/active/rules", response_model=KernelActiveArtifactsResponse)
def add_rule(payload: KernelRuleInput, request: Request) -> KernelActiveArtifactsResponse:
    _validate_outcome_token(payload.outcome)
    _validate_fact_tokens(payload.premises)
    store = _get_session_store(request)
    edge = Hyperedge(
        edge_id=payload.ruleId,
        premises=frozenset(payload.premises),
        expected_outcome=payload.outcome,
        note=payload.note,
    )
    try:
        store.add_rule(edge=edge, created_by=payload.createdBy)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return _draft_to_active_response(store)


@app.put("/api/kernel/active/rules/{rule_id}", response_model=KernelActiveArtifactsResponse)
def update_rule(rule_id: str, payload: KernelRuleInput, request: Request) -> KernelActiveArtifactsResponse:
    _validate_outcome_token(payload.outcome)
    _validate_fact_tokens(payload.premises)
    store = _get_session_store(request)
    edge = Hyperedge(
        edge_id=payload.ruleId,
        premises=frozenset(payload.premises),
        expected_outcome=payload.outcome,
        note=payload.note,
    )
    try:
        store.update_rule(rule_id=rule_id, edge=edge, updated_by=payload.createdBy)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return _draft_to_active_response(store)


@app.delete("/api/kernel/active/rules/{rule_id}", response_model=KernelActiveArtifactsResponse)
def delete_rule(rule_id: str, request: Request) -> KernelActiveArtifactsResponse:
    store = _get_session_store(request)
    try:
        store.remove_rule(rule_id=rule_id, updated_by="anonymous")
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return _draft_to_active_response(store)


# -- incompatibility CRUD -----------------------------------------------------


@app.post("/api/kernel/active/incompatibility", response_model=KernelActiveArtifactsResponse)
def add_incompatibility_pair(payload: IncompatibilityPairInput, request: Request) -> KernelActiveArtifactsResponse:
    _validate_action_token(payload.a)
    _validate_action_token(payload.b)
    store = _get_session_store(request)
    try:
        store.add_incompatibility_pair(a=payload.a, b=payload.b, created_by=payload.createdBy)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return _draft_to_active_response(store)


@app.put("/api/kernel/active/incompatibility/{index}", response_model=KernelActiveArtifactsResponse)
def update_incompatibility_pair(index: int, payload: IncompatibilityPairInput, request: Request) -> KernelActiveArtifactsResponse:
    _validate_action_token(payload.a)
    _validate_action_token(payload.b)
    store = _get_session_store(request)
    try:
        store.update_incompatibility_pair(index=index, a=payload.a, b=payload.b, updated_by=payload.createdBy)
    except IndexError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return _draft_to_active_response(store)


@app.delete("/api/kernel/active/incompatibility/{index}", response_model=KernelActiveArtifactsResponse)
def delete_incompatibility_pair(index: int, request: Request) -> KernelActiveArtifactsResponse:
    store = _get_session_store(request)
    try:
        store.remove_incompatibility_pair(index=index, updated_by="anonymous")
    except IndexError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return _draft_to_active_response(store)


# -- infeasibility CRUD -------------------------------------------------------


@app.post("/api/kernel/active/infeasibility", response_model=KernelActiveArtifactsResponse)
def add_infeasibility_entry(payload: InfeasibilityEntryInput, request: Request) -> KernelActiveArtifactsResponse:
    _validate_action_token(payload.action)
    _validate_fact_tokens(payload.premises)
    store = _get_session_store(request)
    try:
        store.add_infeasibility_entry(
            action=payload.action, premises=payload.premises, created_by=payload.createdBy
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return _draft_to_active_response(store)


@app.put("/api/kernel/active/infeasibility/{index}", response_model=KernelActiveArtifactsResponse)
def update_infeasibility_entry(index: int, payload: InfeasibilityEntryInput, request: Request) -> KernelActiveArtifactsResponse:
    _validate_action_token(payload.action)
    _validate_fact_tokens(payload.premises)
    store = _get_session_store(request)
    try:
        store.update_infeasibility_entry(
            index=index, action=payload.action, premises=payload.premises, updated_by=payload.createdBy
        )
    except IndexError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return _draft_to_active_response(store)


@app.delete("/api/kernel/active/infeasibility/{index}", response_model=KernelActiveArtifactsResponse)
def delete_infeasibility_entry(index: int, request: Request) -> KernelActiveArtifactsResponse:
    store = _get_session_store(request)
    try:
        store.remove_infeasibility_entry(index=index, updated_by="anonymous")
    except IndexError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return _draft_to_active_response(store)


@app.post("/api/kernel/active/fact-exclusions", response_model=KernelActiveArtifactsResponse)
def add_fact_exclusion(payload: FactExclusionInput, request: Request) -> KernelActiveArtifactsResponse:
    _validate_fact_tokens(payload.facts)
    store = _get_session_store(request)
    try:
        store.add_fact_exclusion(facts=payload.facts, created_by=payload.createdBy)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return _draft_to_active_response(store)


@app.delete("/api/kernel/active/fact-exclusions/{index}", response_model=KernelActiveArtifactsResponse)
def delete_fact_exclusion(index: int, request: Request) -> KernelActiveArtifactsResponse:
    store = _get_session_store(request)
    try:
        store.remove_fact_exclusion(index=index, updated_by="anonymous")
    except IndexError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return _draft_to_active_response(store)


@app.get("/api/kernel/runtime", response_model=KernelRuntimeArtifactsResponse)
def get_runtime_kernel_artifacts(request: Request) -> KernelRuntimeArtifactsResponse:
    store = _get_session_store(request)
    runtime = store.get_runtime_bundle()
    verification = store.get_runtime_verification()
    verification_payload = KernelRuntimeVerificationResponse(
        status=verification.status,
        verifiedAt=verification.verified_at.isoformat() if verification.verified_at else None,
        verifiedBy=verification.verified_by,
        verifiedSnapshotDir=verification.verified_snapshot_dir,
    )
    return _runtime_to_response(runtime, verification_payload)


@app.get("/api/kernel/snapshots")
def list_snapshots(request: Request) -> list[dict[str, str]]:
    base_dir = _get_session_artifact_dir(request)
    if not base_dir.is_dir():
        return []
    entries: list[dict[str, str]] = []
    for child in sorted(base_dir.iterdir(), reverse=True):
        if child.is_dir():
            stat = child.stat()
            created = datetime.fromtimestamp(stat.st_ctime, tz=timezone.utc).isoformat()
            entries.append({
                "directory": str(child),
                "name": child.name,
                "createdAt": created,
            })
    return entries[:50]


@app.post("/api/kernel/publish", response_model=KernelPublishSnapshotResponse)
def publish_active_kernel_snapshot(
    payload: KernelPublishSnapshotRequest,
    request: Request,
) -> KernelPublishSnapshotResponse:
    store = _get_session_store(request)
    draft = store.get_draft()
    bundle = store.build_candidate_runtime_bundle()

    unresolvable = [w for w in detect_conflicts(bundle.ruleset) if not w.resolvable]
    if unresolvable:
        pairs = [f"({w.rule_a_id}, {w.rule_b_id}) on {w.action}" for w in unresolvable]
        raise HTTPException(
            status_code=409,
            detail=f"Cannot publish: {len(unresolvable)} unresolvable conflict(s): {'; '.join(pairs)}",
        )

    base_dir = _get_session_artifact_dir(request)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    safe_version = _sanitize_dir_component(bundle.manifest.ruleset_version)
    snapshot_dir = base_dir / f"{safe_version}--r{bundle.manifest.revision}--{timestamp}"

    try:
        snapshot_dir.mkdir(parents=True, exist_ok=False)
    except FileExistsError:
        raise HTTPException(status_code=409, detail="Snapshot directory already exists.")
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"Failed to create snapshot directory: {exc}") from exc

    manifest_payload = {
        "artifactSource": bundle.manifest.artifact_source,
        "rulesetVersion": bundle.manifest.ruleset_version,
        "revision": bundle.manifest.revision,
        "updatedAt": bundle.manifest.updated_at.isoformat(),
        "updatedBy": bundle.manifest.updated_by,
        "changeSummary": bundle.manifest.change_summary,
        "publishedAt": datetime.now(timezone.utc).isoformat(),
        "note": "Preview snapshot (no persistence guarantees).",
    }

    verdict_pattern = re.compile(r"^(Obligated|Allowed|Disallowed|Rejected)\((.+)\)$")
    rules: list[dict[str, object]] = []
    actions: set[str] = set()
    facts: set[str] = set()

    for edge in sorted(bundle.ruleset, key=lambda item: item.edge_id):
        match = verdict_pattern.match(edge.expected_outcome.strip())
        if not match:
            continue
        kind = match.group(1)
        action = match.group(2).strip()
        if not action:
            continue
        prov = bundle.rule_provenance.get(edge.edge_id)
        source_chunks = []
        if prov is not None:
            source_chunks.append(f"by={prov.created_by}")
            source_chunks.append(f"at={prov.created_at.isoformat()}")
        if edge.note:
            source_chunks.append(edge.note)
        rules.append(
            {
                "id": edge.edge_id,
                "premises": sorted(edge.premises),
                "out": {"kind": kind, "action": action},
                "source": " | ".join(source_chunks) if source_chunks else None,
            }
        )
        actions.add(action)
        facts.update(edge.premises)

    infeasibility_entries: list[dict[str, object]] = []
    for entry in bundle.infeasibility:
        action = entry.get("action")
        premises = entry.get("premises")
        if isinstance(action, str) and isinstance(premises, list):
            infeasibility_entries.append(
                {"action": action, "premises": [str(item) for item in premises]}
            )
            actions.add(action)
            facts.update(str(item) for item in premises)

    domain = os.getenv("KERNEL_DOMAIN", "obstetrics").strip() or "obstetrics"
    ruleset_payload = {
        "version": draft.manifest.ruleset_version,
        "domain": domain,
        "facts": sorted(facts),
        "actions": sorted(actions),
        "rules": rules,
        "notes": bundle.manifest.change_summary or "Published from in-memory kernel artifact store.",
    }
    incompat_payload = {
        "version": draft.manifest.ruleset_version,
        "pairs": [{"a": str(p["a"]), "b": str(p["b"])} for p in bundle.incompatibility if "a" in p and "b" in p],
        "notes": "Published from in-memory kernel artifact store.",
    }
    infeasibility_payload = {
        "version": draft.manifest.ruleset_version,
        "entries": infeasibility_entries,
        "notes": "Published from in-memory kernel artifact store.",
    }
    fact_exclusions_payload = {
        "version": draft.manifest.ruleset_version,
        "groups": [
            {"facts": [str(f) for f in g.get("facts", [])]}
            for g in bundle.fact_exclusions
            if isinstance(g.get("facts"), list)
        ],
        "notes": "Published from in-memory kernel artifact store.",
    }

    files: dict[str, Path] = {
        "manifest": snapshot_dir / "manifest.json",
        "ruleset": snapshot_dir / "ruleset.json",
        "incompatibility": snapshot_dir / "incompatibility.json",
        "infeasibility": snapshot_dir / "infeasibility.json",
        "factExclusions": snapshot_dir / "fact_exclusions.json",
        "proofReport": snapshot_dir / "proof_report.json",
    }

    try:
        files["manifest"].write_text(json.dumps(manifest_payload, indent=2, sort_keys=True), encoding="utf-8")
        files["ruleset"].write_text(json.dumps(ruleset_payload, indent=2, sort_keys=True), encoding="utf-8")
        files["incompatibility"].write_text(json.dumps(incompat_payload, indent=2, sort_keys=True), encoding="utf-8")
        files["infeasibility"].write_text(json.dumps(infeasibility_payload, indent=2, sort_keys=True), encoding="utf-8")
        files["factExclusions"].write_text(json.dumps(fact_exclusions_payload, indent=2, sort_keys=True), encoding="utf-8")
        files["proofReport"].write_text(json.dumps(bundle.proof_report, indent=2, sort_keys=True), encoding="utf-8")
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"Failed to write snapshot files: {exc}") from exc

    cert_generated = False
    cert_verify: CertificateVerifyResult | None = None
    cert_path: Path | None = None
    use_certificate = payload.verifyMode == "certificate"

    if use_certificate:
        try:
            cert_path = write_certificate(
                snapshot_dir, files["ruleset"], files["incompatibility"], files["infeasibility"],
                fact_exclusions_path=files["factExclusions"],
            )
            files["certificate"] = cert_path
            cert_generated = True
        except Exception:
            cert_path = None

    verify_result = None
    runtime_promoted = False

    if payload.verify and not use_certificate:
        verify_result = _run_verifier(
            [str(files["ruleset"]), str(files["incompatibility"]), str(files["infeasibility"]), str(files["factExclusions"])],
            payload.timeoutSeconds,
        )

    if payload.verify and use_certificate and cert_generated and cert_path is not None:
        cert_timeout = max(int(payload.timeoutSeconds), 180)
        cert_verify = verify_certificate(cert_path, timeout_seconds=cert_timeout)
        if cert_verify.ok:
            store.promote_candidate_to_runtime(
                verified_by=draft.manifest.updated_by,
                verified_snapshot_dir=str(snapshot_dir),
            )
            runtime_promoted = True

    cert_verify_resp = None
    if cert_verify is not None:
        cert_verify_resp = {
            "ok": cert_verify.ok,
            "exitCode": cert_verify.exit_code,
            "stdout": cert_verify.stdout,
            "stderr": cert_verify.stderr,
            "durationMs": cert_verify.duration_ms,
        }

    return KernelPublishSnapshotResponse(
        directory=str(snapshot_dir),
        manifest=_manifest_to_response(draft.manifest),
        files={key: str(path) for key, path in files.items()},
        verifyResult=verify_result,
        runtimePromoted=runtime_promoted,
        certificateGenerated=cert_generated,
        certificateVerifyResult=cert_verify_resp,
    )


@app.post("/api/cohere/verify", response_model=CohereVerifyResponse)
def verify_cohere_artifacts(payload: CohereVerifyRequest) -> CohereVerifyResponse:
    """Verify Cohere JSON artifacts by invoking the cohere-verify CLI."""
    with tempfile.TemporaryDirectory(prefix="cohere-verify-") as tmpdir:
        tmp_path = Path(tmpdir)
        rules_path = tmp_path / "ruleset.json"
        incompat_path = tmp_path / "incompatibility.json"
        infeas_path = tmp_path / "infeasibility.json"
        exclusions_path = tmp_path / "fact_exclusions.json"

        try:
            rules_path.write_text(json.dumps(payload.ruleset), encoding="utf-8")
            incompat_path.write_text(json.dumps(payload.incompatibility), encoding="utf-8")
            infeas_path.write_text(json.dumps(payload.infeasibility), encoding="utf-8")
            fe_data = payload.factExclusions if payload.factExclusions is not None else {"groups": []}
            exclusions_path.write_text(json.dumps(fe_data), encoding="utf-8")
        except OSError as exc:
            raise HTTPException(status_code=500, detail=f"Failed to write temp files: {exc}") from exc

        return _run_verifier(
            [str(rules_path), str(incompat_path), str(infeas_path), str(exclusions_path)],
            payload.timeoutSeconds,
        )
