"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
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
  contextFacts: string[];
  actionToken: string | null;
  mappings: OntologyMapping[];
};

function normalizeOntologyPayload(
  payload: OntologyNormalizeResponse | null | undefined
): OntologyNormalizeResponse | null {
  if (!payload) return null;
  return {
    ...payload,
    mappings: Array.isArray(payload.mappings)
      ? payload.mappings.map((mapping) => ({
          ...mapping,
          ruleExplanations: mapping.ruleExplanations ?? []
        }))
      : []
  };
}

type SimulationState = {
  selectedDiagnoses: string[];
  selectedComorbidities: string[];
  selectedPhysiologicStates: string[];
  gestationalWeeks: number;
  selectedAction: string | null;
  normalizedOntology: OntologyNormalizeResponse | null;
};

type SimulationStateContextValue = {
  state: SimulationState;
  toggleDiagnosis: (value: string) => void;
  toggleComorbidity: (value: string) => void;
  togglePhysiologicState: (value: string) => void;
  setGestationalWeeks: (value: number) => void;
  setSelectedAction: (value: string | null) => void;
  setNormalizedOntology: (value: OntologyNormalizeResponse | null) => void;
  clearState: () => void;
};

const STORAGE_KEY = "maternal_verification_sim_state_v1";

const DEFAULT_STATE: SimulationState = {
  selectedDiagnoses: [],
  selectedComorbidities: [],
  selectedPhysiologicStates: [],
  gestationalWeeks: 31,
  selectedAction: null,
  normalizedOntology: null
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
      setState({
        selectedDiagnoses: parsed.selectedDiagnoses ?? [],
        selectedComorbidities: parsed.selectedComorbidities ?? [],
        selectedPhysiologicStates: parsed.selectedPhysiologicStates ?? [],
        gestationalWeeks:
          typeof parsed.gestationalWeeks === "number"
            ? parsed.gestationalWeeks
            : DEFAULT_STATE.gestationalWeeks,
        selectedAction: parsed.selectedAction ?? null,
        normalizedOntology: normalizeOntologyPayload(
          parsed.normalizedOntology as OntologyNormalizeResponse | null
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
        setState((current) => ({
          ...current,
          selectedDiagnoses: toggleSelection(current.selectedDiagnoses, value)
        })),
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
      setSelectedAction: (value) =>
        setState((current) => ({ ...current, selectedAction: value })),
      setNormalizedOntology: (value) =>
        setState((current) => ({
          ...current,
          normalizedOntology: normalizeOntologyPayload(value)
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
