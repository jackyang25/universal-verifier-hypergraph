export type KernelArtifactManifest = {
  artifactSource: string;
  rulesetVersion: string;
  revision: number;
  updatedAt: string;
  updatedBy: string;
  changeSummary: string;
};

export type KernelRule = {
  ruleId: string;
  premises: string[];
  outcome: string;
  note: string;
  createdBy: string;
  createdAt: string;
};

export type IncompatibilityPair = {
  a: string;
  b: string;
  createdBy: string;
  createdAt: string;
};

export type InfeasibilityEntry = {
  action: string;
  premises: string[];
  createdBy: string;
  createdAt: string;
};

export type FactExclusion = {
  facts: string[];
  createdBy: string;
  createdAt: string;
};

export type ConflictWarning = {
  ruleAId: string;
  ruleBId: string;
  action: string;
  verdictA: string;
  verdictB: string;
  resolvable: boolean;
};

export type KernelActiveArtifactsResponse = {
  manifest: KernelArtifactManifest;
  rulesetRuleCount: number;
  ruleset: KernelRule[];
  incompatibilityPairCount: number;
  incompatibility: IncompatibilityPair[];
  infeasibilityEntryCount: number;
  infeasibility: InfeasibilityEntry[];
  factExclusionCount: number;
  factExclusions: FactExclusion[];
  proofReport: Record<string, unknown>;
  conflictWarnings: ConflictWarning[];
};

export type KernelRuntimeVerification = {
  status: string;
  verifiedAt: string | null;
  verifiedBy: string | null;
  verifiedSnapshotDir: string | null;
};

export type KernelRuntimeArtifactsResponse = {
  verification: KernelRuntimeVerification;
  manifest: KernelArtifactManifest | null;
  rulesetRuleCount: number;
  ruleset: KernelRule[];
  incompatibilityPairCount: number;
  incompatibility: IncompatibilityPair[];
  infeasibilityEntryCount: number;
  infeasibility: InfeasibilityEntry[];
  factExclusionCount: number;
  factExclusions: FactExclusion[];
  proofReport: Record<string, unknown>;
};

export type CohereVerifyResponse = {
  ok: boolean;
  exitCode: number;
  durationMs: number;
  stdout: string;
  stderr: string;
};

export type CertificateVerifyResult = {
  ok: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
};

export type KernelPublishSnapshotResponse = {
  directory: string;
  manifest: KernelArtifactManifest;
  files: Record<string, string>;
  verifyResult: CohereVerifyResponse | null;
  runtimePromoted?: boolean;
  certificateGenerated?: boolean;
  certificateVerifyResult?: CertificateVerifyResult | null;
};

// ---------------------------------------------------------------------------
//  Ontology & hypergraph response types (shared by step-2, step-3, provider)
// ---------------------------------------------------------------------------

export type OntologyMapping = {
  sourceGroup: string;
  sourceValue: string;
  normalizedTokens: string[];
  ruleExplanations: string[];
};

export type OntologyNormalizeResponse = {
  facts: string[];
  diagnosisFacts: string[];
  diagnosisAttributeFacts: string[];
  contextFacts: string[];
  actionToken: string | null;
  mappings: OntologyMapping[];
};

export type HypergraphCandidateEdge = {
  edgeId: string;
  premises: string[];
  expectedOutcome: string;
  note: string;
  isMatched: boolean;
  matchingPremises: string[];
  missingPremises: string[];
};

export type HypergraphVerificationSummary = {
  proposedActionToken: string;
  isSupported: boolean;
  supportLevel: "obligated" | "allowed" | "unsupported";
  supportingEdgeIds: string[];
};

export type HypergraphRetrieveResponse = {
  candidateEdgeCount: number;
  matchedEdgeCount: number;
  derivedOutcomes: string[];
  candidateEdges: HypergraphCandidateEdge[];
  verification: HypergraphVerificationSummary | null;
};

/**
 * Normalize an ontology response payload to handle missing/renamed fields.
 */
export function normalizeOntologyPayload(
  payload: OntologyNormalizeResponse | null | undefined
): OntologyNormalizeResponse | null {
  if (!payload) return null;
  return {
    ...payload,
    diagnosisAttributeFacts: Array.isArray(payload.diagnosisAttributeFacts)
      ? payload.diagnosisAttributeFacts
      : [],
    mappings: Array.isArray(payload.mappings)
      ? payload.mappings.map((mapping) => ({
          ...mapping,
          ruleExplanations: mapping.ruleExplanations ?? [],
        }))
      : [],
  };
}

/**
 * Normalize a hypergraph retrieval response to handle missing array fields.
 */
export function normalizeHypergraphPayload(
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
            : [],
        }))
      : [],
    verification: payload.verification
      ? {
          ...payload.verification,
          supportingEdgeIds: Array.isArray(payload.verification.supportingEdgeIds)
            ? payload.verification.supportingEdgeIds
            : [],
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------

export function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function displayActor(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "Unknown";
  return trimmed === "system" ? "System (seeded)" : trimmed;
}

export function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
}

// ---------------------------------------------------------------------------
//  Per-tab session identity (each tab gets a fully isolated backend instance)
// ---------------------------------------------------------------------------

const SESSION_STORAGE_KEY = "vph_session_id";

export function getSessionId(): string {
  if (typeof globalThis.sessionStorage === "undefined") {
    return "ssr-placeholder";
  }
  let id = globalThis.sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    globalThis.sessionStorage.setItem(SESSION_STORAGE_KEY, id);
  }
  return id;
}

export function sessionHeaders(
  extra?: Record<string, string>
): Record<string, string> {
  return { "X-Session-Id": getSessionId(), ...extra };
}
