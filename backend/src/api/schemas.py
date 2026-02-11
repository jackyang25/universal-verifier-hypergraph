from __future__ import annotations

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
