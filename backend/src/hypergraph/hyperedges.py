from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Hyperedge:
    edge_id: str
    premises: frozenset[str]
    expected_outcome: str
    note: str
