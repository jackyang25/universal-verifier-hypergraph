"use client";

import { useMemo, useState } from "react";
import { useSimulationState } from "@/components/providers/SimulationStateProvider";
import { HeroHeader } from "@/components/selection/HeroHeader";
import { StepFlowBar } from "@/components/selection/StepFlowBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type HypergraphCandidateEdge = {
  edgeId: string;
  premises: string[];
  expectedOutcome: string;
  note: string;
  isMatched: boolean;
  matchingPremises: string[];
  missingPremises: string[];
};

type HypergraphVerificationSummary = {
  proposedActionToken: string;
  isSupported: boolean;
  supportLevel: "obligated" | "allowed" | "unsupported";
  supportingEdgeIds: string[];
};

type HypergraphRetrieveResponse = {
  candidateEdgeCount: number;
  matchedEdgeCount: number;
  derivedOutcomes: string[];
  candidateEdges: HypergraphCandidateEdge[];
  verification: HypergraphVerificationSummary | null;
};

export default function Step3Page() {
  const {
    state: { normalizedOntology, hypergraphRetrieval },
    setHypergraphRetrieval
  } = useSimulationState();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const apiBaseUrl = useMemo(
    () => process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000",
    []
  );

  async function handleRetrieve() {
    if (!normalizedOntology) return;
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
    <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 md:px-6 md:py-10">
      <HeroHeader
        eyebrow="Clinical Selection Interface - Proof of Concept"
        title="Maternal Health Decision Support Verification"
        subtitle=""
      />
      <StepFlowBar currentStep={3} />

      <Card>
        <CardHeader>
          <CardTitle>Step 3: Hypergraph Retrieval</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Retrieve hyperedges by matching normalized facts against predefined
            premise sets, then visualize matched edges and expected outcomes.
          </p>

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <div className="text-sm font-medium text-blue-900">Hypergraph Query</div>
            <p className="mt-1 text-xs text-blue-800">
              Uses Step 2 canonical facts as the retrieval input set.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <button
                className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                onClick={handleRetrieve}
                disabled={isLoading || !normalizedOntology}
                type="button"
              >
                {isLoading ? "Retrieving..." : "Retrieve Hyperedges"}
              </button>
              {!normalizedOntology ? (
                <span className="text-xs text-blue-700">
                  Normalize Step 2 first.
                </span>
              ) : null}
            </div>
          </div>

          <section className="flex min-h-[30rem] flex-col rounded-lg border border-slate-200 bg-slate-50 p-3">
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
                    <div className="text-xs text-slate-500">Action Support</div>
                    <div className="mt-1 text-sm font-medium text-slate-900">
                      {hypergraphRetrieval.verification
                        ? hypergraphRetrieval.verification.isSupported
                          ? `${hypergraphRetrieval.verification.supportLevel} support`
                          : "not supported"
                        : "n/a"}
                    </div>
                  </div>
                </div>

                <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                  <h3 className="text-sm font-medium text-slate-800">
                    Retrieval Fact Set
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {normalizedOntology?.facts.map((fact) => (
                      <Badge key={fact} className="font-mono">
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
                          className="border border-blue-700 bg-blue-700 font-mono text-white"
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
                            ? "border-blue-300 bg-blue-50"
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
                                ? "border border-blue-700 bg-blue-700 text-white"
                                : "border border-slate-300 bg-slate-200 text-slate-800"
                            }
                          >
                            {edge.isMatched ? "matched" : "not matched"}
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
                                  ? "border border-blue-700 bg-blue-700 text-white"
                                  : "border border-slate-300 bg-slate-200 text-slate-800"
                              }
                            >
                              <span className="font-mono">{premise}</span>
                            </Badge>
                          ))}
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-xs">
                          <span className="text-slate-500">outcome:</span>
                          <Badge className="font-mono">{edge.expectedOutcome}</Badge>
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
    </main>
  );
}
