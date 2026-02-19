"use client";

import { useMemo } from "react";
import { useSimulationState } from "@/components/providers/SimulationStateProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VerifyIcon } from "@/components/ui/icons";

type VerificationStatus = "valid" | "rejected" | "incomplete";

type VerificationResult = {
  status: VerificationStatus;
  reason: string;
  proposedActionToken: string | null;
  supportLevel: "obligated" | "allowed" | "unsupported" | "n/a";
  supportingEdgeIds: string[];
  blockingOutcomes: string[];
  matchedEdgeCount: number;
  derivedOutcomeCount: number;
  certificateId: string | null;
};

function createCertificateId(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return `CERT-${hash.toString(16).toUpperCase().padStart(8, "0")}`;
}

export default function Step4Page() {
  const {
    state: { normalizedOntology, hypergraphRetrieval }
  } = useSimulationState();

  const verificationResult = useMemo<VerificationResult>(() => {
    if (!normalizedOntology) {
      return {
        status: "incomplete",
        reason: "Normalize Step 2 inputs before verification.",
        proposedActionToken: null,
        supportLevel: "n/a",
        supportingEdgeIds: [],
        blockingOutcomes: [],
        matchedEdgeCount: 0,
        derivedOutcomeCount: 0,
        certificateId: null
      };
    }

    if (!hypergraphRetrieval) {
      return {
        status: "incomplete",
        reason: "Run Step 3 retrieval before verification.",
        proposedActionToken: normalizedOntology.actionToken,
        supportLevel: "n/a",
        supportingEdgeIds: [],
        blockingOutcomes: [],
        matchedEdgeCount: 0,
        derivedOutcomeCount: 0,
        certificateId: null
      };
    }

    if (!normalizedOntology.actionToken) {
      return {
        status: "incomplete",
        reason: "No proposed action token is available for verification.",
        proposedActionToken: null,
        supportLevel: "n/a",
        supportingEdgeIds: [],
        blockingOutcomes: [],
        matchedEdgeCount: hypergraphRetrieval.matchedEdgeCount,
        derivedOutcomeCount: hypergraphRetrieval.derivedOutcomes.length,
        certificateId: null
      };
    }

    const targetAction = normalizedOntology.actionToken;
    const targetAllowed = `Allowed(${targetAction})`;
    const targetObligated = `Obligated(${targetAction})`;
    const blockingOutcomes = hypergraphRetrieval.derivedOutcomes.filter((outcome) =>
      outcome.startsWith("Obligated(") &&
      outcome !== targetObligated
    );
    const summary = hypergraphRetrieval.verification;
    const isSupported = summary?.isSupported ?? false;
    const status: VerificationStatus =
      isSupported && blockingOutcomes.length === 0 ? "valid" : "rejected";
    const supportLevel = (summary?.supportLevel ?? "unsupported") as
      | "obligated"
      | "allowed"
      | "unsupported";
    const certificateSeed = JSON.stringify({
      action: targetAction,
      support: supportLevel,
      supporting: summary?.supportingEdgeIds ?? [],
      blocking: blockingOutcomes,
      outcomes: hypergraphRetrieval.derivedOutcomes
    });

    return {
      status,
      reason:
        status === "valid"
          ? `Proposed action is ${supportLevel} by matched hyperedges.`
          : blockingOutcomes.length > 0
            ? "Conflicting obligation detected from matched hyperedges."
            : "Proposed action is not supported by matched hyperedges.",
      proposedActionToken: targetAction,
      supportLevel,
      supportingEdgeIds: summary?.supportingEdgeIds ?? [],
      blockingOutcomes,
      matchedEdgeCount: hypergraphRetrieval.matchedEdgeCount,
      derivedOutcomeCount: hypergraphRetrieval.derivedOutcomes.length,
      certificateId: createCertificateId(certificateSeed)
    };
  }, [hypergraphRetrieval, normalizedOntology]);

  return (
    <div className="grid w-full gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2">
            <VerifyIcon className="size-4 text-indigo-600" />
            <span>Step 4: Verification</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Verify whether the proposed action token is supported by retrieved
            hyperedges and surface a deterministic verification certificate.
          </p>
          <details
            className="group rounded-lg border border-indigo-200 bg-indigo-50/40 p-3 text-xs text-slate-700"
            open
          >
            <summary className="cursor-pointer list-none text-sm font-semibold text-indigo-900">
              Formal guarantee scope
              <span className="ml-2 text-xs font-medium text-indigo-700 group-open:hidden">
                Show details
              </span>
              <span className="ml-2 hidden text-xs font-medium text-indigo-700 group-open:inline">
                Hide details
              </span>
            </summary>

            <p className="mt-3 font-medium text-indigo-900">
              Kernel invariants (build-time verified by cohere-verify)
            </p>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li>
                <span className="font-medium">No contradictory verdicts</span> —
                same facts cannot produce Obligated(a) + Rejected(a), or Allowed(a) + Rejected(a).
              </li>
              <li>
                <span className="font-medium">No incompatible obligations</span> —
                no two obligated actions can be marked incompatible by the action algebra.
              </li>
              <li>
                <span className="font-medium">Ought implies can</span> —
                no obligation may trigger an infeasibility entry in the action algebra.
              </li>
            </ul>

            <p className="mt-3 font-medium text-indigo-900">
              Structural properties (hold by construction of Derive)
            </p>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li>
                <span className="font-medium">Determinism</span> —
                same facts and ruleset always yield the same verdict set (pure function).
              </li>
              <li>
                <span className="font-medium">Sound firing</span> —
                every reported verdict traces to at least one matched, unshadowed rule.
              </li>
            </ul>

            <p className="mt-3 font-medium text-indigo-900">Limits</p>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li>Does not prove clinical truth of encoded rules; it proves rule consistency.</li>
              <li>Does not correct missing/incorrect inputs or ontology mapping errors upstream.</li>
              <li>Does not perform probabilistic diagnosis, calibration, or risk prediction.</li>
              <li>Does not prove monotonicity or obligation-dominates-permission.</li>
            </ul>
          </details>

          <section className="flex min-h-[28rem] flex-col rounded-lg border border-slate-200 bg-slate-50/70 p-3">
            {verificationResult.status === "incomplete" ? (
              <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-4 text-center">
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    Verification output will appear here.
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {verificationResult.reason}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-100/80 p-3">
                    <div className="text-xs text-slate-500">Verification Status</div>
                    <div className="mt-1">
                      <Badge
                        className={
                          verificationResult.status === "valid"
                            ? "border border-emerald-700 bg-emerald-700 text-white"
                            : "border border-red-300 bg-red-100 text-red-800"
                        }
                      >
                        {verificationResult.status.charAt(0).toUpperCase() +
                          verificationResult.status.slice(1)}
                      </Badge>
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-100/80 p-3">
                    <div className="text-xs text-slate-500">Support Level</div>
                    <div className="mt-1 text-sm font-medium text-slate-900">
                      {verificationResult.supportLevel}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-100/80 p-3">
                    <div className="text-xs text-slate-500">Matched Hyperedges</div>
                    <div className="mt-1 text-2xl font-semibold text-slate-900">
                      {verificationResult.matchedEdgeCount}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-100/80 p-3">
                    <div className="text-xs text-slate-500">Derived Outcomes</div>
                    <div className="mt-1 text-2xl font-semibold text-slate-900">
                      {verificationResult.derivedOutcomeCount}
                    </div>
                  </div>
                </div>

                <section className="space-y-2 rounded-lg border border-slate-200 bg-slate-100/70 p-3">
                  <h3 className="text-sm font-medium text-slate-800">
                    Verification Certificate
                  </h3>
                  <div className="space-y-1 text-sm text-slate-700">
                    <p>
                      <span className="font-medium">Certificate ID:</span>{" "}
                      <span className="font-mono">
                        {verificationResult.certificateId ?? "n/a"}
                      </span>
                    </p>
                    <p>
                      <span className="font-medium">Proposed Action:</span>{" "}
                      <span
                        className="inline-block max-w-full truncate align-bottom font-mono"
                      >
                        {verificationResult.proposedActionToken ?? "n/a"}
                      </span>
                    </p>
                    <p>
                      <span className="font-medium">Rationale:</span>{" "}
                      {verificationResult.reason}
                    </p>
                  </div>
                </section>

                <section className="space-y-2 rounded-lg border border-slate-200 bg-slate-100/70 p-3">
                  <h3 className="text-sm font-medium text-slate-800">
                    Supporting Hyperedges
                  </h3>
                  {verificationResult.supportingEdgeIds.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {verificationResult.supportingEdgeIds.map((edgeId) => (
                        <Badge
                          key={edgeId}
                          className="border border-emerald-700 bg-emerald-700 text-white"
                        >
                          <span className="font-mono">{edgeId}</span>
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      No supporting hyperedges found for the proposed action.
                    </p>
                  )}
                </section>

                <section className="space-y-2 rounded-lg border border-slate-200 bg-slate-100/70 p-3">
                  <h3 className="text-sm font-medium text-slate-800">
                    Blocking Outcomes
                  </h3>
                  {verificationResult.blockingOutcomes.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {verificationResult.blockingOutcomes.map((outcome) => (
                        <Badge
                          key={outcome}
                          className="border border-red-300 bg-red-100 text-red-800"
                        >
                          <span className="font-mono">{outcome}</span>
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      No blocking obligations detected.
                    </p>
                  )}
                </section>
              </div>
            )}
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
