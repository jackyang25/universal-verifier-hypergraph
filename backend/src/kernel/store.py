from __future__ import annotations

import time
from dataclasses import dataclass
from datetime import datetime, timezone
from threading import Lock

from src.hypergraph.hyperedges import Hyperedge
from src.kernel.seed import (
    SEED_FACT_EXCLUSIONS,
    SEED_INCOMPATIBILITY,
    SEED_INFEASIBILITY,
    SEED_MANIFEST_DEFAULTS,
    SEED_RULES,
)


@dataclass(frozen=True)
class KernelArtifactManifest:
    """Lightweight metadata about the currently active artifact bundle."""

    artifact_source: str
    ruleset_version: str
    revision: int
    updated_at: datetime
    updated_by: str
    change_summary: str


@dataclass(frozen=True)
class RuleProvenance:
    created_by: str
    created_at: datetime


@dataclass(frozen=True)
class KernelArtifactBundle:
    """In-memory representation of the kernel's versioned artifacts."""

    manifest: KernelArtifactManifest
    ruleset: tuple[Hyperedge, ...]
    rule_provenance: dict[str, RuleProvenance]
    incompatibility: tuple[dict[str, object], ...]
    infeasibility: tuple[dict[str, object], ...]
    fact_exclusions: tuple[dict[str, object], ...]
    proof_report: dict[str, object]


@dataclass(frozen=True)
class KernelVerificationStatus:
    status: str  # "unverified" | "verified" | "error" | "n/a"
    verified_at: datetime | None = None
    verified_by: str | None = None
    verified_snapshot_dir: str | None = None


@dataclass(frozen=True)
class KernelDraftProposals:
    """Pending changes to be merged into the verified runtime ruleset."""

    manifest: KernelArtifactManifest
    proposals: tuple[Hyperedge, ...]
    rule_provenance: dict[str, RuleProvenance]
    incompatibility: tuple[dict[str, object], ...]
    infeasibility: tuple[dict[str, object], ...]
    fact_exclusions: tuple[dict[str, object], ...]


class InMemoryKernelArtifactStore:
    """Fully isolated per-session artifact store.

    Each session gets its own draft, constraints, and runtime -- no shared
    mutable state between sessions.  This avoids stale-override and conflict
    problems while there is no database backing the system.
    """

    def __init__(self) -> None:
        now = datetime.now(timezone.utc)
        self._lock = Lock()
        self._last_accessed = time.monotonic()

        manifest = KernelArtifactManifest(
            artifact_source=SEED_MANIFEST_DEFAULTS["artifact_source"],
            ruleset_version=SEED_MANIFEST_DEFAULTS["ruleset_version"],
            revision=1,
            updated_at=now,
            updated_by="system",
            change_summary=SEED_MANIFEST_DEFAULTS["change_summary"],
        )
        provenance = {
            edge.edge_id: RuleProvenance(created_by="system", created_at=now)
            for edge in SEED_RULES
        }
        self._draft = KernelDraftProposals(
            manifest=manifest,
            proposals=SEED_RULES,
            rule_provenance=provenance,
            incompatibility=SEED_INCOMPATIBILITY,
            infeasibility=SEED_INFEASIBILITY,
            fact_exclusions=SEED_FACT_EXCLUSIONS,
        )
        self._runtime_bundle: KernelArtifactBundle | None = None
        self._runtime_verification = KernelVerificationStatus(status="unverified")

    @property
    def last_accessed(self) -> float:
        return self._last_accessed

    def touch(self) -> None:
        self._last_accessed = time.monotonic()

    def get_draft(self) -> KernelDraftProposals:
        with self._lock:
            self.touch()
            return self._draft

    def get_runtime_bundle(self) -> KernelArtifactBundle | None:
        with self._lock:
            self.touch()
            return self._runtime_bundle

    def get_runtime_verification(self) -> KernelVerificationStatus:
        with self._lock:
            self.touch()
            return self._runtime_verification

    def get_runtime_ruleset(self) -> tuple[Hyperedge, ...]:
        with self._lock:
            self.touch()
            return self._runtime_bundle.ruleset if self._runtime_bundle is not None else tuple()

    def replace_draft_proposals(
        self,
        *,
        ruleset_version: str,
        updated_by: str,
        change_summary: str,
        rules: list[Hyperedge],
    ) -> KernelDraftProposals:
        with self._lock:
            self.touch()
            now = datetime.now(timezone.utc)
            previous_provenance = dict(self._draft.rule_provenance)
            next_provenance: dict[str, RuleProvenance] = {}
            for edge in rules:
                existing = previous_provenance.get(edge.edge_id)
                next_provenance[edge.edge_id] = (
                    existing
                    if existing is not None
                    else RuleProvenance(created_by=updated_by, created_at=now)
                )

            manifest = KernelArtifactManifest(
                artifact_source=self._draft.manifest.artifact_source,
                ruleset_version=ruleset_version,
                revision=self._draft.manifest.revision + 1,
                updated_at=now,
                updated_by=updated_by,
                change_summary=change_summary,
            )
            self._draft = KernelDraftProposals(
                manifest=manifest,
                proposals=tuple(rules),
                rule_provenance=next_provenance,
                incompatibility=self._draft.incompatibility,
                infeasibility=self._draft.infeasibility,
                fact_exclusions=self._draft.fact_exclusions,
            )
            return self._draft

    def build_candidate_runtime_bundle(self) -> KernelArtifactBundle:
        with self._lock:
            self.touch()
            return self._build_candidate_unlocked()

    def _build_candidate_unlocked(self) -> KernelArtifactBundle:
        """Merge verified runtime rules with draft proposals (draft overrides by ruleId)."""

        runtime = self._runtime_bundle
        base_rules = list(runtime.ruleset) if runtime is not None else []
        base_prov = dict(runtime.rule_provenance) if runtime is not None else {}

        proposal_map = {edge.edge_id: edge for edge in self._draft.proposals}
        merged_map = {edge.edge_id: edge for edge in base_rules}
        merged_map.update(proposal_map)

        merged_rules = [merged_map[key] for key in sorted(merged_map)]
        merged_prov = base_prov
        merged_prov.update(self._draft.rule_provenance)

        incompatibility = self._draft.incompatibility or (
            runtime.incompatibility if runtime is not None else ()
        )
        infeasibility = self._draft.infeasibility or (
            runtime.infeasibility if runtime is not None else ()
        )
        fact_exclusions = self._draft.fact_exclusions or (
            runtime.fact_exclusions if runtime is not None else ()
        )

        return KernelArtifactBundle(
            manifest=self._draft.manifest,
            ruleset=tuple(merged_rules),
            rule_provenance=merged_prov,
            incompatibility=incompatibility,
            infeasibility=infeasibility,
            fact_exclusions=fact_exclusions,
            proof_report={
                "status": "preview",
                "notes": "Candidate bundle built from runtime + draft proposals.",
            },
        )

    # -- incompatibility mutations ------------------------------------------------

    def add_incompatibility_pair(self, *, a: str, b: str, created_by: str) -> KernelDraftProposals:
        with self._lock:
            self.touch()
            for existing in self._draft.incompatibility:
                ea, eb = existing["a"], existing["b"]
                if (ea == a and eb == b) or (ea == b and eb == a):
                    raise ValueError(f"Incompatibility pair already exists: ({a}, {b})")
            now = datetime.now(timezone.utc)
            entry: dict[str, object] = {
                "a": a, "b": b,
                "created_by": created_by, "created_at": now.isoformat(),
            }
            self._draft = self._mutated_draft(
                updated_by=created_by,
                change_summary=f"Added incompatibility pair: ({a}, {b})",
                incompatibility=self._draft.incompatibility + (entry,),
            )
            return self._draft

    def update_incompatibility_pair(
        self, *, index: int, a: str, b: str, updated_by: str
    ) -> KernelDraftProposals:
        with self._lock:
            self.touch()
            pairs = list(self._draft.incompatibility)
            if index < 0 or index >= len(pairs):
                raise IndexError(f"Incompatibility pair index {index} out of range (0..{len(pairs) - 1}).")
            old = pairs[index]
            pairs[index] = {
                "a": a, "b": b,
                "created_by": old.get("created_by", updated_by),
                "created_at": old.get("created_at", datetime.now(timezone.utc).isoformat()),
            }
            self._draft = self._mutated_draft(
                updated_by=updated_by,
                change_summary=f"Updated incompatibility pair at index {index}: ({a}, {b})",
                incompatibility=tuple(pairs),
            )
            return self._draft

    def remove_incompatibility_pair(self, *, index: int, updated_by: str) -> KernelDraftProposals:
        with self._lock:
            self.touch()
            pairs = list(self._draft.incompatibility)
            if index < 0 or index >= len(pairs):
                raise IndexError(f"Incompatibility pair index {index} out of range (0..{len(pairs) - 1}).")
            removed = pairs.pop(index)
            self._draft = self._mutated_draft(
                updated_by=updated_by,
                change_summary=f"Removed incompatibility pair: ({removed.get('a', '?')}, {removed.get('b', '?')})",
                incompatibility=tuple(pairs),
            )
            return self._draft

    # -- infeasibility mutations --------------------------------------------------

    def add_infeasibility_entry(
        self, *, action: str, premises: list[str], created_by: str
    ) -> KernelDraftProposals:
        with self._lock:
            self.touch()
            now = datetime.now(timezone.utc)
            entry: dict[str, object] = {
                "action": action, "premises": premises,
                "created_by": created_by, "created_at": now.isoformat(),
            }
            self._draft = self._mutated_draft(
                updated_by=created_by,
                change_summary=f"Added infeasibility entry: {action} with premises {premises}",
                infeasibility=self._draft.infeasibility + (entry,),
            )
            return self._draft

    def update_infeasibility_entry(
        self, *, index: int, action: str, premises: list[str], updated_by: str
    ) -> KernelDraftProposals:
        with self._lock:
            self.touch()
            entries = list(self._draft.infeasibility)
            if index < 0 or index >= len(entries):
                raise IndexError(f"Infeasibility entry index {index} out of range (0..{len(entries) - 1}).")
            old = entries[index]
            entries[index] = {
                "action": action, "premises": premises,
                "created_by": old.get("created_by", updated_by),
                "created_at": old.get("created_at", datetime.now(timezone.utc).isoformat()),
            }
            self._draft = self._mutated_draft(
                updated_by=updated_by,
                change_summary=f"Updated infeasibility entry at index {index}: {action}",
                infeasibility=tuple(entries),
            )
            return self._draft

    def remove_infeasibility_entry(self, *, index: int, updated_by: str) -> KernelDraftProposals:
        with self._lock:
            self.touch()
            entries = list(self._draft.infeasibility)
            if index < 0 or index >= len(entries):
                raise IndexError(f"Infeasibility entry index {index} out of range (0..{len(entries) - 1}).")
            removed = entries.pop(index)
            self._draft = self._mutated_draft(
                updated_by=updated_by,
                change_summary=f"Removed infeasibility entry for action: {removed.get('action', '?')}",
                infeasibility=tuple(entries),
            )
            return self._draft

    # -- fact exclusion mutations --------------------------------------------------

    def add_fact_exclusion(
        self, *, facts: list[str], created_by: str
    ) -> KernelDraftProposals:
        with self._lock:
            self.touch()
            fact_set = frozenset(facts)
            for existing in self._draft.fact_exclusions:
                if frozenset(existing.get("facts", [])) == fact_set:
                    raise ValueError(f"Fact exclusion group already exists: {facts}")
            now = datetime.now(timezone.utc)
            entry: dict[str, object] = {
                "facts": facts,
                "created_by": created_by,
                "created_at": now.isoformat(),
            }
            self._draft = self._mutated_draft(
                updated_by=created_by,
                change_summary=f"Added fact exclusion group: {facts}",
                fact_exclusions=self._draft.fact_exclusions + (entry,),
            )
            return self._draft

    def remove_fact_exclusion(self, *, index: int, updated_by: str) -> KernelDraftProposals:
        with self._lock:
            self.touch()
            groups = list(self._draft.fact_exclusions)
            if index < 0 or index >= len(groups):
                raise IndexError(f"Fact exclusion index {index} out of range (0..{len(groups) - 1}).")
            removed = groups.pop(index)
            self._draft = self._mutated_draft(
                updated_by=updated_by,
                change_summary=f"Removed fact exclusion group: {removed.get('facts', '?')}",
                fact_exclusions=tuple(groups),
            )
            return self._draft

    # -- rule mutations -----------------------------------------------------------

    def add_rule(
        self, *, edge: Hyperedge, created_by: str,
    ) -> KernelDraftProposals:
        with self._lock:
            self.touch()
            for existing in self._draft.proposals:
                if existing.edge_id == edge.edge_id:
                    raise ValueError(f"Rule with id '{edge.edge_id}' already exists in draft.")

            now = datetime.now(timezone.utc)
            provenance = dict(self._draft.rule_provenance)
            provenance[edge.edge_id] = RuleProvenance(created_by=created_by, created_at=now)
            self._draft = self._mutated_draft(
                updated_by=created_by,
                change_summary=f"Added rule: {edge.edge_id}",
                proposals=self._draft.proposals + (edge,),
                rule_provenance=provenance,
            )
            return self._draft

    def update_rule(
        self, *, rule_id: str, edge: Hyperedge, updated_by: str,
    ) -> KernelDraftProposals:
        with self._lock:
            self.touch()
            proposals = list(self._draft.proposals)
            found = False
            for i, existing in enumerate(proposals):
                if existing.edge_id == rule_id:
                    proposals[i] = edge
                    found = True
                    break
            if not found:
                raise KeyError(f"Rule with id '{rule_id}' not found in draft.")

            provenance = dict(self._draft.rule_provenance)
            old = provenance.pop(rule_id, None)
            provenance[edge.edge_id] = old or RuleProvenance(created_by=updated_by, created_at=datetime.now(timezone.utc))

            self._draft = self._mutated_draft(
                updated_by=updated_by,
                change_summary=f"Updated rule: {rule_id}",
                proposals=tuple(proposals),
                rule_provenance=provenance,
            )
            return self._draft

    def remove_rule(self, *, rule_id: str, updated_by: str) -> KernelDraftProposals:
        with self._lock:
            self.touch()
            proposals = [e for e in self._draft.proposals if e.edge_id != rule_id]
            if len(proposals) == len(self._draft.proposals):
                raise KeyError(f"Rule with id '{rule_id}' not found in draft.")
            provenance = dict(self._draft.rule_provenance)
            provenance.pop(rule_id, None)
            self._draft = self._mutated_draft(
                updated_by=updated_by,
                change_summary=f"Removed rule: {rule_id}",
                proposals=tuple(proposals),
                rule_provenance=provenance,
            )
            return self._draft

    # -- internal helpers --------------------------------------------------------

    def _mutated_draft(
        self,
        *,
        updated_by: str,
        change_summary: str,
        proposals: tuple[Hyperedge, ...] | None = None,
        rule_provenance: dict[str, RuleProvenance] | None = None,
        incompatibility: tuple[dict[str, object], ...] | None = None,
        infeasibility: tuple[dict[str, object], ...] | None = None,
        fact_exclusions: tuple[dict[str, object], ...] | None = None,
    ) -> KernelDraftProposals:
        """Return a new draft with bumped revision. Must be called under self._lock."""
        now = datetime.now(timezone.utc)
        manifest = KernelArtifactManifest(
            artifact_source=self._draft.manifest.artifact_source,
            ruleset_version=self._draft.manifest.ruleset_version,
            revision=self._draft.manifest.revision + 1,
            updated_at=now,
            updated_by=updated_by,
            change_summary=change_summary,
        )
        return KernelDraftProposals(
            manifest=manifest,
            proposals=proposals if proposals is not None else self._draft.proposals,
            rule_provenance=rule_provenance if rule_provenance is not None else self._draft.rule_provenance,
            incompatibility=incompatibility if incompatibility is not None else self._draft.incompatibility,
            infeasibility=infeasibility if infeasibility is not None else self._draft.infeasibility,
            fact_exclusions=fact_exclusions if fact_exclusions is not None else self._draft.fact_exclusions,
        )

    def promote_candidate_to_runtime(
        self,
        *,
        verified_by: str,
        verified_snapshot_dir: str | None,
        verified_at: datetime | None = None,
    ) -> None:
        with self._lock:
            self.touch()
            now = verified_at or datetime.now(timezone.utc)
            candidate = self._build_candidate_unlocked()
            self._runtime_bundle = candidate
            self._runtime_verification = KernelVerificationStatus(
                status="verified",
                verified_at=now,
                verified_by=verified_by,
                verified_snapshot_dir=verified_snapshot_dir,
            )
            self._draft = KernelDraftProposals(
                manifest=KernelArtifactManifest(
                    artifact_source=self._draft.manifest.artifact_source,
                    ruleset_version=self._draft.manifest.ruleset_version,
                    revision=self._draft.manifest.revision,
                    updated_at=now,
                    updated_by="system",
                    change_summary="No pending rule proposals. Constraints carried forward.",
                ),
                proposals=tuple(),
                rule_provenance={},
                incompatibility=self._draft.incompatibility,
                infeasibility=self._draft.infeasibility,
                fact_exclusions=self._draft.fact_exclusions,
            )


# ---------------------------------------------------------------------------
# Session manager (maps session IDs to fully isolated per-session stores)
# ---------------------------------------------------------------------------


class SessionManager:
    """Maps session IDs to per-session stores with TTL-based cleanup.

    Each session gets a fully isolated InMemoryKernelArtifactStore -- its own
    draft, constraints, and verified runtime.  No shared mutable state.
    """

    DEFAULT_TTL_SECONDS = 7200.0  # 2 hours

    def __init__(self, ttl_seconds: float = DEFAULT_TTL_SECONDS) -> None:
        self._sessions: dict[str, InMemoryKernelArtifactStore] = {}
        self._lock = Lock()
        self._ttl = ttl_seconds

    @property
    def active_session_count(self) -> int:
        with self._lock:
            return len(self._sessions)

    def get_or_create(self, session_id: str) -> InMemoryKernelArtifactStore:
        with self._lock:
            self._cleanup_expired()
            if session_id in self._sessions:
                self._sessions[session_id].touch()
            else:
                self._sessions[session_id] = InMemoryKernelArtifactStore()
            return self._sessions[session_id]

    def _cleanup_expired(self) -> None:
        now = time.monotonic()
        expired = [
            sid for sid, store in self._sessions.items()
            if now - store.last_accessed > self._ttl
        ]
        for sid in expired:
            del self._sessions[sid]


SESSION_MANAGER = SessionManager()
