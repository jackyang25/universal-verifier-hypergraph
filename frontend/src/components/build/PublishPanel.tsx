"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type KernelActiveArtifactsResponse,
  type KernelPublishSnapshotResponse,
  type KernelRuntimeArtifactsResponse,
  displayActor,
  formatTimestamp,
  getApiBaseUrl,
} from "./kernel-types";

type InvariantResult = { name: string; label: string; status: "pass" | "fail" | "pending" };
type SnapshotEntry = { directory: string; name: string; createdAt: string };

const INVARIANT_KEYS: { key: string; label: string }[] = [
  { key: "no_contradictory_verdicts", label: "No contradictory verdicts" },
  { key: "no_incompatible_obligations", label: "No incompatible obligations" },
  { key: "ought_implies_can", label: "Ought implies can" },
];

function parseInvariantResults(stdout: string | undefined): InvariantResult[] {
  if (!stdout) {
    return INVARIANT_KEYS.map((inv) => ({ name: inv.key, label: inv.label, status: "pending" }));
  }
  return INVARIANT_KEYS.map((inv) => {
    const re = new RegExp(`^(PASS|FAIL)\\s+${inv.key}`, "m");
    const match = stdout.match(re);
    if (!match) return { name: inv.key, label: inv.label, status: "pending" as const };
    return { name: inv.key, label: inv.label, status: match[1] === "PASS" ? "pass" as const : "fail" as const };
  });
}

export function PublishPanel() {
  const apiBaseUrl = useMemo(getApiBaseUrl, []);

  const [draft, setDraft] = useState<KernelActiveArtifactsResponse | null>(null);
  const [runtime, setRuntime] = useState<KernelRuntimeArtifactsResponse | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<KernelPublishSnapshotResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotEntry[]>([]);

  async function refreshDraft() {
    try {
      const res = await fetch(`${apiBaseUrl}/api/kernel/active`);
      if (!res.ok) throw new Error("Failed to load draft.");
      setDraft((await res.json()) as KernelActiveArtifactsResponse);
    } catch {
      /* non-critical for this panel */
    }
  }

  async function refreshRuntime() {
    try {
      const res = await fetch(`${apiBaseUrl}/api/kernel/runtime`);
      if (!res.ok) throw new Error("Failed to load runtime.");
      setRuntime((await res.json()) as KernelRuntimeArtifactsResponse);
    } catch {
      /* non-critical for this panel */
    }
  }

  async function refreshSnapshots() {
    try {
      const res = await fetch(`${apiBaseUrl}/api/kernel/snapshots`);
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verify: true, timeoutSeconds: 20 }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { detail?: string };
        throw new Error(body.detail ?? "Publish failed.");
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
            Publishes the current Draft as a frozen JSON snapshot, runs the Lean
            verifier, and promotes to Runtime if all invariants pass.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={publish}
              disabled={isPublishing || !hasDraftRules}
              className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isPublishing ? "Verifying\u2026" : "Publish and verify"}
            </button>

            {!hasDraftRules ? (
              <span className="text-xs text-slate-400">
                No draft rules to publish.
              </span>
            ) : null}
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
                  {publishResult.verifyResult ? (
                    <Badge
                      className={
                        publishResult.verifyResult.ok
                          ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border border-red-200 bg-red-50 text-red-700"
                      }
                    >
                      {publishResult.verifyResult.ok ? "Verified" : "Verify failed"}
                    </Badge>
                  ) : (
                    <Badge className="border border-slate-200 bg-white text-slate-700">
                      Not verified
                    </Badge>
                  )}
                  {publishResult.runtimePromoted ? (
                    <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700">
                      Promoted to runtime
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

              {publishResult.verifyResult ? (
                <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-700">
                    Verifier output (exit {publishResult.verifyResult.exitCode},{" "}
                    {publishResult.verifyResult.durationMs}ms)
                  </summary>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        stderr
                      </div>
                      <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-2 text-[11px] text-slate-800">
                        {publishResult.verifyResult.stderr || "(empty)"}
                      </pre>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        stdout
                      </div>
                      <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-2 text-[11px] text-slate-800">
                        {publishResult.verifyResult.stdout || "(empty)"}
                      </pre>
                    </div>
                  </div>
                </details>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <InvariantSuiteCard stdout={publishResult?.verifyResult?.stdout} />
    </div>
  );
}

function InvariantSuiteCard({ stdout }: { stdout: string | undefined }) {
  const results = useMemo(() => parseInvariantResults(stdout), [stdout]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Invariant checks</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid gap-2 sm:grid-cols-3">
          {results.map((inv) => {
            const borderColor =
              inv.status === "pass"
                ? "border-emerald-200 bg-emerald-50/30"
                : inv.status === "fail"
                  ? "border-red-200 bg-red-50/30"
                  : "border-slate-200 bg-slate-50";
            const badgeClass =
              inv.status === "pass"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                : inv.status === "fail"
                  ? "border border-red-200 bg-red-50 text-red-700"
                  : "border border-slate-200 bg-white text-slate-500";
            const badgeLabel =
              inv.status === "pass" ? "Pass" : inv.status === "fail" ? "Fail" : "Pending";

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
