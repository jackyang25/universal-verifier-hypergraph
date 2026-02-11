from __future__ import annotations

import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from src.api.schemas import (
    HypergraphCandidateEdgeResponse,
    HypergraphRetrieveRequest,
    HypergraphRetrieveResponse,
    HypergraphVerificationSummaryResponse,
    OntologyMappingResponse,
    OntologyNormalizeRequest,
    OntologyNormalizeResponse,
)
from src.hypergraph.hyperedges import HYPEREDGES
from src.ontology.normalize import OntologyInput, normalize_ontology_input


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


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


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
def retrieve_hypergraph(payload: HypergraphRetrieveRequest) -> HypergraphRetrieveResponse:
    facts = set(payload.facts)
    candidate_edges: list[HypergraphCandidateEdgeResponse] = []

    for edge in HYPEREDGES:
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
