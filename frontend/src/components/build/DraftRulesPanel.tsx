"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ConflictWarning,
  type KernelActiveArtifactsResponse,
  type KernelRule,
  displayActor,
  formatTimestamp,
  getApiBaseUrl,
  sessionHeaders,
} from "./kernel-types";
import { type EditingRule, SearchableRuleList } from "./SearchableRuleList";
import { TokenCombobox } from "./TokenCombobox";
import {
  buildOutcomeOptions,
  useTokenRegistry,
  validateFacts,
  validateOutcome,
} from "./useTokenRegistry";

function parsePremises(raw: string): string[] {
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export function DraftRulesPanel() {
  const apiBaseUrl = useMemo(getApiBaseUrl, []);
  const registry = useTokenRegistry();
  const outcomeOptions = useMemo(() => buildOutcomeOptions(registry), [registry]);

  const [data, setData] = useState<KernelActiveArtifactsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<EditingRule | null>(null);
  const [busy, setBusy] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const [newRuleId, setNewRuleId] = useState("");
  const [newOutcome, setNewOutcome] = useState("");
  const [newPremises, setNewPremises] = useState("");
  const [newNote, setNewNote] = useState("");
  const [newCreatedBy, setNewCreatedBy] = useState("");

  async function refresh() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/kernel/active`, {
        headers: sessionHeaders(),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { detail?: string };
        throw new Error(body.detail ?? "Failed to load draft proposals.");
      }
      setData((await res.json()) as KernelActiveArtifactsResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load draft proposals.");
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAdd() {
    const ruleId = newRuleId.trim();
    const outcome = newOutcome.trim();
    if (!ruleId || !outcome) return;
    setBusy(true);
    setMutationError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/kernel/active/rules`, {
        method: "POST",
        headers: sessionHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          ruleId,
          premises: parsePremises(newPremises),
          outcome,
          note: newNote.trim(),
          createdBy: newCreatedBy.trim() || "anonymous",
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { detail?: string };
        throw new Error(body.detail ?? "Failed to add rule.");
      }
      setNewRuleId("");
      setNewOutcome("");
      setNewPremises("");
      setNewNote("");
      setNewCreatedBy("");
      await refresh();
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : "Failed to add rule.");
    } finally {
      setBusy(false);
    }
  }

  function handleStartEdit(rule: KernelRule) {
    setEditing({
      originalRuleId: rule.ruleId,
      ruleId: rule.ruleId,
      premises: rule.premises.join(", "),
      outcome: rule.outcome,
      note: rule.note,
      createdBy: rule.createdBy,
    });
    setMutationError(null);
  }

  async function handleSaveEdit(data: EditingRule) {
    const ruleId = data.ruleId.trim();
    const outcome = data.outcome.trim();
    if (!ruleId || !outcome) return;
    setBusy(true);
    setMutationError(null);

    const originalRuleId = data.originalRuleId;
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/kernel/active/rules/${encodeURIComponent(originalRuleId)}`,
        {
          method: "PUT",
          headers: sessionHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            ruleId,
            premises: parsePremises(data.premises),
            outcome,
            note: data.note.trim(),
            createdBy: data.createdBy.trim() || "anonymous",
          }),
        }
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { detail?: string };
        throw new Error(body.detail ?? "Failed to update rule.");
      }
      setEditing(null);
      await refresh();
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : "Failed to update rule.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(ruleId: string) {
    setBusy(true);
    setMutationError(null);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/kernel/active/rules/${encodeURIComponent(ruleId)}`,
        { method: "DELETE", headers: sessionHeaders() }
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { detail?: string };
        throw new Error(body.detail ?? "Failed to remove rule.");
      }
      if (editing?.ruleId === ruleId) setEditing(null);
      await refresh();
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : "Failed to remove rule.");
    } finally {
      setBusy(false);
    }
  }

  const manifest = data?.manifest ?? null;

  const addValidationErrors = useMemo(() => {
    const errors: string[] = [];
    const ov = validateOutcome(newOutcome, outcomeOptions);
    if (!ov.valid && newOutcome.trim()) errors.push(...ov.errors);
    const fv = validateFacts(newPremises, registry.facts);
    if (!fv.valid) errors.push(...fv.errors);
    return errors;
  }, [newOutcome, newPremises, outcomeOptions, registry]);

  const isAddValid =
    !!newOutcome.trim() && addValidationErrors.length === 0;

  const unresolvableCount = (data?.conflictWarnings ?? []).filter(
    (w) => !w.resolvable
  ).length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">
            Draft proposals
            <span className="ml-2 text-xs font-normal text-slate-500">
              Editable working copy
            </span>
            {unresolvableCount > 0 ? (
              <span className="ml-2 inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                {unresolvableCount} conflict{unresolvableCount > 1 ? "s" : ""}
              </span>
            ) : null}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className="border border-slate-200 bg-white text-slate-700">
              {isLoading ? "Loading\u2026" : `${data?.rulesetRuleCount ?? 0} rules`}
            </Badge>
            <button
              type="button"
              onClick={refresh}
              disabled={isLoading}
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
            >
              Refresh
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {mutationError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {mutationError}
          </div>
        ) : null}

        <ConflictWarningsBanner warnings={data?.conflictWarnings ?? []} />

        {manifest ? (
          <>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Manifest
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Updated by
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    {displayActor(manifest.updatedBy)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Updated at
                  </div>
                  <div className="mt-1 text-sm text-slate-700">
                    {formatTimestamp(manifest.updatedAt)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Version / Rev
                  </div>
                  <div className="mt-1 text-sm text-slate-700">
                    {manifest.rulesetVersion} &middot; r{manifest.revision}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Summary
                  </div>
                  <div className="mt-1 text-sm text-slate-700">
                    {manifest.changeSummary || "\u2014"}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Ruleset
                </div>
                <div className="mt-1 text-2xl font-semibold text-slate-900">
                  {data?.rulesetRuleCount ?? 0}
                </div>
              </div>
              <Link
                href="/build/constraints"
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-indigo-300 hover:bg-indigo-50/40"
              >
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Incompatibility pairs
                </div>
                <div className="mt-1 text-2xl font-semibold text-slate-900">
                  {data?.incompatibilityPairCount ?? 0}
                </div>
                <div className="mt-1 text-[11px] text-indigo-600">
                  View &amp; edit &rarr;
                </div>
              </Link>
              <Link
                href="/build/constraints"
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-indigo-300 hover:bg-indigo-50/40"
              >
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Infeasibility entries
                </div>
                <div className="mt-1 text-2xl font-semibold text-slate-900">
                  {data?.infeasibilityEntryCount ?? 0}
                </div>
                <div className="mt-1 text-[11px] text-indigo-600">
                  View &amp; edit &rarr;
                </div>
              </Link>
              <Link
                href="/build/constraints"
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-indigo-300 hover:bg-indigo-50/40"
              >
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Exclusion groups
                </div>
                <div className="mt-1 text-2xl font-semibold text-slate-900">
                  {data?.factExclusionCount ?? 0}
                </div>
                <div className="mt-1 text-[11px] text-indigo-600">
                  View &amp; edit &rarr;
                </div>
              </Link>
            </div>

            <SearchableRuleList
              rules={data?.ruleset ?? []}
              emptyMessage="No draft rules. All proposals have been promoted to runtime."
              editing={editing}
              busy={busy}
              onEdit={handleStartEdit}
              onRemove={handleRemove}
              onSave={handleSaveEdit}
              onCancel={() => setEditing(null)}
              onEditingChange={setEditing}
              outcomeOptions={outcomeOptions}
              factOptions={registry.facts}
            />

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Add rule
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-[11px] font-medium text-slate-500">Rule ID</label>
                  <input
                    type="text"
                    value={newRuleId}
                    onChange={(e) => setNewRuleId(e.target.value)}
                    placeholder="e.g. hg_my_new_rule"
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-500">Outcome</label>
                  <TokenCombobox
                    value={newOutcome}
                    onChange={setNewOutcome}
                    options={outcomeOptions}
                    placeholder="e.g. Obligated(Action.ImmediateDelivery)"
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-medium text-slate-500">
                    Premises (comma-separated)
                  </label>
                  <TokenCombobox
                    value={newPremises}
                    onChange={setNewPremises}
                    options={registry.facts}
                    placeholder="e.g. Dx.Preeclampsia, DxAttr.Preeclampsia.Severe, Ctx.GA_>=34w"
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
                    multi
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-500">Note</label>
                  <input
                    type="text"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Optional description"
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-500">Created by</label>
                  <input
                    type="text"
                    value={newCreatedBy}
                    onChange={(e) => setNewCreatedBy(e.target.value)}
                    placeholder="anonymous"
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
                  />
                </div>
              </div>
              {addValidationErrors.length > 0 && newOutcome.trim() ? (
                <div className="mt-2 text-xs text-red-600">
                  {addValidationErrors.map((err) => (
                    <div key={err}>{err}</div>
                  ))}
                </div>
              ) : null}
              <div className="mt-3">
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={busy || !newRuleId.trim() || !isAddValid}
                  className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {busy ? "Adding\u2026" : "Add"}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
            {isLoading ? "Loading draft proposals\u2026" : "No draft proposals yet."}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ConflictWarningsBanner({ warnings }: { warnings: ConflictWarning[] }) {
  if (warnings.length === 0) return null;

  const unresolvable = warnings.filter((w) => !w.resolvable);
  const resolvable = warnings.filter((w) => w.resolvable);

  return (
    <div className="space-y-2">
      {unresolvable.length > 0 ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-red-700">
            Unresolvable conflicts ({unresolvable.length})
          </div>
          <p className="mt-1 text-xs text-red-600">
            These rule pairs produce conflicting verdicts on the same action
            with independent premises. Specificity cannot resolve them -- add a
            more specific override rule or revise one of the conflicting rules.
          </p>
          <div className="mt-2 space-y-1.5">
            {unresolvable.map((w) => (
              <div
                key={`${w.ruleAId}--${w.ruleBId}`}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs"
              >
                <Badge className="border border-red-200 bg-red-50 text-red-700">
                  {w.verdictA}
                </Badge>
                <span className="font-mono text-slate-700">{w.ruleAId}</span>
                <span className="text-slate-400">vs</span>
                <Badge className="border border-red-200 bg-red-50 text-red-700">
                  {w.verdictB}
                </Badge>
                <span className="font-mono text-slate-700">{w.ruleBId}</span>
                <span className="text-slate-500">on</span>
                <span className="font-semibold text-slate-800">{w.action}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {resolvable.length > 0 ? (
        <details className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-amber-700">
            Specificity-resolved conflicts ({resolvable.length})
          </summary>
          <p className="mt-1 text-xs text-amber-600">
            These rule pairs conflict on the same action but one has strictly
            more specific premises, so the more specific rule shadows the other.
          </p>
          <div className="mt-2 space-y-1.5">
            {resolvable.map((w) => (
              <div
                key={`${w.ruleAId}--${w.ruleBId}`}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs"
              >
                <Badge className="border border-amber-200 bg-amber-50 text-amber-700">
                  {w.verdictA}
                </Badge>
                <span className="font-mono text-slate-700">{w.ruleAId}</span>
                <span className="text-slate-400">vs</span>
                <Badge className="border border-amber-200 bg-amber-50 text-amber-700">
                  {w.verdictB}
                </Badge>
                <span className="font-mono text-slate-700">{w.ruleBId}</span>
                <span className="text-slate-500">on</span>
                <span className="font-semibold text-slate-800">{w.action}</span>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
