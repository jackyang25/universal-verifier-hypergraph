"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { toggleSelection } from "@/lib/selection";

type SimulationState = {
  selectedDiagnoses: string[];
  selectedComorbidities: string[];
  selectedPhysiologicStates: string[];
  gestationalWeeks: number;
  selectedAction: string | null;
};

type SimulationStateContextValue = {
  state: SimulationState;
  toggleDiagnosis: (value: string) => void;
  toggleComorbidity: (value: string) => void;
  togglePhysiologicState: (value: string) => void;
  setGestationalWeeks: (value: number) => void;
  setSelectedAction: (value: string | null) => void;
  clearState: () => void;
};

const STORAGE_KEY = "maternal_verification_sim_state_v1";

const DEFAULT_STATE: SimulationState = {
  selectedDiagnoses: [],
  selectedComorbidities: [],
  selectedPhysiologicStates: [],
  gestationalWeeks: 31,
  selectedAction: null
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
        selectedAction: parsed.selectedAction ?? null
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
