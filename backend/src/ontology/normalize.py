from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class DiagnosisInputDefinition:
    label: str
    diagnosis_token: str
    diagnosis_attribute_by_id: dict[str, tuple[str, str]]


@dataclass(frozen=True)
class InputDefinition:
    label: str
    token: str


FRONTEND_DIAGNOSES = {
    "dx_acute_fatty_liver_pregnancy": DiagnosisInputDefinition(
        label="Acute Fatty Liver of Pregnancy",
        diagnosis_token="Dx.AcuteFattyLiverOfPregnancy",
        diagnosis_attribute_by_id={},
    ),
    "dx_asthma": DiagnosisInputDefinition(
        label="Asthma",
        diagnosis_token="Dx.Asthma",
        diagnosis_attribute_by_id={},
    ),
    "dx_eclampsia": DiagnosisInputDefinition(
        label="Eclampsia",
        diagnosis_token="Dx.Eclampsia",
        diagnosis_attribute_by_id={},
    ),
    "dx_gestational_hypertension": DiagnosisInputDefinition(
        label="Gestational Hypertension",
        diagnosis_token="Dx.GestationalHypertension",
        diagnosis_attribute_by_id={},
    ),
    "dx_hellp_syndrome": DiagnosisInputDefinition(
        label="HELLP Syndrome",
        diagnosis_token="Dx.HELLPSyndrome",
        diagnosis_attribute_by_id={},
    ),
    "dx_heart_block": DiagnosisInputDefinition(
        label="Heart Block",
        diagnosis_token="Dx.HeartBlock",
        diagnosis_attribute_by_id={},
    ),
    "dx_heart_failure": DiagnosisInputDefinition(
        label="Heart Failure",
        diagnosis_token="Dx.HeartFailure",
        diagnosis_attribute_by_id={},
    ),
    "dx_placenta_previa": DiagnosisInputDefinition(
        label="Placenta Previa",
        diagnosis_token="Dx.PlacentaPrevia",
        diagnosis_attribute_by_id={},
    ),
    "dx_placental_abruption": DiagnosisInputDefinition(
        label="Placental Abruption",
        diagnosis_token="Dx.PlacentalAbruption",
        diagnosis_attribute_by_id={},
    ),
    "dx_preeclampsia": DiagnosisInputDefinition(
        label="Preeclampsia",
        diagnosis_token="Dx.Preeclampsia",
        diagnosis_attribute_by_id={
            "severe_features": ("DxAttr.Preeclampsia.Severe", "Severe")
        },
    ),
}

FRONTEND_COMORBIDITIES = {
    "ctx_multiple_gestation": InputDefinition(
        label="Multiple Gestation",
        token="Ctx.MultipleGestation",
    ),
    "ctx_prior_cesarean_delivery": InputDefinition(
        label="Prior Cesarean Delivery",
        token="Ctx.PriorCesareanDelivery",
    ),
    "ctx_family_history_hypertensive_disorders": InputDefinition(
        label="Family History of Hypertensive Disorders",
        token="Ctx.FamilyHxHypertensiveDisorders",
    ),
    "ctx_chronic_hypertension": InputDefinition(
        label="Chronic Hypertension",
        token="Ctx.ChronicHypertension",
    ),
    "ctx_preexisting_diabetes": InputDefinition(
        label="Preexisting Diabetes",
        token="Ctx.PreexistingDiabetes",
    ),
}

FRONTEND_PHYSIOLOGIC_STATES = {
    "ctx_sbp_160": InputDefinition(label="Systolic BP >= 160 mmHg", token="Ctx.SBP_>=160mmHg"),
    "ctx_dbp_110": InputDefinition(label="Diastolic BP >= 110 mmHg", token="Ctx.DBP_>=110mmHg"),
    "ctx_proteinuria": InputDefinition(label="Proteinuria", token="Ctx.Proteinuria"),
    "ctx_platelets_lt_100k": InputDefinition(label="Platelets < 100k", token="Ctx.Platelets_<100k"),
    "ctx_ast_alt_elevated": InputDefinition(label="AST/ALT Elevated", token="Ctx.AST_ALT_Elevated"),
    "ctx_breastfeeding": InputDefinition(label="Breastfeeding", token="Ctx.Breastfeeding"),
    "ctx_creatinine_elevated": InputDefinition(label="Elevated Creatinine", token="Ctx.Creatinine_Elevated"),
    "ctx_postpartum": InputDefinition(label="Postpartum", token="Ctx.Postpartum"),
    "ctx_headache": InputDefinition(label="Headache", token="Ctx.Headache"),
    "ctx_severe_headache": InputDefinition(
        label="Headache",
        token="Ctx.Headache",
    ),
    "ctx_visual_disturbance": InputDefinition(label="Visual Disturbance", token="Ctx.VisualDisturbance"),
    "ctx_ruq_pain": InputDefinition(label="RUQ Pain", token="Ctx.RUQPain"),
}

FRONTEND_ACTIONS = {
    "action_expectant_management": InputDefinition(
        label="Expectant Management",
        token="Action.ExpectantManagement",
    ),
    "action_expedited_delivery": InputDefinition(
        label="Expedited Delivery",
        token="Action.ExpeditedDelivery",
    ),
    "action_immediate_delivery": InputDefinition(
        label="Immediate Delivery",
        token="Action.ImmediateDelivery",
    ),
}

DIAGNOSIS_SUPERTYPE_EXPANSIONS = {
    "Dx.Preeclampsia": ("Dx.HypertensiveDisorder",),
    "Dx.GestationalHypertension": ("Dx.HypertensiveDisorder",),
    "Dx.Eclampsia": ("Dx.HypertensiveDisorder",),
    "Dx.HELLPSyndrome": ("Dx.HypertensiveDisorder",),
}

GESTATIONAL_AGE_THRESHOLDS = (20, 28, 34, 37, 42)
MATERNAL_AGE_THRESHOLDS = (35, 40, 45)
BMI_THRESHOLDS = (25, 30, 35, 40)


@dataclass(frozen=True)
class OntologyInput:
    selected_diagnoses: list[str]
    diagnosis_attributes_by_diagnosis: dict[str, list[str]]
    selected_comorbidities: list[str]
    selected_physiologic_states: list[str]
    gestational_weeks: float
    maternal_age_years: float
    bmi: float
    selected_action: str | None


@dataclass(frozen=True)
class OntologyResult:
    facts: list[str]
    diagnosis_facts: list[str]
    diagnosis_attribute_facts: list[str]
    context_facts: list[str]
    action_token: str | None
    mappings: list["OntologyMapping"]


@dataclass(frozen=True)
class OntologyMapping:
    source_group: str
    source_value: str
    normalized_tokens: list[str]
    rule_explanations: list[str]


def _get_group_definitions(
    selected_values: list[str],
    mapping: dict[str, InputDefinition | DiagnosisInputDefinition],
    group_name: str,
) -> list[InputDefinition | DiagnosisInputDefinition]:
    normalized: list[InputDefinition | DiagnosisInputDefinition] = []
    unknown: list[str] = []

    for value_id in selected_values:
        definition = mapping.get(value_id)
        if definition is None:
            unknown.append(value_id)
            continue
        normalized.append(definition)

    if unknown:
        joined = ", ".join(sorted(unknown))
        raise ValueError(f"Unknown {group_name} IDs: {joined}")

    return normalized


def _diagnosis_lineage_with_rules(primary_dx_fact: str) -> tuple[list[str], list[str]]:
    expanded = {primary_dx_fact}
    ordered_tokens = [primary_dx_fact]
    queue = [primary_dx_fact]
    rule_steps = [f"The selected diagnosis maps to canonical token {primary_dx_fact}."]

    while queue:
        current = queue.pop()
        for supertype in DIAGNOSIS_SUPERTYPE_EXPANSIONS.get(current, ()):
            rule_steps.append(
                f"{supertype} is a supertype of {current}, so include {supertype}."
            )
            if supertype in expanded:
                continue
            expanded.add(supertype)
            ordered_tokens.append(supertype)
            queue.append(supertype)

    return ordered_tokens, rule_steps


def _discretize_gestational_age(weeks: float) -> list[str]:
    if weeks < GESTATIONAL_AGE_THRESHOLDS[0] or weeks > GESTATIONAL_AGE_THRESHOLDS[-1]:
        raise ValueError(
            f"Gestational age must be between {GESTATIONAL_AGE_THRESHOLDS[0]} and "
            f"{GESTATIONAL_AGE_THRESHOLDS[-1]} weeks."
        )

    satisfied = [threshold for threshold in GESTATIONAL_AGE_THRESHOLDS if weeks >= threshold]
    if not satisfied:
        return []
    highest = max(satisfied)
    return [f"Ctx.GA_>={highest}w"]


def _discretize_maternal_age(years: float) -> list[str]:
    if years < 15 or years > 55:
        raise ValueError("Maternal age must be between 15 and 55 years.")
    satisfied = [threshold for threshold in MATERNAL_AGE_THRESHOLDS if years >= threshold]
    if not satisfied:
        return [f"Ctx.MaternalAge_<{MATERNAL_AGE_THRESHOLDS[0]}y"]
    highest = max(satisfied)
    return [f"Ctx.MaternalAge_>={highest}y"]


def _discretize_bmi(bmi: float) -> list[str]:
    if bmi < 15 or bmi > 60:
        raise ValueError("BMI must be between 15 and 60.")
    satisfied = [threshold for threshold in BMI_THRESHOLDS if bmi >= threshold]
    if not satisfied:
        return [f"Ctx.BMI_<{BMI_THRESHOLDS[0]}"]
    highest = max(satisfied)
    return [f"Ctx.BMI_>={highest}"]


def normalize_ontology_input(payload: OntologyInput) -> OntologyResult:
    mappings: list[OntologyMapping] = []

    unknown_diagnosis_ids = [
        diagnosis_id
        for diagnosis_id in payload.selected_diagnoses
        if diagnosis_id not in FRONTEND_DIAGNOSES
    ]
    if unknown_diagnosis_ids:
        raise ValueError(
            f"Unknown diagnosis IDs: {', '.join(sorted(unknown_diagnosis_ids))}"
        )

    diagnosis_fact_set: set[str] = set()
    diagnosis_attribute_fact_set: set[str] = set()
    for diagnosis_id in payload.selected_diagnoses:
        diagnosis = FRONTEND_DIAGNOSES[diagnosis_id]
        mapped_tokens, rule_steps = _diagnosis_lineage_with_rules(diagnosis.diagnosis_token)
        diagnosis_fact_set.update(mapped_tokens)
        selected_attribute_ids = payload.diagnosis_attributes_by_diagnosis.get(
            diagnosis_id,
            [],
        )
        unknown_attribute_ids = [
            attribute_id
            for attribute_id in selected_attribute_ids
            if attribute_id not in diagnosis.diagnosis_attribute_by_id
        ]
        if unknown_attribute_ids:
            raise ValueError(
                "Unknown diagnosis attribute IDs for "
                f"{diagnosis.label}: {', '.join(sorted(unknown_attribute_ids))}"
            )
        diagnosis_attribute_tokens = [
            diagnosis.diagnosis_attribute_by_id[attribute_id][0]
            for attribute_id in selected_attribute_ids
        ]
        diagnosis_attribute_labels = [
            diagnosis.diagnosis_attribute_by_id[attribute_id][1]
            for attribute_id in selected_attribute_ids
        ]
        diagnosis_attribute_fact_set.update(diagnosis_attribute_tokens)
        expanded_tokens = mapped_tokens + diagnosis_attribute_tokens
        if diagnosis_attribute_tokens:
            for attribute_token in diagnosis_attribute_tokens:
                rule_steps.append(
                    f"The selected diagnosis also carries diagnosis attribute token {attribute_token}."
                )
        mappings.append(
            OntologyMapping(
                source_group="diagnosis",
                source_value=(
                    f"{diagnosis.label}, {', '.join(diagnosis_attribute_labels)}"
                    if diagnosis_attribute_labels
                    else diagnosis.label
                ),
                normalized_tokens=expanded_tokens,
                rule_explanations=rule_steps,
            )
        )
    diagnosis_facts = sorted(diagnosis_fact_set)
    diagnosis_attribute_facts = sorted(diagnosis_attribute_fact_set)

    selected_comorbidity_definitions = _get_group_definitions(
        selected_values=payload.selected_comorbidities,
        mapping=FRONTEND_COMORBIDITIES,
        group_name="comorbidities",
    )
    comorbidity_facts = [item.token for item in selected_comorbidity_definitions]
    for comorbidity in selected_comorbidity_definitions:
        mappings.append(
            OntologyMapping(
                source_group="comorbidity",
                source_value=comorbidity.label,
                normalized_tokens=[comorbidity.token],
                rule_explanations=[
                    f"The selected comorbidity maps to canonical token {comorbidity.token}."
                ],
            )
        )

    selected_physiologic_definitions = _get_group_definitions(
        selected_values=payload.selected_physiologic_states,
        mapping=FRONTEND_PHYSIOLOGIC_STATES,
        group_name="physiologic states",
    )
    physiologic_facts = [item.token for item in selected_physiologic_definitions]
    for state in selected_physiologic_definitions:
        mappings.append(
            OntologyMapping(
                source_group="physiologic",
                source_value=state.label,
                normalized_tokens=[state.token],
                rule_explanations=[
                    f"The selected physiologic state maps to canonical token {state.token}."
                ],
            )
        )

    ga_facts = _discretize_gestational_age(payload.gestational_weeks)
    maternal_age_facts = _discretize_maternal_age(payload.maternal_age_years)
    bmi_facts = _discretize_bmi(payload.bmi)
    mappings.append(
        OntologyMapping(
            source_group="quantitative",
            source_value=f"Gestational Age: {payload.gestational_weeks:g} weeks",
            normalized_tokens=ga_facts,
            rule_explanations=[
                "Gestational age is validated to be within 20 to 42 weeks.",
                *(
                    [f"Use the highest satisfied threshold token: {ga_facts[0]}."]
                    if ga_facts
                    else ["No gestational age threshold token is added."]
                ),
            ],
        )
    )
    mappings.append(
        OntologyMapping(
            source_group="quantitative",
            source_value=f"Maternal Age: {payload.maternal_age_years:g} years",
            normalized_tokens=maternal_age_facts,
            rule_explanations=[
                "Maternal age is validated to be within 15 to 55 years.",
                f"Use the normalized maternal age token: {maternal_age_facts[0]}.",
            ],
        )
    )
    mappings.append(
        OntologyMapping(
            source_group="quantitative",
            source_value=f"BMI: {payload.bmi:g}",
            normalized_tokens=bmi_facts,
            rule_explanations=[
                "BMI is validated to be within 15 to 60.",
                f"Use the normalized BMI token: {bmi_facts[0]}.",
            ],
        )
    )

    action_token: str | None = None
    if payload.selected_action is not None:
        action_definition = FRONTEND_ACTIONS.get(payload.selected_action)
        if action_definition is None:
            raise ValueError(f"Unknown selected action ID: {payload.selected_action}")
        action_token = action_definition.token
        mappings.append(
            OntologyMapping(
                source_group="action",
                source_value=action_definition.label,
                normalized_tokens=[action_token],
                rule_explanations=[f"The selected action maps to canonical token {action_token}."],
            )
        )

    context_facts = sorted(
        set(
            comorbidity_facts
            + physiologic_facts
            + ga_facts
            + maternal_age_facts
            + bmi_facts
        )
    )
    combined_facts = sorted(set(diagnosis_facts + diagnosis_attribute_facts + context_facts))

    return OntologyResult(
        facts=combined_facts,
        diagnosis_facts=diagnosis_facts,
        diagnosis_attribute_facts=diagnosis_attribute_facts,
        context_facts=context_facts,
        action_token=action_token,
        mappings=mappings,
    )
