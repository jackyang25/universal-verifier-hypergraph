"""Pairwise conflict detection for authoring-time rule admission.

Mirrors the Lean definitions in Cohere.Authoring.ConflictDetection:
  - ConflictingRules: same action, conflicting verdict kinds
  - IndependentPremises: neither premise set is a subset of the other
  - GuidedConflict: conflicting + independent (not resolvable by specificity)
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from src.hypergraph.hyperedges import Hyperedge

_VERDICT_RE = re.compile(r"^(Obligated|Allowed|Disallowed|Rejected)\((.+)\)$")

_CONFLICTING_KINDS: frozenset[frozenset[str]] = frozenset(
    {
        frozenset({"Obligated", "Rejected"}),
        frozenset({"Allowed", "Rejected"}),
    }
)


@dataclass(frozen=True)
class ParsedVerdict:
    kind: str
    action: str


@dataclass(frozen=True)
class ConflictWarning:
    rule_a_id: str
    rule_b_id: str
    action: str
    verdict_a: str
    verdict_b: str
    resolvable: bool


def parse_verdict(outcome: str) -> ParsedVerdict | None:
    match = _VERDICT_RE.match(outcome.strip())
    if not match:
        return None
    return ParsedVerdict(kind=match.group(1), action=match.group(2).strip())


def _verdicts_conflict(a: ParsedVerdict, b: ParsedVerdict) -> bool:
    return a.action == b.action and frozenset({a.kind, b.kind}) in _CONFLICTING_KINDS


def _specificity_resolves(r1: Hyperedge, r2: Hyperedge) -> bool:
    """True if one rule's premises strictly contain the other's (shadowing applies)."""
    return r1.premises < r2.premises or r2.premises < r1.premises


def detect_conflicts(rules: tuple[Hyperedge, ...] | list[Hyperedge]) -> list[ConflictWarning]:
    """Return all pairwise verdict conflicts in the rule set.

    Each warning notes whether specificity can resolve the conflict.
    Unresolvable conflicts (independent premises) require author intervention.
    """
    parsed = [
        (r, v)
        for r in rules
        if (v := parse_verdict(r.expected_outcome)) is not None
    ]

    warnings: list[ConflictWarning] = []
    for i, (r1, v1) in enumerate(parsed):
        for r2, v2 in parsed[i + 1 :]:
            if not _verdicts_conflict(v1, v2):
                continue
            resolvable = _specificity_resolves(r1, r2)
            warnings.append(
                ConflictWarning(
                    rule_a_id=r1.edge_id,
                    rule_b_id=r2.edge_id,
                    action=v1.action,
                    verdict_a=v1.kind,
                    verdict_b=v2.kind,
                    resolvable=resolvable,
                )
            )
    return warnings
