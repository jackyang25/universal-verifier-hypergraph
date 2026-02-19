"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSimulationState } from "@/components/providers/SimulationStateProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  type HypergraphRetrieveResponse,
  type KernelRuntimeArtifactsResponse,
  getApiBaseUrl,
} from "@/components/build/kernel-types";

export default function Step3Page() {
  const {
    state: { normalizedOntology, hypergraphRetrieval },
    setHypergraphRetrieval
  } = useSimulationState();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [runtimeArtifacts, setRuntimeArtifacts] =
    useState<KernelRuntimeArtifactsResponse | null>(null);
  const [runtimeArtifactsError, setRuntimeArtifactsError] = useState<string | null>(
    null
  );
  const apiBaseUrl = useMemo(getApiBaseUrl, []);
  const matchedOutcomeSet = useMemo(
    () =>
      new Set(
        (hypergraphRetrieval?.candidateEdges ?? [])
          .filter((edge) => edge.isMatched)
          .map((edge) => edge.expectedOutcome)
      ),
    [hypergraphRetrieval]
  );
  const runtimeIsVerified = runtimeArtifacts?.verification.status === "verified";

  useEffect(() => {
    let isMounted = true;
    async function loadRuntimeArtifacts() {
      setRuntimeArtifactsError(null);
      try {
        const response = await fetch(`${apiBaseUrl}/api/kernel/runtime`, {
          method: "GET"
        });
        if (!response.ok) {
          let detail = "Failed to load runtime ruleset status.";
          try {
            const payload = (await response.json()) as { detail?: string };
            if (payload.detail) detail = payload.detail;
          } catch {
            // keep default
          }
          throw new Error(detail);
        }
        const payload = (await response.json()) as KernelRuntimeArtifactsResponse;
        if (!isMounted) return;
        setRuntimeArtifacts(payload);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to load runtime ruleset status.";
        if (!isMounted) return;
        setRuntimeArtifacts(null);
        setRuntimeArtifactsError(message);
      }
    }

    void loadRuntimeArtifacts();
    return () => {
      isMounted = false;
    };
  }, [apiBaseUrl]);

  async function handleRetrieve() {
    if (!normalizedOntology) return;
    if (!runtimeIsVerified) {
      setErrorMessage(
        "Runtime ruleset is not verified. Publish a snapshot with verification enabled in Build."
      );
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/hypergraph/retrieve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          facts: normalizedOntology.facts,
          proposedActionToken: normalizedOntology.actionToken
        })
      });

      if (!response.ok) {
        let detail = "Hypergraph retrieval failed.";
        try {
          const payload = (await response.json()) as { detail?: string };
          if (payload.detail) detail = payload.detail;
        } catch {
          // keep default message for non-JSON error responses
        }
        throw new Error(detail);
      }

      const payload = (await response.json()) as HypergraphRetrieveResponse;
      setHypergraphRetrieval(payload);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to retrieve hyperedges.";
      setErrorMessage(message);
      setHypergraphRetrieval(null);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="grid w-full gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Step 3: Hypergraph Retrieval</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Retrieve hyperedges by matching normalized facts against predefined
            premise sets, then visualize matched edges and expected outcomes.
          </p>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Runtime ruleset status
                </div>
                <div className="mt-1 text-sm font-medium text-slate-900">
                  Retrieval uses the currently active runtime ruleset. Build-time Lean
                  verification is performed when you publish and verify.
                </div>
              </div>
              {runtimeArtifacts?.verification.status === "verified" ? (
                <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700">
                  Verified
                </Badge>
              ) : (
                <Badge className="border border-amber-200 bg-amber-50 text-amber-800">
                  Not verified
                </Badge>
              )}
            </div>

            {runtimeArtifactsError ? (
              <div className="mt-2 text-xs text-red-700">{runtimeArtifactsError}</div>
            ) : null}

            {runtimeArtifacts ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-700">
                <Badge className="border border-slate-200 bg-white text-slate-700">
                  Rules: {runtimeArtifacts.rulesetRuleCount}
                </Badge>
                {runtimeArtifacts.manifest ? (
                  <>
                    <Badge className="border border-slate-200 bg-white text-slate-700">
                      Version: {runtimeArtifacts.manifest.rulesetVersion}
                    </Badge>
                    <Badge className="border border-slate-200 bg-white text-slate-700">
                      Rev: {runtimeArtifacts.manifest.revision}
                    </Badge>
                  </>
                ) : null}
                <Link
                  href="/build"
                  className="font-medium text-indigo-700 underline-offset-2 hover:underline"
                >
                  Verify/publish rules in Build
                </Link>
              </div>
            ) : (
              <div className="mt-2 text-xs text-slate-600">
                Visit <Link href="/build" className="font-medium text-indigo-700 underline-offset-2 hover:underline">Build</Link>{" "}
                to publish and verify the current ruleset snapshot.
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-sm font-medium text-blue-900">Hypergraph Query</div>
            <p className="mt-1 text-xs text-slate-600">
              Uses Step 2 canonical facts as the retrieval input set.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <button
                className="inline-flex min-w-40 items-center justify-center gap-2 rounded-md border border-indigo-700/80 bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-600 disabled:text-white"
                onClick={handleRetrieve}
                disabled={isLoading || !normalizedOntology || !runtimeIsVerified}
                type="button"
              >
                {isLoading ? "Retrieving..." : "Retrieve Hyperedges"}
              </button>
              {!normalizedOntology ? (
                <span className="text-xs text-slate-600">
                  Normalize Step 2 first.
                </span>
              ) : !runtimeIsVerified ? (
                <span className="text-xs text-slate-600">
                  Verify/publish rules in Build first.
                </span>
              ) : null}
            </div>
          </div>

          <section className="flex min-h-[28rem] flex-col rounded-lg border border-slate-200 bg-white p-3">
            {errorMessage ? (
              <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {errorMessage}
              </div>
            ) : null}

            {hypergraphRetrieval ? (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="text-xs text-slate-500">Candidate Hyperedges</div>
                    <div className="mt-1 text-2xl font-semibold text-slate-900">
                      {hypergraphRetrieval.candidateEdgeCount}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="text-xs text-slate-500">Matched Hyperedges</div>
                    <div className="mt-1 text-2xl font-semibold text-slate-900">
                      {hypergraphRetrieval.matchedEdgeCount}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="text-xs text-slate-500">Derived Outcomes</div>
                    <div className="mt-1 text-2xl font-semibold text-slate-900">
                      {hypergraphRetrieval.derivedOutcomes.length}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="text-xs text-slate-500">
                      Proposed action support (runtime)
                    </div>
                    <div className="mt-1 text-sm font-medium text-slate-900">
                      {hypergraphRetrieval.verification
                        ? hypergraphRetrieval.verification.isSupported
                          ? `${hypergraphRetrieval.verification.supportLevel} support`
                          : "not supported"
                        : "n/a"}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      runtime derivation only (not build-time Lean verification)
                    </div>
                  </div>
                </div>

                <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                  <h3 className="text-sm font-medium text-slate-800">
                    Retrieval Fact Set
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {normalizedOntology?.facts.map((fact) => (
                      <Badge
                        key={fact}
                        className="border border-blue-200 bg-blue-50 font-mono text-blue-700"
                      >
                        {fact}
                      </Badge>
                    ))}
                  </div>
                </section>

                <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                  <h3 className="text-sm font-medium text-slate-800">
                    Expected Outcomes
                  </h3>
                  {hypergraphRetrieval.derivedOutcomes.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {hypergraphRetrieval.derivedOutcomes.map((outcome) => (
                        <Badge
                          key={outcome}
                          className={
                            matchedOutcomeSet.has(outcome)
                              ? "border border-emerald-700 bg-emerald-700 font-mono text-white"
                              : "border border-slate-300 bg-slate-100 font-mono text-slate-700"
                          }
                        >
                          {outcome}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      No hyperedge outcomes were derived for the current fact set.
                    </p>
                  )}
                </section>

                <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
                  <h3 className="text-sm font-medium text-slate-800">
                    Hypergraph Retrieval Visualization
                  </h3>
                  <div className="space-y-2">
                    {hypergraphRetrieval.candidateEdges.map((edge) => (
                      <div
                        key={edge.edgeId}
                        className={`rounded-md border p-2 ${
                          edge.isMatched
                            ? "border-indigo-200 bg-indigo-50/40"
                            : "border-slate-200 bg-slate-50"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-xs font-semibold text-slate-700">
                            {edge.edgeId}
                          </div>
                          <Badge
                            className={
                              edge.isMatched
                                ? "border border-indigo-200 bg-indigo-50 text-indigo-700"
                                : "border border-slate-300 bg-slate-200 text-slate-800"
                            }
                          >
                            {edge.isMatched ? "Matched" : "Not matched"}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">{edge.note}</p>
                        <div className="mt-1 text-[11px] text-slate-500">
                          premises matched: {edge.matchingPremises.length}/{edge.premises.length}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          <span className="text-slate-500">premises:</span>
                          {edge.premises.map((premise) => (
                            <Badge
                              key={`${edge.edgeId}-${premise}`}
                              className={
                                edge.matchingPremises.includes(premise)
                                  ? "border border-indigo-200 bg-indigo-50 text-indigo-700"
                                  : "border border-slate-300 bg-slate-200 text-slate-800"
                              }
                            >
                              <span className="font-mono">{premise}</span>
                            </Badge>
                          ))}
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-xs">
                          <span className="text-slate-500">outcome:</span>
                          <Badge
                            className={
                              edge.isMatched && matchedOutcomeSet.has(edge.expectedOutcome)
                                ? "border border-emerald-700 bg-emerald-700 font-mono text-white"
                                : "border border-slate-300 bg-slate-100 font-mono text-slate-700"
                            }
                          >
                            {edge.expectedOutcome}
                          </Badge>
                        </div>
                        {edge.missingPremises.length > 0 ? (
                          <div className="mt-1 text-[11px] text-slate-500">
                            missing: {edge.missingPremises.join(", ")}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-4 text-center">
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    Retrieval visualization will appear here.
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Click Retrieve Hyperedges after completing Step 2 normalization.
                  </p>
                </div>
              </div>
            )}
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
