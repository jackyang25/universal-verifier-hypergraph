"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import {
  clinicalActions,
  comorbidities,
  diagnoses,
  physiologicStates
} from "@/lib/clinical-options";
import { toggleSelection } from "@/lib/selection";

type OntologyMapping = {
  sourceGroup: string;
  sourceValue: string;
  normalizedTokens: string[];
  ruleExplanations: string[];
};

type OntologyNormalizeResponse = {
  facts: string[];
  diagnosisFacts: string[];
  diagnosisAttributeFacts: string[];
  contextFacts: string[];
  actionToken: string | null;
  mappings: OntologyMapping[];
};

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

function normalizeOntologyPayload(
  payload: OntologyNormalizeResponse | null | undefined
): OntologyNormalizeResponse | null {
  if (!payload) return null;
  return {
    ...payload,
    diagnosisAttributeFacts: Array.isArray(payload.diagnosisAttributeFacts)
      ? payload.diagnosisAttributeFacts
      : Array.isArray((payload as { acuityFacts?: unknown[] }).acuityFacts)
        ? ((payload as { acuityFacts?: unknown[] }).acuityFacts as string[])
        : [],
    mappings: Array.isArray(payload.mappings)
      ? payload.mappings.map((mapping) => ({
          ...mapping,
          ruleExplanations: mapping.ruleExplanations ?? []
        }))
      : []
  };
}

function normalizeHypergraphRetrievalPayload(
  payload: HypergraphRetrieveResponse | null | undefined
): HypergraphRetrieveResponse | null {
  if (!payload) return null;
  return {
    ...payload,
    derivedOutcomes: Array.isArray(payload.derivedOutcomes)
      ? payload.derivedOutcomes
      : [],
    candidateEdges: Array.isArray(payload.candidateEdges)
      ? payload.candidateEdges.map((edge) => ({
          ...edge,
          premises: Array.isArray(edge.premises) ? edge.premises : [],
          matchingPremises: Array.isArray(edge.matchingPremises)
            ? edge.matchingPremises
            : [],
          missingPremises: Array.isArray(edge.missingPremises)
            ? edge.missingPremises
            : []
        }))
      : [],
    verification: payload.verification
      ? {
          ...payload.verification,
          supportingEdgeIds: Array.isArray(payload.verification.supportingEdgeIds)
            ? payload.verification.supportingEdgeIds
            : []
        }
      : null
  };
}

function normalizeSelectedValues(
  values: unknown,
  options: { id: string; label: string }[],
  legacyValueToId: Record<string, string> = {}
): string[] {
  if (!Array.isArray(values)) return [];
  const labelToId = new Map(options.map((option) => [option.label, option.id]));
  const validIds = new Set(options.map((option) => option.id));

  return values
    .filter((value): value is string => typeof value === "string")
    .map((value) =>
      validIds.has(value)
        ? value
        : labelToId.get(value) ?? legacyValueToId[value]
    )
    .filter((value): value is string => Boolean(value));
}

function normalizeSelectedAction(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const labelToId = new Map(clinicalActions.map((action) => [action.label, action.id]));
  const validIds = new Set(clinicalActions.map((action) => action.id));
  if (validIds.has(value)) return value;
  return labelToId.get(value) ?? null;
}

type SimulationState = {
  selectedDiagnoses: string[];
  selectedDiagnosisAttributes: Record<string, string[]>;
  selectedComorbidities: string[];
  selectedPhysiologicStates: string[];
  gestationalWeeks: number;
  maternalAgeYears: number;
  bmi: number;
  selectedAction: string | null;
  normalizedOntology: OntologyNormalizeResponse | null;
  hypergraphRetrieval: HypergraphRetrieveResponse | null;
};

type SimulationStateContextValue = {
  state: SimulationState;
  toggleDiagnosis: (value: string) => void;
  toggleDiagnosisAttribute: (diagnosisId: string, attributeId: string) => void;
  toggleComorbidity: (value: string) => void;
  togglePhysiologicState: (value: string) => void;
  setGestationalWeeks: (value: number) => void;
  setMaternalAgeYears: (value: number) => void;
  setBmi: (value: number) => void;
  setSelectedAction: (value: string | null) => void;
  setNormalizedOntology: (value: OntologyNormalizeResponse | null) => void;
  setHypergraphRetrieval: (value: HypergraphRetrieveResponse | null) => void;
  clearState: () => void;
};

const STORAGE_KEY = "maternal_verification_sim_state_v1";

const DEFAULT_STATE: SimulationState = {
  selectedDiagnoses: [],
  selectedDiagnosisAttributes: {},
  selectedComorbidities: [],
  selectedPhysiologicStates: [],
  gestationalWeeks: 31,
  maternalAgeYears: 29,
  bmi: 30,
  selectedAction: null,
  normalizedOntology: null,
  hypergraphRetrieval: null
};

const SimulationStateContext = createContext<
  SimulationStateContextValue | undefined
>(undefined);

export function SimulationStateProvider({
  children
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<SimulationState>(DEFAULT_STATE);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<SimulationState>;
      const parsedDiagnosisAttributes =
        parsed.selectedDiagnosisAttributes &&
        typeof parsed.selectedDiagnosisAttributes === "object"
          ? (parsed.selectedDiagnosisAttributes as Record<string, unknown>)
          : {};

      const normalizedDiagnoses = normalizeSelectedValues(
        parsed.selectedDiagnoses,
        diagnoses
      );
      const migratedDiagnosisAttributes: Record<string, string[]> = {};
      for (const diagnosisId of normalizedDiagnoses) {
        const rawAttributes = parsedDiagnosisAttributes[diagnosisId];
        if (Array.isArray(rawAttributes)) {
          migratedDiagnosisAttributes[diagnosisId] = rawAttributes.filter(
            (value): value is string => typeof value === "string"
          );
        }
      }
      const rawSelectedDiagnoses = Array.isArray(parsed.selectedDiagnoses)
        ? parsed.selectedDiagnoses
        : [];
      if (rawSelectedDiagnoses.includes("dx_preeclampsia_severe_features")) {
        if (!normalizedDiagnoses.includes("dx_preeclampsia")) {
          normalizedDiagnoses.push("dx_preeclampsia");
        }
        migratedDiagnosisAttributes.dx_preeclampsia = Array.from(
          new Set([...(migratedDiagnosisAttributes.dx_preeclampsia ?? []), "severe_features"])
        );
      }

      setState({
        selectedDiagnoses: normalizedDiagnoses,
        selectedDiagnosisAttributes: migratedDiagnosisAttributes,
        selectedComorbidities: normalizeSelectedValues(
          parsed.selectedComorbidities,
          comorbidities
        ),
        selectedPhysiologicStates: normalizeSelectedValues(
          parsed.selectedPhysiologicStates,
          physiologicStates,
          {
            ctx_severe_headache: "ctx_headache",
            "Severe Headache": "ctx_headache"
          }
        ),
        gestationalWeeks:
          typeof parsed.gestationalWeeks === "number"
            ? parsed.gestationalWeeks
            : DEFAULT_STATE.gestationalWeeks,
        maternalAgeYears:
          typeof parsed.maternalAgeYears === "number"
            ? parsed.maternalAgeYears
            : DEFAULT_STATE.maternalAgeYears,
        bmi:
          typeof parsed.bmi === "number"
            ? parsed.bmi
            : DEFAULT_STATE.bmi,
        selectedAction: normalizeSelectedAction(parsed.selectedAction),
        normalizedOntology: normalizeOntologyPayload(
          parsed.normalizedOntology as OntologyNormalizeResponse | null
        ),
        hypergraphRetrieval: normalizeHypergraphRetrievalPayload(
          parsed.hypergraphRetrieval as HypergraphRetrieveResponse | null
        )
      });
    } catch {
      setState(DEFAULT_STATE);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const value = useMemo<SimulationStateContextValue>(
    () => ({
      state,
      toggleDiagnosis: (value) =>
        setState((current) => {
          const nextDiagnoses = toggleSelection(current.selectedDiagnoses, value);
          const isSelected = nextDiagnoses.includes(value);
          const nextDiagnosisAttributes = { ...current.selectedDiagnosisAttributes };
          if (!isSelected) {
            delete nextDiagnosisAttributes[value];
          }
          return {
            ...current,
            selectedDiagnoses: nextDiagnoses,
            selectedDiagnosisAttributes: nextDiagnosisAttributes
          };
        }),
      toggleDiagnosisAttribute: (diagnosisId, attributeId) =>
        setState((current) => {
          const existing = current.selectedDiagnosisAttributes[diagnosisId] ?? [];
          const next = toggleSelection(existing, attributeId);
          return {
            ...current,
            selectedDiagnosisAttributes: {
              ...current.selectedDiagnosisAttributes,
              [diagnosisId]: next
            }
          };
        }),
      toggleComorbidity: (value) =>
        setState((current) => ({
          ...current,
          selectedComorbidities: toggleSelection(
            current.selectedComorbidities,
            value
          )
        })),
      togglePhysiologicState: (value) =>
        setState((current) => ({
          ...current,
          selectedPhysiologicStates: toggleSelection(
            current.selectedPhysiologicStates,
            value
          )
        })),
      setGestationalWeeks: (value) =>
        setState((current) => ({
          ...current,
          gestationalWeeks: Math.max(20, Math.min(42, value))
        })),
      setMaternalAgeYears: (value) =>
        setState((current) => ({
          ...current,
          maternalAgeYears: Math.max(15, Math.min(55, value))
        })),
      setBmi: (value) =>
        setState((current) => ({
          ...current,
          bmi: Math.max(15, Math.min(60, value))
        })),
      setSelectedAction: (value) =>
        setState((current) => ({ ...current, selectedAction: value })),
      setNormalizedOntology: (value) =>
        setState((current) => ({
          ...current,
          normalizedOntology: normalizeOntologyPayload(value)
        })),
      setHypergraphRetrieval: (value) =>
        setState((current) => ({
          ...current,
          hypergraphRetrieval: normalizeHypergraphRetrievalPayload(value)
        })),
      clearState: () => setState(DEFAULT_STATE)
    }),
    [state]
  );

  return (
    <SimulationStateContext.Provider value={value}>
      {children}
    </SimulationStateContext.Provider>
  );
}

export function useSimulationState() {
  const context = useContext(SimulationStateContext);
  if (!context) {
    throw new Error(
      "useSimulationState must be used within SimulationStateProvider"
    );
  }
  return context;
}
