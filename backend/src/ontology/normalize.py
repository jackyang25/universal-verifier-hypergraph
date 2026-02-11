from __future__ import annotations

from dataclasses import dataclass


FRONTEND_DIAGNOSES = {
    "Acute Fatty Liver of Pregnancy": "Dx.AcuteFattyLiverOfPregnancy",
    "Asthma": "Dx.Asthma",
    "Eclampsia": "Dx.Eclampsia",
    "Gestational Hypertension": "Dx.GestationalHypertension",
    "HELLP Syndrome": "Dx.HELLPSyndrome",
    "Heart Block": "Dx.HeartBlock",
    "Heart Failure": "Dx.HeartFailure",
    "Placenta Previa": "Dx.PlacentaPrevia",
    "Placental Abruption": "Dx.PlacentalAbruption",
    "Preeclampsia": "Dx.Preeclampsia",
    "Severe Preeclampsia": "Dx.SeverePreeclampsia",
}

FRONTEND_COMORBIDITIES = {
    "Advanced Maternal Age (>= 35 years)": "Ctx.AdvancedMaternalAge_>=35y",
    "Multiple Gestation": "Ctx.MultipleGestation",
    "Prior Cesarean Delivery": "Ctx.PriorCesareanDelivery",
    "BMI >= 35": "Ctx.BMI_>=35",
    "Family History of Hypertensive Disorders": "Ctx.FamilyHxHypertensiveDisorders",
    "Chronic Hypertension": "Ctx.ChronicHypertension",
    "Preexisting Diabetes": "Ctx.PreexistingDiabetes",
}

FRONTEND_PHYSIOLOGIC_STATES = {
    "Systolic BP >= 160 mmHg": "Ctx.SBP_>=160mmHg",
    "Diastolic BP >= 110 mmHg": "Ctx.DBP_>=110mmHg",
    "Proteinuria": "Ctx.Proteinuria",
    "Platelets < 100k": "Ctx.Platelets_<100k",
    "AST/ALT Elevated": "Ctx.AST_ALT_Elevated",
    "Breastfeeding": "Ctx.Breastfeeding",
    "Elevated Creatinine": "Ctx.Creatinine_Elevated",
    "Postpartum": "Ctx.Postpartum",
    "Severe Headache": "Ctx.SevereHeadache",
    "Visual Disturbance": "Ctx.VisualDisturbance",
    "RUQ Pain": "Ctx.RUQPain",
}

FRONTEND_ACTIONS = {
    "Expectant Management": "Action.ExpectantManagement",
    "Expedited Delivery": "Action.ExpeditedDelivery",
    "Immediate Delivery": "Action.ImmediateDelivery",
}

DIAGNOSIS_SUPERTYPE_EXPANSIONS = {
    "Dx.SeverePreeclampsia": ("Dx.Preeclampsia",),
    "Dx.Preeclampsia": ("Dx.HypertensiveDisorder",),
    "Dx.GestationalHypertension": ("Dx.HypertensiveDisorder",),
    "Dx.Eclampsia": ("Dx.HypertensiveDisorder",),
    "Dx.HELLPSyndrome": ("Dx.HypertensiveDisorder",),
}

GESTATIONAL_AGE_THRESHOLDS = (20, 28, 34, 37, 42)


@dataclass(frozen=True)
class OntologyInput:
    selected_diagnoses: list[str]
    selected_comorbidities: list[str]
    selected_physiologic_states: list[str]
    gestational_weeks: float
    selected_action: str | None


@dataclass(frozen=True)
class OntologyResult:
    facts: list[str]
    diagnosis_facts: list[str]
    context_facts: list[str]
    action_token: str | None
    mappings: list["OntologyMapping"]


@dataclass(frozen=True)
class OntologyMapping:
    source_group: str
    source_value: str
    normalized_tokens: list[str]
    rule_explanations: list[str]


def _normalize_group(
    selected_values: list[str],
    mapping: dict[str, str],
    group_name: str,
) -> list[str]:
    normalized: list[str] = []
    unknown: list[str] = []

    for raw in selected_values:
        token = mapping.get(raw)
        if token is None:
            unknown.append(raw)
            continue
        normalized.append(token)

    if unknown:
        joined = ", ".join(sorted(unknown))
        raise ValueError(f"Unknown {group_name}: {joined}")

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

    return [f"Ctx.GA_>={threshold}w" for threshold in GESTATIONAL_AGE_THRESHOLDS if weeks >= threshold]


def normalize_ontology_input(payload: OntologyInput) -> OntologyResult:
    mappings: list[OntologyMapping] = []

    primary_diagnosis_facts = _normalize_group(
        selected_values=payload.selected_diagnoses, mapping=FRONTEND_DIAGNOSES, group_name="diagnoses"
    )
    diagnosis_fact_set: set[str] = set()
    for index, raw_diagnosis in enumerate(payload.selected_diagnoses):
        primary_token = primary_diagnosis_facts[index]
        mapped_tokens, rule_steps = _diagnosis_lineage_with_rules(primary_token)
        diagnosis_fact_set.update(mapped_tokens)
        mappings.append(
            OntologyMapping(
                source_group="diagnosis",
                source_value=raw_diagnosis,
                normalized_tokens=mapped_tokens,
                rule_explanations=rule_steps,
            )
        )
    diagnosis_facts = sorted(diagnosis_fact_set)

    comorbidity_facts = _normalize_group(
        selected_values=payload.selected_comorbidities, mapping=FRONTEND_COMORBIDITIES, group_name="comorbidities"
    )
    for index, raw_comorbidity in enumerate(payload.selected_comorbidities):
        mappings.append(
            OntologyMapping(
                source_group="comorbidity",
                source_value=raw_comorbidity,
                normalized_tokens=[comorbidity_facts[index]],
                rule_explanations=[
                    f"The selected comorbidity maps to canonical token {comorbidity_facts[index]}."
                ],
            )
        )

    physiologic_facts = _normalize_group(
        selected_values=payload.selected_physiologic_states,
        mapping=FRONTEND_PHYSIOLOGIC_STATES,
        group_name="physiologic states",
    )
    for index, raw_state in enumerate(payload.selected_physiologic_states):
        mappings.append(
            OntologyMapping(
                source_group="physiologic",
                source_value=raw_state,
                normalized_tokens=[physiologic_facts[index]],
                rule_explanations=[
                    f"The selected physiologic state maps to canonical token {physiologic_facts[index]}."
                ],
            )
        )

    ga_facts = _discretize_gestational_age(payload.gestational_weeks)
    mappings.append(
        OntologyMapping(
            source_group="gestational_age",
            source_value=f"{payload.gestational_weeks} weeks",
            normalized_tokens=ga_facts,
            rule_explanations=[
                "Gestational age is validated to be within 20 to 42 weeks.",
                *[
                    f"Because gestational age is at least {threshold} weeks, include Ctx.GA_>={threshold}w."
                    for threshold in GESTATIONAL_AGE_THRESHOLDS
                    if payload.gestational_weeks >= threshold
                ],
            ],
        )
    )

    action_token: str | None = None
    if payload.selected_action is not None:
        action_token = FRONTEND_ACTIONS.get(payload.selected_action)
        if action_token is None:
            raise ValueError(f"Unknown selected action: {payload.selected_action}")
        mappings.append(
            OntologyMapping(
                source_group="action",
                source_value=payload.selected_action,
                normalized_tokens=[action_token],
                rule_explanations=[f"The selected action maps to canonical token {action_token}."],
            )
        )

    context_facts = sorted(set(comorbidity_facts + physiologic_facts + ga_facts))
    combined_facts = sorted(set(diagnosis_facts + context_facts))

    return OntologyResult(
        facts=combined_facts,
        diagnosis_facts=diagnosis_facts,
        context_facts=context_facts,
        action_token=action_token,
        mappings=mappings,
    )
