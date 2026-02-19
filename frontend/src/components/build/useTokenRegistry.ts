"use client";

import { useEffect, useMemo, useState } from "react";
import { getApiBaseUrl } from "./kernel-types";

export type ClinicalOption = { id: string; label: string };
export type DiagnosisAttributeOption = { id: string; label: string };
export type DiagnosisOption = ClinicalOption & {
  diagnosisToken: string;
  availableAttributes?: DiagnosisAttributeOption[];
};

export type InputOptions = {
  diagnoses: DiagnosisOption[];
  comorbidities: ClinicalOption[];
  physiologicStates: ClinicalOption[];
  clinicalActions: ClinicalOption[];
  gestationalAgeMarks: number[];
  maternalAgeMarks: number[];
  bmiMarks: number[];
};

export type TokenRegistry = {
  actions: string[];
  verdicts: string[];
  facts: string[];
  diagnoses: string[];
  diagnosisAttributes: string[];
  context: string[];
  inputOptions: InputOptions;
};

const EMPTY_INPUT_OPTIONS: InputOptions = {
  diagnoses: [],
  comorbidities: [],
  physiologicStates: [],
  clinicalActions: [],
  gestationalAgeMarks: [],
  maternalAgeMarks: [],
  bmiMarks: [],
};

const EMPTY: TokenRegistry = {
  actions: [],
  verdicts: [],
  facts: [],
  diagnoses: [],
  diagnosisAttributes: [],
  context: [],
  inputOptions: EMPTY_INPUT_OPTIONS,
};

let cached: TokenRegistry | null = null;

export function useTokenRegistry(): TokenRegistry {
  const apiBaseUrl = useMemo(getApiBaseUrl, []);
  const [registry, setRegistry] = useState<TokenRegistry>(cached ?? EMPTY);

  useEffect(() => {
    if (cached) {
      setRegistry(cached);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/api/kernel/registry`);
        if (!res.ok) return;
        const data = (await res.json()) as TokenRegistry;
        if (!data.inputOptions) data.inputOptions = EMPTY_INPUT_OPTIONS;
        cached = data;
        if (!cancelled) setRegistry(data);
      } catch {
        /* non-critical */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  return registry;
}

/**
 * Build outcome suggestions from the registry.
 * Outcomes follow the pattern `Verdict(Action)`.
 */
export function buildOutcomeOptions(registry: TokenRegistry): string[] {
  const outcomes: string[] = [];
  for (const verdict of registry.verdicts) {
    for (const action of registry.actions) {
      outcomes.push(`${verdict}(${action})`);
    }
  }
  return outcomes;
}

// ---------------------------------------------------------------------------
//  Validation helpers
// ---------------------------------------------------------------------------

/** Returns invalid tokens from a comma-separated string against an allowed set. */
export function invalidTokens(raw: string, allowed: string[]): string[] {
  if (allowed.length === 0) return [];
  const set = new Set(allowed);
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !set.has(s));
}

export type ValidationResult = { valid: boolean; errors: string[] };

export function validateAction(value: string, allowedActions: string[]): ValidationResult {
  const trimmed = value.trim();
  if (!trimmed) return { valid: false, errors: ["Action is required."] };
  if (allowedActions.length === 0) return { valid: true, errors: [] };
  if (!allowedActions.includes(trimmed)) {
    return { valid: false, errors: [`"${trimmed}" is not a valid action.`] };
  }
  return { valid: true, errors: [] };
}

export function validateOutcome(value: string, outcomeOptions: string[]): ValidationResult {
  const trimmed = value.trim();
  if (!trimmed) return { valid: false, errors: ["Outcome is required."] };
  if (outcomeOptions.length === 0) return { valid: true, errors: [] };
  if (!outcomeOptions.includes(trimmed)) {
    return { valid: false, errors: [`"${trimmed}" is not a valid outcome.`] };
  }
  return { valid: true, errors: [] };
}

export function validateFacts(raw: string, allowedFacts: string[]): ValidationResult {
  if (allowedFacts.length === 0) return { valid: true, errors: [] };
  const bad = invalidTokens(raw, allowedFacts);
  if (bad.length > 0) {
    return { valid: false, errors: bad.map((t) => `"${t}" is not a valid fact.`) };
  }
  return { valid: true, errors: [] };
}
