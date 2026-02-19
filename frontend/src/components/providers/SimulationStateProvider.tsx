"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import {
  type HypergraphRetrieveResponse,
  type OntologyNormalizeResponse,
  normalizeHypergraphPayload,
  normalizeOntologyPayload,
} from "@/components/build/kernel-types";
import {
  type InputOptions,
  useTokenRegistry,
} from "@/components/build/useTokenRegistry";
import { toggleSelection } from "@/lib/selection";

function normalizeSelectedValues(
  values: unknown,
  options: { id: string; label: string }[]
): string[] {
  if (!Array.isArray(values)) return [];
  const labelToId = new Map(options.map((option) => [option.label, option.id]));
  const validIds = new Set(options.map((option) => option.id));

  return values
    .filter((value): value is string => typeof value === "string")
    .map((value) => (validIds.has(value) ? value : labelToId.get(value)))
    .filter((value): value is string => Boolean(value));
}

function normalizeSelectedAction(
  value: unknown,
  actions: { id: string; label: string }[]
): string | null {
  if (typeof value !== "string") return null;
  const labelToId = new Map(actions.map((a) => [a.label, a.id]));
  const validIds = new Set(actions.map((a) => a.id));
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

function migrateLocalStorage(opts: InputOptions): SimulationState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<SimulationState>;
    const parsedDiagnosisAttributes =
      parsed.selectedDiagnosisAttributes &&
      typeof parsed.selectedDiagnosisAttributes === "object"
        ? (parsed.selectedDiagnosisAttributes as Record<string, unknown>)
        : {};

    const normalizedDiagnoses = normalizeSelectedValues(
      parsed.selectedDiagnoses,
      opts.diagnoses
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
    return {
      selectedDiagnoses: normalizedDiagnoses,
      selectedDiagnosisAttributes: migratedDiagnosisAttributes,
      selectedComorbidities: normalizeSelectedValues(
        parsed.selectedComorbidities,
        opts.comorbidities
      ),
      selectedPhysiologicStates: normalizeSelectedValues(
        parsed.selectedPhysiologicStates,
        opts.physiologicStates
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
      selectedAction: normalizeSelectedAction(parsed.selectedAction, opts.clinicalActions),
      normalizedOntology: normalizeOntologyPayload(
        parsed.normalizedOntology as OntologyNormalizeResponse | null
      ),
      hypergraphRetrieval: normalizeHypergraphPayload(
        parsed.hypergraphRetrieval as HypergraphRetrieveResponse | null
      )
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function SimulationStateProvider({
  children
}: {
  children: React.ReactNode;
}) {
  const registry = useTokenRegistry();
  const opts = registry.inputOptions;
  const registryReady = opts.diagnoses.length > 0;

  const [state, setState] = useState<SimulationState>(DEFAULT_STATE);
  const [migrated, setMigrated] = useState(false);

  useEffect(() => {
    if (!registryReady || migrated) return;
    setState(migrateLocalStorage(opts));
    setMigrated(true);
  }, [registryReady, opts, migrated]);

  useEffect(() => {
    if (!migrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, migrated]);

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
          hypergraphRetrieval: normalizeHypergraphPayload(value)
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
