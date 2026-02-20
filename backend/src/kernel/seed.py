"""Single source of truth for all kernel seed data.

Defines demo rules, incompatibility pairs, and infeasibility entries
that are loaded into the in-memory store on startup.
"""

from __future__ import annotations

from src.hypergraph.hyperedges import Hyperedge

SEED_RULES: tuple[Hyperedge, ...] = (
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
)

SEED_INCOMPATIBILITY: tuple[dict[str, object], ...] = (
    {
        "a": "Action.ImmediateDelivery",
        "b": "Action.ExpectantManagement",
        "created_by": "system",
        "created_at": "seed",
    },
    {
        "a": "Action.ExpeditedDelivery",
        "b": "Action.ExpectantManagement",
        "created_by": "system",
        "created_at": "seed",
    },
)

# Default: every action is feasible. This table encodes exceptions.
# Each entry fires when its premises are a subset of the patient's fact set.
SEED_INFEASIBILITY: tuple[dict[str, object], ...] = (
    {
        "action": "Action.ExpectantManagement",
        "premises": ["Dx.FetalDemise"],
        "created_by": "system",
        "created_at": "seed",
    },
    {
        "action": "Action.ExpectantManagement",
        "premises": ["DxAttr.Preeclampsia.Severe"],
        "created_by": "system",
        "created_at": "seed",
    },
    {
        "action": "Action.ImmediateDelivery",
        "premises": ["Ctx.GA_<34w"],
        "created_by": "system",
        "created_at": "seed",
    },
)

SEED_FACT_EXCLUSIONS: tuple[dict[str, object], ...] = (
    {
        "facts": ["Ctx.GA_<34w", "Ctx.GA_>=34w"],
        "created_by": "system",
        "created_at": "seed",
    },
)

SEED_MANIFEST_DEFAULTS = {
    "artifact_source": "in_memory",
    "ruleset_version": "local-session",
    "change_summary": "Seed demo ruleset (pending draft baseline).",
}
