from __future__ import annotations

from pydantic import BaseModel, Field, field_validator


class OntologyNormalizeRequest(BaseModel):
    selectedDiagnoses: list[str] = Field(default_factory=list)
    selectedComorbidities: list[str] = Field(default_factory=list)
    selectedPhysiologicStates: list[str] = Field(default_factory=list)
    gestationalWeeks: float = Field(ge=20, le=42)
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


class OntologyMappingResponse(BaseModel):
    sourceGroup: str
    sourceValue: str
    normalizedTokens: list[str]
    ruleExplanations: list[str]


class OntologyNormalizeResponse(BaseModel):
    facts: list[str]
    diagnosisFacts: list[str]
    contextFacts: list[str]
    actionToken: str | None
    mappings: list[OntologyMappingResponse]
