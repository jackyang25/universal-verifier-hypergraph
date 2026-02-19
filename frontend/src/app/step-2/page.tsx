"use client";

import { useMemo, useState } from "react";
import { useSimulationState } from "@/components/providers/SimulationStateProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRightIcon } from "@/components/ui/icons";
import {
  type OntologyMapping,
  type OntologyNormalizeResponse,
  getApiBaseUrl,
  normalizeOntologyPayload,
} from "@/components/build/kernel-types";
import { useTokenRegistry } from "@/components/build/useTokenRegistry";

function formatRuleExplanation(rule: string): string {
  const trimmed = rule.trim();
  if (!trimmed) return "";

  const sentence = trimmed.replace(/^\w/, (char) => char.toUpperCase());
  return sentence.endsWith(".") ? sentence : `${sentence}.`;
}

export default function Step2Page() {
  const registry = useTokenRegistry();
  const opts = registry.inputOptions;

  const {
    state: {
      selectedDiagnoses,
      selectedDiagnosisAttributes,
      selectedComorbidities,
      selectedPhysiologicStates,
      gestationalWeeks,
      maternalAgeYears,
      bmi,
      selectedAction,
      normalizedOntology
    },
    setNormalizedOntology,
    setHypergraphRetrieval
  } = useSimulationState();

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeRuleKey, setActiveRuleKey] = useState<string | null>(null);
  const apiBaseUrl = useMemo(getApiBaseUrl, []);
  const hasRequiredSimulatedInference =
    selectedDiagnoses.length > 0 && Boolean(selectedAction);
  const selectedActionLabel =
    opts.clinicalActions.find((action) => action.id === selectedAction)?.label ?? "None";
  const selectedDiagnosisAttributeLabels = selectedDiagnoses
    .flatMap((diagnosisId) => {
      const diagnosis = opts.diagnoses.find((item) => item.id === diagnosisId);
      const attributes = selectedDiagnosisAttributes[diagnosisId] ?? [];
      return attributes.map((attributeId) => {
        const attributeLabel =
          diagnosis?.availableAttributes?.find((item) => item.id === attributeId)
            ?.label ?? attributeId;
        return diagnosis ? `${diagnosis.label}, ${attributeLabel}` : attributeLabel;
      });
    })
    .filter((value) => Boolean(value));

  function sourceGroupLabel(group: string) {
    switch (group) {
      case "diagnosis":
        return "Diagnosis";
      case "comorbidity":
        return "Comorbidity";
      case "physiologic":
        return "Physiologic";
      case "quantitative":
        return "Quantitative";
      case "action":
        return "Action";
      default:
        return group;
    }
  }

  function rulePanelTitle(group: string) {
    if (group === "diagnosis") return "Diagnosis Derivation";
    if (group === "quantitative") return "Quantitative Derivation";
    return "Normalization Derivation";
  }

  function mappingKey(mapping: OntologyMapping, index: number) {
    return `${mapping.sourceGroup}-${mapping.sourceValue}-${index}`;
  }

  function toggleMappingDetails(key: string) {
    setActiveRuleKey((current) => (current === key ? null : key));
  }

  async function handleNormalize() {
    setIsLoading(true);
    setErrorMessage(null);
    setHypergraphRetrieval(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/ontology/normalize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          selectedDiagnoses,
          diagnosisAttributesByDiagnosis: selectedDiagnosisAttributes,
          selectedComorbidities,
          selectedPhysiologicStates,
          gestationalWeeks,
          maternalAgeYears,
          bmi,
          selectedAction
        })
      });

      if (!response.ok) {
        let detail = "Normalization failed.";
        try {
          const payload = (await response.json()) as { detail?: string };
          if (payload.detail) detail = payload.detail;
        } catch {
          // leave default message when error response is not JSON
        }
        throw new Error(detail);
      }

      const raw = (await response.json()) as OntologyNormalizeResponse;
      const payload = normalizeOntologyPayload(raw);
      setActiveRuleKey(null);
      setNormalizedOntology(payload ?? null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to normalize inputs.";
      setErrorMessage(message);
      setNormalizedOntology(null);
      setHypergraphRetrieval(null);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="grid w-full gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Step 2: Ontology Normalization</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Use the Step 1 selections as raw input, then normalize them into
            canonical fact tokens for downstream retrieval and verification.
          </p>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <div className="font-medium text-slate-800">Raw Input Summary</div>
              <div className="mt-2 grid grid-cols-2 gap-y-1 text-xs">
                <span>Diagnoses</span>
                <span className="text-right font-medium">
                  {selectedDiagnoses.length}
                </span>
                <span className="text-slate-600">Diagnosis Attributes</span>
                <span className="text-right font-medium text-slate-700">
                  {selectedDiagnosisAttributeLabels.length > 0
                    ? selectedDiagnosisAttributeLabels.join(" | ")
                    : "None"}
                </span>
                <span>Comorbidities</span>
                <span className="text-right font-medium">
                  {selectedComorbidities.length}
                </span>
                <span>Physiologic States</span>
                <span className="text-right font-medium">
                  {selectedPhysiologicStates.length}
                </span>
                <span>Gestational Age</span>
                <span className="text-right font-medium">{gestationalWeeks}w</span>
                <span>Maternal Age</span>
                <span className="text-right font-medium">{maternalAgeYears}y</span>
                <span>BMI</span>
                <span className="text-right font-medium">{bmi}</span>
                <span>Action</span>
                <span className="text-right font-medium">
                  {selectedActionLabel}
                </span>
              </div>
            </div>

            <div className="rounded-lg border border-indigo-200 bg-indigo-50/70 p-3">
              <div className="text-sm font-medium text-indigo-900">
                Ontology Encoder
              </div>
              <p className="mt-1 text-xs text-indigo-800">
                Convert the Step 1 snapshot into canonical `Dx.*` and `Ctx.*`
                tokens using backend ontology rules.
              </p>
              <div className="mt-3 flex items-center gap-3">
                <button
                  className="inline-flex min-w-28 items-center justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-600 disabled:text-white disabled:opacity-90"
                  onClick={handleNormalize}
                  disabled={isLoading || !hasRequiredSimulatedInference}
                  type="button"
                >
                  {isLoading ? "Normalizing..." : "Normalize"}
                </button>
              </div>
            </div>
          </div>
          <section className="flex min-h-[28rem] flex-col rounded-lg border border-slate-200 bg-slate-50 p-3">
            {errorMessage ? (
              <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {errorMessage}
              </div>
            ) : null}

            {normalizedOntology ? (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-5">
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="text-xs text-slate-500">All Facts</div>
                    <div className="mt-1 text-2xl font-semibold text-slate-900">
                      {normalizedOntology.facts.length}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="text-xs text-slate-500">Diagnosis Facts</div>
                    <div className="mt-1 text-2xl font-semibold text-slate-900">
                      {normalizedOntology.diagnosisFacts.length}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="text-xs text-slate-500">Context Facts</div>
                    <div className="mt-1 text-2xl font-semibold text-slate-900">
                      {normalizedOntology.contextFacts.length}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="text-xs text-slate-500">
                      Diagnosis Attribute Facts
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-slate-900">
                      {normalizedOntology.diagnosisAttributeFacts.length}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="text-xs text-slate-500">Action Token</div>
                    <div
                      className="mt-1 max-w-full truncate font-mono text-xs font-medium text-slate-900"
                    >
                      {normalizedOntology.actionToken ?? "None"}
                    </div>
                  </div>
                </div>

                <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
                  <h3 className="text-sm font-medium text-slate-800">
                    Mapping Visualization (Raw Input to Normalized Output)
                  </h3>
                  <div className="space-y-2">
                    {normalizedOntology.mappings.map((mapping, index) => (
                      <div
                        key={mappingKey(mapping, index)}
                        className="relative rounded-md border border-slate-200 bg-slate-50 p-2"
                      >
                        <div className="grid items-center gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.4fr)_auto]">
                          <div className="min-w-0">
                            <div className="text-[11px] uppercase tracking-wide text-slate-500">
                              {sourceGroupLabel(mapping.sourceGroup)}
                            </div>
                            <div className="truncate text-sm text-slate-800">
                              {mapping.sourceValue}
                            </div>
                          </div>
                          <div className="inline-flex items-center gap-1 self-center text-[11px] uppercase tracking-wide text-slate-500">
                            <span>to</span>
                            <ArrowRightIcon className="size-3" />
                          </div>
                          <div className="min-w-0 self-center flex items-center">
                            <div className="flex flex-wrap items-center gap-2">
                            {mapping.normalizedTokens.map((token) => (
                              <Badge key={`${mapping.sourceValue}-${token}`} className="font-mono">
                                {token}
                              </Badge>
                            ))}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="self-start rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-100"
                            onClick={() =>
                              toggleMappingDetails(mappingKey(mapping, index))
                            }
                            aria-label="Show applied ontology rules"
                          >
                            ?
                          </button>
                        </div>
                        {activeRuleKey === mappingKey(mapping, index) ? (
                          <div className="absolute right-2 top-10 z-10 w-[27rem] rounded-lg border border-slate-200 bg-white p-3 shadow-xl">
                            <div className="mb-2 flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                              <div className="text-sm font-semibold text-slate-900">
                                {rulePanelTitle(mapping.sourceGroup)}
                              </div>
                              <button
                                type="button"
                                className="rounded px-1 text-sm leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                                onClick={() => setActiveRuleKey(null)}
                                aria-label="Close rule details"
                              >
                                ×
                              </button>
                            </div>
                            <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-800 marker:text-slate-500">
                              {(mapping.ruleExplanations ?? []).map((rule) => (
                                <li key={`${mapping.sourceValue}-${rule}`}>
                                  {formatRuleExplanation(rule)}
                                </li>
                              ))}
                            </ol>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </section>

                <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                  <h3 className="text-sm font-medium text-slate-800">
                    Canonical Facts
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {normalizedOntology.facts.map((fact) => (
                      <Badge key={fact} className="font-mono">
                        {fact}
                      </Badge>
                    ))}
                  </div>
                </section>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-4 text-center">
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    Normalized output will appear here.
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Click Normalize to generate and keep this step panel populated.
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
