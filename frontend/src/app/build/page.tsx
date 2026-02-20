"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type KernelActiveArtifactsResponse,
  type KernelRuntimeArtifactsResponse,
  displayActor,
  formatTimestamp,
  getApiBaseUrl,
  sessionHeaders,
} from "@/components/build/kernel-types";

export default function BuildOverviewPage() {
  const apiBaseUrl = useMemo(getApiBaseUrl, []);

  const [draft, setDraft] = useState<KernelActiveArtifactsResponse | null>(null);
  const [runtime, setRuntime] = useState<KernelRuntimeArtifactsResponse | null>(null);

  useEffect(() => {
    void fetch(`${apiBaseUrl}/api/kernel/active`, { headers: sessionHeaders() })
      .then((r) => r.json())
      .then((d) => setDraft(d as KernelActiveArtifactsResponse))
      .catch(() => {});
    void fetch(`${apiBaseUrl}/api/kernel/runtime`, { headers: sessionHeaders() })
      .then((r) => r.json())
      .then((d) => setRuntime(d as KernelRuntimeArtifactsResponse))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isRuntimeVerified = runtime?.verification.status === "verified";

  return (
    <div className="grid w-full gap-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className={`flex flex-col ${isRuntimeVerified ? "border-emerald-200 bg-emerald-50/30" : "border-amber-200 bg-amber-50/20"}`}>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Runtime</CardTitle>
              {isRuntimeVerified ? (
                <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700">
                  Verified
                </Badge>
              ) : (
                <Badge className="border border-amber-200 bg-amber-50 text-amber-800">
                  Not verified
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col pt-0">
            {isRuntimeVerified && runtime?.manifest ? (
              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex flex-wrap gap-2">
                  <Badge className="border border-slate-200 bg-white text-slate-700">
                    {runtime.rulesetRuleCount} rules
                  </Badge>
                  <Badge className="border border-slate-200 bg-white text-slate-700">
                    {runtime.incompatibilityPairCount} incompatibility pairs
                  </Badge>
                  <Badge className="border border-slate-200 bg-white text-slate-700">
                    {runtime.infeasibilityEntryCount} infeasibility entries
                  </Badge>
                  <Badge className="border border-slate-200 bg-white text-slate-700">
                    {runtime.manifest.rulesetVersion} &middot; r{runtime.manifest.revision}
                  </Badge>
                </div>
                <div className="mt-auto pt-1">
                  Verified at {formatTimestamp(runtime.verification.verifiedAt!)}
                  {runtime.verification.verifiedBy
                    ? ` by ${displayActor(runtime.verification.verifiedBy)}`
                    : ""}
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500">
                No verified runtime. Use Publish and verify.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Draft proposals</CardTitle>
              <Badge className="border border-slate-200 bg-white text-slate-700">
                {draft?.rulesetRuleCount ?? 0} rules
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col pt-0">
            {draft?.manifest ? (
              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex flex-wrap gap-2">
                  <Badge className="border border-slate-200 bg-white text-slate-700">
                    {draft.incompatibilityPairCount} incompatibility pairs
                  </Badge>
                  <Badge className="border border-slate-200 bg-white text-slate-700">
                    {draft.infeasibilityEntryCount} infeasibility entries
                  </Badge>
                  <Badge className="border border-slate-200 bg-white text-slate-700">
                    {draft.manifest.rulesetVersion} &middot; r{draft.manifest.revision}
                  </Badge>
                </div>
                <div className="mt-auto pt-1">
                  Updated by {displayActor(draft.manifest.updatedBy)} at{" "}
                  {formatTimestamp(draft.manifest.updatedAt)}
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500">No draft proposals.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ruleset</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col pt-0">
            <p className="text-sm text-slate-600">
              View and manage draft rules and ontology mappings.
            </p>
            <div className="mt-auto flex items-center justify-between pt-4">
              <Badge className="border border-slate-200 bg-white text-slate-700">
                {draft?.rulesetRuleCount ?? 0} draft rules
              </Badge>
              <Link
                href="/build/rules"
                className="text-sm font-medium text-indigo-700 underline-offset-2 hover:underline"
              >
                Open
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Constraints</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col pt-0">
            <p className="text-sm text-slate-600">
              Define incompatibility pairs and infeasibility entries for the action algebra.
            </p>
            <div className="mt-auto flex items-center justify-between pt-4">
              <div className="flex flex-wrap gap-2">
                <Badge className="border border-slate-200 bg-white text-slate-700">
                  {draft?.incompatibilityPairCount ?? 0} pairs
                </Badge>
                <Badge className="border border-slate-200 bg-white text-slate-700">
                  {draft?.infeasibilityEntryCount ?? 0} entries
                </Badge>
              </div>
              <Link
                href="/build/constraints"
                className="text-sm font-medium text-indigo-700 underline-offset-2 hover:underline"
              >
                Open
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Publish and verify</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col pt-0">
            <p className="text-sm text-slate-600">
              Publish draft proposals as frozen snapshots, run the Lean verifier, and promote to
              runtime.
            </p>
            <div className="mt-auto flex items-center justify-between pt-4">
              {isRuntimeVerified ? (
                <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700">
                  Verified
                </Badge>
              ) : (
                <Badge className="border border-amber-200 bg-amber-50 text-amber-800">
                  Not verified
                </Badge>
              )}
              <Link
                href="/build/hypergraph"
                className="text-sm font-medium text-indigo-700 underline-offset-2 hover:underline"
              >
                Open
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
