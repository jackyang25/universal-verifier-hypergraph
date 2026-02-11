from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Hyperedge:
    edge_id: str
    premises: frozenset[str]
    expected_outcome: str
    note: str


# initial hyperedges for runtime matching against normalized ontology facts
HYPEREDGES: tuple[Hyperedge, ...] = (
    Hyperedge(
        edge_id="hg_obligate_immediate_delivery_severe_pe_34",
        premises=frozenset(
            {
                "Dx.Preeclampsia",
                "DxAttr.Preeclampsia.Severe",
                "Ctx.GA_>=34w",
            }
        ),
        expected_outcome="Obligated(Action.ImmediateDelivery)",
        note="Severe preeclampsia at >=34w obligates immediate delivery.",
    ),
    Hyperedge(
        edge_id="hg_obligate_expedited_delivery_placental_abruption",
        premises=frozenset(
            {
                "Dx.PlacentalAbruption",
            }
        ),
        expected_outcome="Obligated(Action.ExpeditedDelivery)",
        note="Placental abruption obligates expedited delivery.",
    ),
    Hyperedge(
        edge_id="hg_allow_expedited_delivery_hypertensive_28",
        premises=frozenset(
            {
                "Dx.HypertensiveDisorder",
                "Ctx.GA_>=28w",
            }
        ),
        expected_outcome="Allowed(Action.ExpeditedDelivery)",
        note="Hypertensive disorder at >=28w permits expedited delivery.",
    ),
    Hyperedge(
        edge_id="hg_allow_expectant_nonsevere_early_window",
        premises=frozenset(
            {
                "Dx.Preeclampsia",
                "Ctx.GA_>=28w",
                "Ctx.MaternalAge_<35y",
            }
        ),
        expected_outcome="Allowed(Action.ExpectantManagement)",
        note="Non-severe early window may allow expectant management.",
    ),
    Hyperedge(
        edge_id="hg_risk_modifier_obesity_hypertensive",
        premises=frozenset(
            {
                "Ctx.BMI_>=30",
                "Dx.HypertensiveDisorder",
            }
        ),
        expected_outcome="RiskMarker(HighRiskTrajectory)",
        note="BMI >=30 with hypertensive disorder flags elevated risk trajectory.",
    ),
)


def match_hyperedges(normalized_facts: list[str] | set[str]) -> list[Hyperedge]:
    fact_set = set(normalized_facts)
    return [edge for edge in HYPEREDGES if edge.premises.issubset(fact_set)]


def derive_expected_outcomes(normalized_facts: list[str] | set[str]) -> list[str]:
    matched_edges = match_hyperedges(normalized_facts)
    outcomes = {edge.expected_outcome for edge in matched_edges}
    return sorted(outcomes)
