"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type KernelRuntimeArtifactsResponse,
  displayActor,
  formatTimestamp,
  getApiBaseUrl,
  sessionHeaders,
} from "./kernel-types";
import { SearchableRuleList } from "./SearchableRuleList";

export function RuntimePanel() {
  const apiBaseUrl = useMemo(getApiBaseUrl, []);

  const [data, setData] = useState<KernelRuntimeArtifactsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/kernel/runtime`, {
        headers: sessionHeaders(),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { detail?: string };
        throw new Error(body.detail ?? "Failed to load runtime artifacts.");
      }
      setData((await res.json()) as KernelRuntimeArtifactsResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load runtime.");
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isVerified = data?.verification.status === "verified";

  return (
    <Card className={isVerified ? "border-emerald-200 bg-emerald-50/30" : "border-amber-200 bg-amber-50/20"}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">
            Runtime verification
          </CardTitle>
          <div className="flex items-center gap-2">
            {isVerified ? (
              <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700">
                Verified
              </Badge>
            ) : (
              <Badge className="border border-amber-200 bg-amber-50 text-amber-800">
                Not verified
              </Badge>
            )}
            <button
              type="button"
              onClick={refresh}
              disabled={isLoading}
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
            >
              Refresh
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {isVerified && data ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border border-slate-200 bg-white text-slate-700">
                {data.rulesetRuleCount} rules
              </Badge>
              {data.manifest ? (
                <Badge className="border border-slate-200 bg-white text-slate-700">
                  {data.manifest.rulesetVersion} &middot; r{data.manifest.revision}
                </Badge>
              ) : null}
              <Badge className="border border-slate-200 bg-white text-slate-700">
                {data.incompatibilityPairCount} incompatibility pairs
              </Badge>
              <Badge className="border border-slate-200 bg-white text-slate-700">
                {data.infeasibilityEntryCount} infeasibility entries
              </Badge>
              <Badge className="border border-slate-200 bg-white text-slate-700">
                {data.factExclusionCount} exclusion groups
              </Badge>
            </div>
            {data.verification.verifiedAt ? (
              <div className="text-xs text-slate-600">
                Verified at {formatTimestamp(data.verification.verifiedAt)}
                {data.verification.verifiedBy
                  ? ` by ${displayActor(data.verification.verifiedBy)}`
                  : ""}
                {data.verification.verifiedSnapshotDir ? (
                  <span className="ml-2 font-mono text-slate-400">
                    {data.verification.verifiedSnapshotDir}
                  </span>
                ) : null}
              </div>
            ) : null}
            {data.rulesetRuleCount > 0 ? (
              <SearchableRuleList
                rules={data.ruleset}
                emptyMessage="No rules in runtime."
              />
            ) : null}
          </>
        ) : !error ? (
          <div className="rounded-xl border border-dashed border-amber-300 bg-white p-4 text-sm text-slate-600">
            No verified runtime ruleset. Use{" "}
            <span className="font-semibold">Publish and verify</span> above to
            promote Draft proposals.
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
