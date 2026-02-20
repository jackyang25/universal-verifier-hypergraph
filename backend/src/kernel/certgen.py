"""Generate a Lean 4 proof certificate for a published ruleset snapshot.

The generated `.lean` file embeds the concrete ruleset, incompatibility,
infeasibility, and fact exclusion data as Lean definitions, then proves
the three kernel invariants hold for all valid fact subsets using
`native_decide`.

Compiling the generated file with Lean's kernel is the verification step.
If compilation succeeds, the `.olean` output is a machine-checkable proof
certificate that can be independently verified by anyone with Lean 4.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path


def _lean_str(s: str) -> str:
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


def _lean_str_list(items: list[str]) -> str:
    if not items:
        return "[]"
    inner = ", ".join(_lean_str(s) for s in items)
    return f"[{inner}]"


def _verdict_constructor(kind: str) -> str:
    mapping = {
        "Obligated": ".Obligated",
        "Allowed": ".Allowed",
        "Disallowed": ".Disallowed",
        "Rejected": ".Rejected",
    }
    ctor = mapping.get(kind)
    if ctor is None:
        raise ValueError(f"Unknown verdict kind: {kind}")
    return ctor


def generate_certificate_lean(
    ruleset_path: Path,
    incompatibility_path: Path,
    infeasibility_path: Path,
    fact_exclusions_path: Path | None = None,
) -> str:
    """Return the contents of a Lean 4 proof certificate file."""

    with open(ruleset_path, encoding="utf-8") as f:
        ruleset = json.load(f)
    with open(incompatibility_path, encoding="utf-8") as f:
        incompat = json.load(f)
    with open(infeasibility_path, encoding="utf-8") as f:
        infeas = json.load(f)
    exclusion_groups: list[list[str]] = []
    if fact_exclusions_path is not None:
        with open(fact_exclusions_path, encoding="utf-8") as f:
            fe_data = json.load(f)
        exclusion_groups = [g["facts"] for g in fe_data.get("groups", []) if isinstance(g.get("facts"), list)]

    rules = ruleset.get("rules", [])
    actions = ruleset.get("actions", [])
    facts = ruleset.get("facts", [])
    version = ruleset.get("version", "unknown")
    domain = ruleset.get("domain", "unknown")
    pairs = incompat.get("pairs", [])
    entries = infeas.get("entries", [])

    lines: list[str] = []

    def emit(s: str = "") -> None:
        lines.append(s)

    emit("/-")
    emit(f"  Proof certificate for ruleset: {domain} v{version}")
    emit(f"  Facts: {len(facts)}, Actions: {len(actions)}, Rules: {len(rules)}")
    emit(f"  Incompatibility pairs: {len(pairs)}, Infeasibility entries: {len(entries)}, Exclusion groups: {len(exclusion_groups)}")
    emit()
    emit("  This file is auto-generated. Compiling it with Lean 4 constitutes")
    emit("  verification: if `lake env lean certificate.lean` succeeds, the three")
    emit("  kernel invariants hold for ALL 2^N subsets of the fact universe.")
    emit("-/")
    emit("import Cohere.Runtime.Verifier")
    emit("import Cohere.Runtime.InvariantChecks")
    emit("import Cohere.Runtime.ActionAlgebraB")
    emit("import Cohere.Runtime.FactConstraintsB")
    emit("import Cohere.Runtime.BoolUtils")
    emit()
    emit("open Cohere.Runtime")
    emit("open Cohere.Types")
    emit()

    # -- Rules --
    emit("private def certRules : List (Rule String String) :=")
    if not rules:
        emit("  []")
    else:
        emit("  [", )
        for i, rule in enumerate(rules):
            premises = rule.get("premises", [])
            out = rule.get("out", {})
            kind = out.get("kind", "Allowed")
            action = out.get("action", "")
            ctor = _verdict_constructor(kind)
            comma = "," if i < len(rules) - 1 else ""
            emit(f"    {{ premises := {_lean_str_list(premises)}, out := {ctor} {_lean_str(action)} }}{comma}")
        emit("  ]")
    emit()

    # -- Actions --
    emit(f"private def certActions : List String := {_lean_str_list(actions)}")
    emit()

    # -- Facts --
    emit(f"private def certFacts : List String := {_lean_str_list(facts)}")
    emit()

    # -- ActionAlgebraB (incompatibility) --
    emit("private def certIncompatPairs : List (String × String) :=")
    if not pairs:
        emit("  []")
    else:
        emit("  [", )
        for i, pair in enumerate(pairs):
            comma = "," if i < len(pairs) - 1 else ""
            emit(f"    ({_lean_str(pair['a'])}, {_lean_str(pair['b'])}){comma}")
        emit("  ]")
    emit()

    # -- ActionAlgebraB (infeasibility) --
    emit("private def certInfeasEntries : List (String × List String) :=")
    if not entries:
        emit("  []")
    else:
        emit("  [", )
        for i, entry in enumerate(entries):
            action = entry.get("action", "")
            premises = entry.get("premises", [])
            comma = "," if i < len(entries) - 1 else ""
            emit(f"    ({_lean_str(action)}, {_lean_str_list(premises)}){comma}")
        emit("  ]")
    emit()

    # -- Build the algebra --
    emit("private def certAlgB : ActionAlgebraB String String :=")
    emit("  { Incompatible := fun a b =>")
    emit("      certIncompatPairs.any (fun p => decide ((p.1 = a ∧ p.2 = b) ∨ (p.1 = b ∧ p.2 = a)))")
    emit("    Infeasible := fun a F =>")
    emit("      certInfeasEntries.any (fun e => decide (e.1 = a) && subsetB e.2 F) }")
    emit()

    # -- Fact constraints (exclusion groups) --
    emit("private def certFactConstraints : FactConstraintsB String :=")
    emit("  { exclusionGroups :=")
    if not exclusion_groups:
        emit("      []")
    else:
        emit("      [", )
        for i, group in enumerate(exclusion_groups):
            comma = "," if i < len(exclusion_groups) - 1 else ""
            emit(f"        {_lean_str_list(group)}{comma}")
        emit("      ]")
    emit("  }")
    emit()

    # -- Power set with exclusion filter --
    emit("private def powerset (xs : List α) : List (List α) :=")
    emit("  xs.foldl (fun acc x => acc ++ acc.map (x :: ·)) [[]]")
    emit()
    emit("private def certFactSets : List (List String) :=")
    emit("  (powerset certFacts).filter (fun F => validFactSetB certFactConstraints F)")
    emit()

    # -- Invariant definitions --
    emit("private def certNoContra : Bool :=")
    emit("  certFactSets.all (fun F =>")
    emit("    noContradictionB certActions (derived certRules F))")
    emit()
    emit("private def certNoIncompat : Bool :=")
    emit("  certFactSets.all (fun F =>")
    emit("    noIncompatibleObligationsB certAlgB certActions (derived certRules F))")
    emit()
    emit("private def certOughtCan : Bool :=")
    emit("  certFactSets.all (fun F =>")
    emit("    let D := derived certRules F")
    emit("    oughtImpliesCanB certAlgB certActions F D)")
    emit()

    # -- Proof certificates --
    emit("/-- No contradictory verdicts for any subset of the fact universe. -/")
    emit("theorem cert_no_contradictory_verdicts : certNoContra = true := by native_decide")
    emit()
    emit("/-- No incompatible obligations for any subset of the fact universe. -/")
    emit("theorem cert_no_incompatible_obligations : certNoIncompat = true := by native_decide")
    emit()
    emit("/-- Ought implies can for any subset of the fact universe. -/")
    emit("theorem cert_ought_implies_can : certOughtCan = true := by native_decide")

    return "\n".join(lines) + "\n"


def write_certificate(
    snapshot_dir: Path,
    ruleset_path: Path,
    incompatibility_path: Path,
    infeasibility_path: Path,
    fact_exclusions_path: Path | None = None,
) -> Path:
    """Generate and write the certificate .lean file into the snapshot directory."""
    content = generate_certificate_lean(
        ruleset_path, incompatibility_path, infeasibility_path, fact_exclusions_path,
    )
    cert_path = snapshot_dir / "certificate.lean"
    cert_path.write_text(content, encoding="utf-8")
    return cert_path


@dataclass(frozen=True)
class CertificateVerifyResult:
    ok: bool
    exit_code: int
    stdout: str
    stderr: str
    duration_ms: int


def verify_certificate(cert_path: Path, timeout_seconds: int = 120) -> CertificateVerifyResult:
    """Compile a certificate.lean file with Lean's kernel.

    Requires the Lean toolchain and the pre-built Cohere library to be
    available (set COHERE_LIB_DIR to the Cohere project root).
    """
    cohere_lib = os.getenv("COHERE_LIB_DIR", "")
    if not cohere_lib or not Path(cohere_lib).is_dir():
        return CertificateVerifyResult(
            ok=False, exit_code=-1, stdout="",
            stderr="COHERE_LIB_DIR not set or not found. Certificate verification skipped.",
            duration_ms=0,
        )

    lean_bin = shutil.which("lean")
    if lean_bin is None:
        return CertificateVerifyResult(
            ok=False, exit_code=-1, stdout="",
            stderr="lean binary not found on PATH. Certificate verification skipped.",
            duration_ms=0,
        )

    lean_path = str(Path(cohere_lib) / ".lake" / "build" / "lib")
    env = {**os.environ, "LEAN_PATH": lean_path}

    start = time.monotonic()
    try:
        proc = subprocess.run(
            [lean_bin, str(cert_path)],
            capture_output=True, text=True,
            timeout=timeout_seconds, env=env,
        )
        elapsed = int((time.monotonic() - start) * 1000)
        return CertificateVerifyResult(
            ok=proc.returncode == 0,
            exit_code=proc.returncode,
            stdout=proc.stdout,
            stderr=proc.stderr,
            duration_ms=elapsed,
        )
    except subprocess.TimeoutExpired:
        elapsed = int((time.monotonic() - start) * 1000)
        return CertificateVerifyResult(
            ok=False, exit_code=-1, stdout="",
            stderr=f"Certificate verification timed out after {timeout_seconds}s.",
            duration_ms=elapsed,
        )
    except OSError as exc:
        return CertificateVerifyResult(
            ok=False, exit_code=-1, stdout="",
            stderr=f"Failed to invoke lean: {exc}",
            duration_ms=0,
        )
