"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type CertificateVerifyResult,
  type CohereVerifyResponse,
  type KernelActiveArtifactsResponse,
  type KernelPublishSnapshotResponse,
  type KernelRuntimeArtifactsResponse,
  displayActor,
  formatTimestamp,
  getApiBaseUrl,
  sessionHeaders,
} from "./kernel-types";

type InvariantResult = {
  name: string;
  label: string;
  status: "pass" | "fail" | "pending";
  method?: "runtime" | "certificate";
};
type SnapshotEntry = { directory: string; name: string; createdAt: string };

function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen((v) => !v);
  }, []);
  const handleKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        setOpen((v) => !v);
      }
    },
    [],
  );

  return (
    <span className="relative inline-block">
      <span
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={handleKey}
        className="ml-1 inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded-full border border-slate-300 bg-white text-[10px] font-semibold leading-none text-slate-500 transition hover:border-slate-400 hover:text-slate-700"
      >
        ?
      </span>
      {open ? (
        <span className="absolute left-1/2 top-full z-10 mt-1.5 w-64 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-2.5 text-[11px] leading-relaxed text-slate-600 shadow-lg">
          {text}
        </span>
      ) : null}
    </span>
  );
}

const INVARIANT_KEYS: { key: string; label: string }[] = [
  { key: "no_contradictory_verdicts", label: "No contradictory verdicts" },
  { key: "no_incompatible_obligations", label: "No incompatible obligations" },
  { key: "ought_implies_can", label: "Ought implies can" },
];

function parseInvariantResults(
  stdout: string | undefined,
  certificateResult: CertificateVerifyResult | null | undefined,
  verifyMode: "quick" | "certificate",
): InvariantResult[] {
  if (verifyMode === "certificate" && certificateResult != null) {
    // exitCode -1 means Lean toolchain wasn't available -- verification was skipped
    if (certificateResult.exitCode === -1) {
      return INVARIANT_KEYS.map((inv) => ({ name: inv.key, label: inv.label, status: "pending" }));
    }
    if (certificateResult.ok) {
      return INVARIANT_KEYS.map((inv) => ({
        name: inv.key,
        label: inv.label,
        status: "pass" as const,
        method: "certificate" as const,
      }));
    }
    // lean compilation is all-or-nothing; if it failed, all invariants are unproven
    return INVARIANT_KEYS.map((inv) => ({
      name: inv.key,
      label: inv.label,
      status: "fail" as const,
      method: "certificate" as const,
    }));
  }

  if (!stdout) {
    return INVARIANT_KEYS.map((inv) => ({ name: inv.key, label: inv.label, status: "pending" }));
  }
  return INVARIANT_KEYS.map((inv) => {
    const re = new RegExp(`^(PASS|FAIL)\\s+${inv.key}`, "m");
    const match = stdout.match(re);
    if (!match) return { name: inv.key, label: inv.label, status: "pending" as const };
    return {
      name: inv.key,
      label: inv.label,
      status: match[1] === "PASS" ? ("pass" as const) : ("fail" as const),
      method: "runtime" as const,
    };
  });
}

export function PublishPanel() {
  const apiBaseUrl = useMemo(getApiBaseUrl, []);

  const [draft, setDraft] = useState<KernelActiveArtifactsResponse | null>(null);
  const [runtime, setRuntime] = useState<KernelRuntimeArtifactsResponse | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [verifyMode, setVerifyMode] = useState<"quick" | "certificate">("quick");
  const [publishResult, setPublishResult] = useState<KernelPublishSnapshotResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotEntry[]>([]);

  async function refreshDraft() {
    try {
      const res = await fetch(`${apiBaseUrl}/api/kernel/active`, {
        headers: sessionHeaders(),
      });
      if (!res.ok) throw new Error("Failed to load draft.");
      setDraft((await res.json()) as KernelActiveArtifactsResponse);
    } catch {
      /* non-critical for this panel */
    }
  }

  async function refreshRuntime() {
    try {
      const res = await fetch(`${apiBaseUrl}/api/kernel/runtime`, {
        headers: sessionHeaders(),
      });
      if (!res.ok) throw new Error("Failed to load runtime.");
      setRuntime((await res.json()) as KernelRuntimeArtifactsResponse);
    } catch {
      /* non-critical for this panel */
    }
  }

  async function refreshSnapshots() {
    try {
      const res = await fetch(`${apiBaseUrl}/api/kernel/snapshots`, {
        headers: sessionHeaders(),
      });
      if (!res.ok) return;
      setSnapshots((await res.json()) as SnapshotEntry[]);
    } catch {
      /* non-critical */
    }
  }

  async function publish() {
    setIsPublishing(true);
    setError(null);
    setPublishResult(null);

    try {
      const res = await fetch(`${apiBaseUrl}/api/kernel/publish`, {
        method: "POST",
        headers: sessionHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          verify: true,
          verifyMode,
          timeoutSeconds: verifyMode === "certificate" ? 180 : 20,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { detail?: unknown };
        const detail = body.detail;
        const msg =
          typeof detail === "string"
            ? detail
            : Array.isArray(detail)
              ? detail.map((d: { msg?: string }) => d.msg ?? "").join("; ")
              : "Publish failed.";
        throw new Error(msg);
      }

      const payload = (await res.json()) as KernelPublishSnapshotResponse;
      setPublishResult(payload);
      await refreshDraft();
      await refreshRuntime();
      await refreshSnapshots();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed.");
    } finally {
      setIsPublishing(false);
    }
  }

  useEffect(() => {
    void refreshDraft();
    void refreshRuntime();
    void refreshSnapshots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isRuntimeVerified = runtime?.verification.status === "verified";
  const hasDraftRules = (draft?.rulesetRuleCount ?? 0) > 0;
  const unresolvableConflicts = (draft?.conflictWarnings ?? []).filter(
    (w) => !w.resolvable
  );
  const hasUnresolvableConflicts = unresolvableConflicts.length > 0;

  return (
    <div className="space-y-6">
      {/* pre-publish summary */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Draft snapshot</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {draft?.manifest ? (
              <div className="space-y-2 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Badge className="border border-slate-200 bg-white text-slate-700">
                    {draft.rulesetRuleCount} rules
                  </Badge>
                  <Badge className="border border-slate-200 bg-white text-slate-700">
                    {draft.manifest.rulesetVersion} &middot; r{draft.manifest.revision}
                  </Badge>
                </div>
                <div className="text-xs text-slate-600">
                  Last updated by {displayActor(draft.manifest.updatedBy)} at{" "}
                  {formatTimestamp(draft.manifest.updatedAt)}
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-500">No draft proposals available.</div>
            )}
          </CardContent>
        </Card>

        <Card className={isRuntimeVerified ? "border-emerald-200" : "border-amber-200"}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Current runtime</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {isRuntimeVerified && runtime?.manifest ? (
              <div className="space-y-2 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700">
                    Verified
                  </Badge>
                  <Badge className="border border-slate-200 bg-white text-slate-700">
                    {runtime.rulesetRuleCount} rules
                  </Badge>
                </div>
                <div className="text-xs text-slate-600">
                  Verified at{" "}
                  {runtime.verification.verifiedAt
                    ? formatTimestamp(runtime.verification.verifiedAt)
                    : "—"}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Badge className="border border-amber-200 bg-amber-50 text-amber-800">
                  Not verified
                </Badge>
                <span>No runtime ruleset active.</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* publish action */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Publish and verify</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <p className="text-sm text-slate-600">
            Publishes the current Draft as a frozen JSON snapshot and verifies
            invariants. Only a successful proof certificate promotes to Runtime.
          </p>

          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setVerifyMode("quick")}
                disabled={isPublishing}
                className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                  verifyMode === "quick"
                    ? "border-indigo-300 bg-indigo-50 text-indigo-800"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                <div className="font-semibold">
                  Lean runtime check
                  <InfoTip text="Runs the compiled Lean verifier binary. Checks all three invariants using fact sets extracted from each rule's premises. Fast advisory check for authoring -- does not promote to runtime." />
                </div>
                <div className="mt-0.5 text-[11px] opacity-75">
                  Advisory only &middot; rule-premise fact sets (~2-5s)
                </div>
              </button>
              <button
                type="button"
                onClick={() => setVerifyMode("certificate")}
                disabled={isPublishing}
                className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                  verifyMode === "certificate"
                    ? "border-violet-300 bg-violet-50 text-violet-800"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                <div className="font-semibold">
                  Lean proof certificate
                  <InfoTip text="Generates a Lean proof script with your exact ruleset data and compiles it with Lean's kernel. Proves all three invariants hold for every possible combination of facts (2^N subsets). Produces a machine-checkable proof certificate. Only path that promotes to runtime." />
                </div>
                <div className="mt-0.5 text-[11px] opacity-75">
                  Proves all 2<sup>N</sup> fact subsets &middot; promotes to runtime
                </div>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={publish}
                disabled={isPublishing || !hasDraftRules || hasUnresolvableConflicts}
                className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-70 ${
                  verifyMode === "certificate"
                    ? "bg-violet-600 hover:bg-violet-700"
                    : "bg-indigo-600 hover:bg-indigo-700"
                }`}
              >
                {isPublishing
                  ? verifyMode === "certificate"
                    ? "Proving\u2026"
                    : "Checking\u2026"
                  : verifyMode === "certificate"
                    ? "Publish and prove"
                    : "Publish and check"}
              </button>

              {!hasDraftRules ? (
                <span className="text-xs text-slate-400">
                  No draft rules to publish.
                </span>
              ) : hasUnresolvableConflicts ? (
                <span className="text-xs text-red-600">
                  {unresolvableConflicts.length} unresolvable conflict{unresolvableConflicts.length > 1 ? "s" : ""} must
                  be resolved before publishing.
                </span>
              ) : null}
            </div>
          </div>

          {snapshots.length > 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Previous snapshots
              </div>
              <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                {snapshots.map((snap) => (
                  <div
                    key={snap.directory}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
                  >
                    <span className="truncate font-mono text-xs text-slate-700">
                      {snap.name}
                    </span>
                    <span className="shrink-0 text-[10px] text-slate-400">
                      {formatTimestamp(snap.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* publish result */}
          {publishResult ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-900">
                  Snapshot output
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(() => {
                    const quickOk = publishResult.verifyResult?.ok === true;
                    const certOk = publishResult.certificateVerifyResult?.ok === true;
                    const certSkipped = publishResult.certificateVerifyResult?.exitCode === -1;
                    const anyOk = quickOk || certOk;
                    const anyAttempted =
                      publishResult.verifyResult != null ||
                      (publishResult.certificateVerifyResult != null && !certSkipped);

                    if (anyOk) {
                      return (
                        <Badge className={certOk
                          ? "border border-violet-200 bg-violet-50 text-violet-700"
                          : "border border-emerald-200 bg-emerald-50 text-emerald-700"
                        }>
                          {certOk ? "Proven" : "Verified"}
                        </Badge>
                      );
                    }
                    if (anyAttempted) {
                      return (
                        <Badge className="border border-red-200 bg-red-50 text-red-700">
                          Verify failed
                        </Badge>
                      );
                    }
                    return (
                      <Badge className="border border-slate-200 bg-white text-slate-700">
                        Not verified
                      </Badge>
                    );
                  })()}
                  {publishResult.runtimePromoted ? (
                    <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700">
                      Promoted to runtime
                    </Badge>
                  ) : null}
                  {publishResult.certificateGenerated ? (
                    <Badge className="border border-violet-200 bg-violet-50 text-violet-700">
                      Certificate generated
                    </Badge>
                  ) : null}
                </div>
              </div>

              <div className="mt-3 text-xs text-slate-600">
                <span className="font-semibold">Directory:</span>{" "}
                <span className="font-mono">{publishResult.directory}</span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge className="border border-slate-200 bg-white text-slate-700">
                  Updated by: {displayActor(publishResult.manifest.updatedBy)}
                </Badge>
                <Badge className="border border-slate-200 bg-white text-slate-700">
                  {publishResult.manifest.rulesetVersion} &middot; r
                  {publishResult.manifest.revision}
                </Badge>
              </div>

              <div className="mt-3 grid gap-2 text-xs text-slate-700 md:grid-cols-2">
                {Object.entries(publishResult.files).map(([key, value]) => (
                  <div key={key} className="truncate">
                    <span className="font-semibold">{key}:</span>{" "}
                    <span className="font-mono">{value}</span>
                  </div>
                ))}
              </div>

              {(() => {
                const output: { label: string; result: CohereVerifyResponse | CertificateVerifyResult } | null =
                  publishResult.verifyResult
                    ? { label: "Runtime verifier output", result: publishResult.verifyResult }
                    : publishResult.certificateVerifyResult
                      ? { label: "Certificate compilation output", result: publishResult.certificateVerifyResult }
                      : null;
                if (!output) return null;
                return (
                  <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <summary className="cursor-pointer text-xs font-semibold text-slate-700">
                      {output.label} (exit {output.result.exitCode},{" "}
                      {output.result.durationMs}ms)
                    </summary>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          stderr
                        </div>
                        <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-2 text-[11px] text-slate-800">
                          {output.result.stderr || "(empty)"}
                        </pre>
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          stdout
                        </div>
                        <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-2 text-[11px] text-slate-800">
                          {output.result.stdout || "(empty)"}
                        </pre>
                      </div>
                    </div>
                  </details>
                );
              })()}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <InvariantSuiteCard
        stdout={publishResult?.verifyResult?.stdout}
        certificateResult={publishResult?.certificateVerifyResult}
        verifyMode={publishResult ? verifyMode : "quick"}
      />

      {publishResult?.certificateGenerated ? (
        <CertificateCard
          filePath={publishResult.files?.certificate}
          verifyResult={publishResult.certificateVerifyResult}
        />
      ) : null}
    </div>
  );
}

function CertificateCard({
  filePath,
  verifyResult,
}: {
  filePath?: string;
  verifyResult?: CertificateVerifyResult | null;
}) {
  const verified = verifyResult?.ok === true;
  const attempted = verifyResult != null && verifyResult.exitCode !== -1;
  const skipped = verifyResult != null && verifyResult.exitCode === -1;

  return (
    <Card className={verified ? "border-violet-300" : "border-violet-200"}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Proof certificate</CardTitle>
          {verified ? (
            <Badge className="border border-violet-200 bg-violet-50 text-violet-700">
              Kernel-verified
            </Badge>
          ) : attempted ? (
            <Badge className="border border-red-200 bg-red-50 text-red-700">
              Verification failed
            </Badge>
          ) : skipped ? (
            <Badge className="border border-slate-200 bg-white text-slate-500">
              Verification skipped
            </Badge>
          ) : (
            <Badge className="border border-slate-200 bg-white text-slate-500">
              Pending verification
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <p className="text-sm text-slate-600">
          A Lean 4 proof script was generated for this snapshot. It embeds the
          concrete ruleset data and proves all three kernel invariants hold for
          every subset of the fact universe using <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">native_decide</code>.
        </p>
        {verified ? (
          <p className="text-sm font-medium text-violet-700">
            Lean&apos;s kernel successfully compiled and verified all three
            theorems ({verifyResult.durationMs}ms). The invariants are proven
            to hold universally.
          </p>
        ) : skipped ? (
          <p className="text-sm text-slate-500">
            The Lean toolchain is not available in this environment.
            Compile the certificate file independently to verify.
          </p>
        ) : attempted ? (
          <p className="text-sm text-red-700">
            Certificate compilation failed. See verifier output above for details.
          </p>
        ) : null}
        {filePath ? (
          <div className="rounded-lg border border-violet-100 bg-violet-50/50 px-3 py-2 text-xs">
            <span className="font-semibold text-violet-700">File:</span>{" "}
            <span className="font-mono text-slate-700">{filePath}</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function InvariantSuiteCard({
  stdout,
  certificateResult,
  verifyMode,
}: {
  stdout: string | undefined;
  certificateResult?: CertificateVerifyResult | null;
  verifyMode: "quick" | "certificate";
}) {
  const results = useMemo(
    () => parseInvariantResults(stdout, certificateResult, verifyMode),
    [stdout, certificateResult, verifyMode],
  );

  const allResolved = results.every((r) => r.status !== "pending");
  const methodLabel = allResolved
    ? results[0]?.method === "certificate"
      ? "Proven via Lean certificate"
      : "Checked via runtime verifier"
    : null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Invariant checks</CardTitle>
          {methodLabel ? (
            <span className="text-[11px] font-medium text-slate-500">
              {methodLabel}
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid gap-2 sm:grid-cols-3">
          {results.map((inv) => {
            const borderColor =
              inv.status === "pass"
                ? inv.method === "certificate"
                  ? "border-violet-200 bg-violet-50/30"
                  : "border-emerald-200 bg-emerald-50/30"
                : inv.status === "fail"
                  ? "border-red-200 bg-red-50/30"
                  : "border-slate-200 bg-slate-50";
            const badgeClass =
              inv.status === "pass"
                ? inv.method === "certificate"
                  ? "border border-violet-200 bg-violet-50 text-violet-700"
                  : "border border-emerald-200 bg-emerald-50 text-emerald-700"
                : inv.status === "fail"
                  ? "border border-red-200 bg-red-50 text-red-700"
                  : "border border-slate-200 bg-white text-slate-500";
            const badgeLabel =
              inv.status === "pass"
                ? inv.method === "certificate"
                  ? "Proven"
                  : "Pass"
                : inv.status === "fail"
                  ? "Fail"
                  : "Pending";

            return (
              <div
                key={inv.name}
                className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${borderColor}`}
              >
                <span className="text-sm text-slate-700">{inv.label}</span>
                <Badge className={badgeClass}>{badgeLabel}</Badge>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
