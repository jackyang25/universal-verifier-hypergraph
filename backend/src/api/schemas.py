from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, field_validator


class OntologyNormalizeRequest(BaseModel):
    selectedDiagnoses: list[str] = Field(default_factory=list)
    diagnosisAttributesByDiagnosis: dict[str, list[str]] = Field(default_factory=dict)
    selectedComorbidities: list[str] = Field(default_factory=list)
    selectedPhysiologicStates: list[str] = Field(default_factory=list)
    gestationalWeeks: float = Field(ge=20, le=42)
    maternalAgeYears: float = Field(ge=15, le=55)
    bmi: float = Field(ge=15, le=60)
    selectedAction: str | None = None

    @field_validator(
        "selectedDiagnoses",
        "selectedComorbidities",
        "selectedPhysiologicStates",
        mode="before",
    )
    @classmethod
    def validate_list_values(cls, value: object) -> object:
        if value is None:
            return []
        if not isinstance(value, list):
            raise TypeError("Expected an array of strings.")
        for item in value:
            if not isinstance(item, str):
                raise TypeError("All selected values must be strings.")
        return value

    @field_validator("diagnosisAttributesByDiagnosis", mode="before")
    @classmethod
    def validate_diagnosis_attribute_map(cls, value: object) -> object:
        if value is None:
            return {}
        if not isinstance(value, dict):
            raise TypeError("Expected diagnosisAttributesByDiagnosis to be an object.")
        validated: dict[str, list[str]] = {}
        for key, attributes in value.items():
            if not isinstance(key, str):
                raise TypeError("Diagnosis IDs must be strings.")
            if not isinstance(attributes, list) or not all(
                isinstance(attribute, str) for attribute in attributes
            ):
                raise TypeError("Diagnosis attribute values must be arrays of strings.")
            validated[key] = attributes
        return validated


class OntologyMappingResponse(BaseModel):
    sourceGroup: str
    sourceValue: str
    normalizedTokens: list[str]
    ruleExplanations: list[str]


class OntologyNormalizeResponse(BaseModel):
    facts: list[str]
    diagnosisFacts: list[str]
    diagnosisAttributeFacts: list[str]
    contextFacts: list[str]
    actionToken: str | None
    mappings: list[OntologyMappingResponse]


class HypergraphRetrieveRequest(BaseModel):
    facts: list[str] = Field(default_factory=list)
    proposedActionToken: str | None = None

    @field_validator("facts", mode="before")
    @classmethod
    def validate_facts(cls, value: object) -> object:
        if value is None:
            return []
        if not isinstance(value, list):
            raise TypeError("Expected facts to be an array of strings.")
        for item in value:
            if not isinstance(item, str):
                raise TypeError("All facts must be strings.")
        return value


class HypergraphCandidateEdgeResponse(BaseModel):
    edgeId: str
    premises: list[str]
    expectedOutcome: str
    note: str
    isMatched: bool
    matchingPremises: list[str]
    missingPremises: list[str]


class HypergraphVerificationSummaryResponse(BaseModel):
    proposedActionToken: str
    isSupported: bool
    supportLevel: str
    supportingEdgeIds: list[str]


class HypergraphRetrieveResponse(BaseModel):
    candidateEdgeCount: int
    matchedEdgeCount: int
    derivedOutcomes: list[str]
    candidateEdges: list[HypergraphCandidateEdgeResponse]
    verification: HypergraphVerificationSummaryResponse | None


class KernelRuleResponse(BaseModel):
    ruleId: str
    premises: list[str]
    outcome: str
    note: str
    createdBy: str
    createdAt: str


class KernelRuleInput(BaseModel):
    ruleId: str = Field(min_length=1)
    premises: list[str] = Field(default_factory=list)
    outcome: str = Field(min_length=1)
    note: str = Field(default="")
    createdBy: str = Field(default="anonymous", min_length=1)

    @field_validator("premises", mode="before")
    @classmethod
    def validate_premises(cls, value: object) -> object:
        if value is None:
            return []
        if not isinstance(value, list):
            raise TypeError("Expected premises to be an array of strings.")
        for item in value:
            if not isinstance(item, str):
                raise TypeError("All premises must be strings.")
        return value


class IncompatibilityPairResponse(BaseModel):
    a: str
    b: str
    createdBy: str = ""
    createdAt: str = ""


class IncompatibilityPairInput(BaseModel):
    a: str = Field(min_length=1)
    b: str = Field(min_length=1)
    createdBy: str = Field(default="anonymous", min_length=1)


class InfeasibilityEntryResponse(BaseModel):
    action: str
    premises: list[str]
    createdBy: str = ""
    createdAt: str = ""


class InfeasibilityEntryInput(BaseModel):
    action: str = Field(min_length=1)
    premises: list[str] = Field(default_factory=list)
    createdBy: str = Field(default="anonymous", min_length=1)

    @field_validator("premises", mode="before")
    @classmethod
    def validate_premises(cls, value: object) -> object:
        if value is None:
            return []
        if not isinstance(value, list):
            raise TypeError("Expected an array of strings.")
        for item in value:
            if not isinstance(item, str):
                raise TypeError("All facts must be strings.")
        return value


class KernelArtifactManifestResponse(BaseModel):
    artifactSource: str
    rulesetVersion: str
    revision: int
    updatedAt: str
    updatedBy: str
    changeSummary: str


class KernelActiveArtifactsResponse(BaseModel):
    manifest: KernelArtifactManifestResponse
    rulesetRuleCount: int
    ruleset: list[KernelRuleResponse]
    incompatibilityPairCount: int
    incompatibility: list[IncompatibilityPairResponse]
    infeasibilityEntryCount: int
    infeasibility: list[InfeasibilityEntryResponse]
    proofReport: dict[str, Any]


class KernelRuntimeVerificationResponse(BaseModel):
    status: str
    verifiedAt: str | None = None
    verifiedBy: str | None = None
    verifiedSnapshotDir: str | None = None


class KernelRuntimeArtifactsResponse(BaseModel):
    verification: KernelRuntimeVerificationResponse
    manifest: KernelArtifactManifestResponse | None = None
    rulesetRuleCount: int
    ruleset: list[KernelRuleResponse]
    incompatibilityPairCount: int
    incompatibility: list[IncompatibilityPairResponse]
    infeasibilityEntryCount: int
    infeasibility: list[InfeasibilityEntryResponse]
    proofReport: dict[str, Any]


class KernelReplaceRulesetRequest(BaseModel):
    rulesetVersion: str = Field(min_length=1)
    updatedBy: str = Field(default="anonymous", min_length=1)
    changeSummary: str = Field(default="")
    ruleset: list[KernelRuleInput] = Field(default_factory=list)


class KernelPublishSnapshotRequest(BaseModel):
    verify: bool = False
    timeoutSeconds: float = Field(default=10.0, ge=0.1, le=120.0)


class KernelPublishSnapshotResponse(BaseModel):
    directory: str
    manifest: KernelArtifactManifestResponse
    files: dict[str, str]
    verifyResult: CohereVerifyResponse | None = None
    runtimePromoted: bool = False


class CohereVerifyRequest(BaseModel):
    ruleset: dict[str, Any]
    incompatibility: dict[str, Any]
    infeasibility: dict[str, Any]
    timeoutSeconds: float = Field(default=10.0, ge=0.1, le=120.0)


class CohereVerifyResponse(BaseModel):
    ok: bool
    exitCode: int
    durationMs: int
    stdout: str
    stderr: str
