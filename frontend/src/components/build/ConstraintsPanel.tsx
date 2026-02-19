"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type IncompatibilityPair,
  type InfeasibilityEntry,
  type KernelActiveArtifactsResponse,
  displayActor,
  formatTimestamp,
  getApiBaseUrl,
} from "./kernel-types";
import { TokenCombobox } from "./TokenCombobox";
import { useTokenRegistry, validateAction, validateFacts } from "./useTokenRegistry";

type EditingIncompat = { index: number; a: string; b: string };
type EditingInfeas = { index: number; action: string; premises: string };

export function ConstraintsPanel() {
  const apiBaseUrl = useMemo(getApiBaseUrl, []);
  const registry = useTokenRegistry();

  const [data, setData] = useState<KernelActiveArtifactsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/kernel/active`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { detail?: string };
        throw new Error(body.detail ?? "Failed to load draft.");
      }
      setData((await res.json()) as KernelActiveArtifactsResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load draft.");
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <IncompatibilitySection
        pairs={data?.incompatibility ?? []}
        apiBaseUrl={apiBaseUrl}
        isLoading={isLoading}
        onMutated={refresh}
        actionOptions={registry.actions}
      />

      <InfeasibilitySection
        entries={data?.infeasibility ?? []}
        apiBaseUrl={apiBaseUrl}
        isLoading={isLoading}
        onMutated={refresh}
        actionOptions={registry.actions}
        factOptions={registry.facts}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Incompatibility section                                                   */
/* -------------------------------------------------------------------------- */

function IncompatibilitySection({
  pairs,
  apiBaseUrl,
  isLoading,
  onMutated,
  actionOptions,
}: {
  pairs: IncompatibilityPair[];
  apiBaseUrl: string;
  isLoading: boolean;
  onMutated: () => Promise<void>;
  actionOptions: string[];
}) {
  const [newA, setNewA] = useState("");
  const [newB, setNewB] = useState("");
  const [newCreatedBy, setNewCreatedBy] = useState("");
  const [editing, setEditing] = useState<EditingIncompat | null>(null);
  const [busy, setBusy] = useState(false);
  const [sectionError, setSectionError] = useState<string | null>(null);

  const addValidationErrors = useMemo(() => {
    const errors: string[] = [];
    if (newA.trim()) {
      const va = validateAction(newA, actionOptions);
      if (!va.valid) errors.push(...va.errors);
    }
    if (newB.trim()) {
      const vb = validateAction(newB, actionOptions);
      if (!vb.valid) errors.push(...vb.errors);
    }
    return errors;
  }, [newA, newB, actionOptions]);
  const isAddValid = !!newA.trim() && !!newB.trim() && addValidationErrors.length === 0;

  async function handleAdd() {
    const a = newA.trim();
    const b = newB.trim();
    if (!a || !b) return;
    setBusy(true);
    setSectionError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/kernel/active/incompatibility`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ a, b, createdBy: newCreatedBy.trim() || "anonymous" }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { detail?: string };
        throw new Error(body.detail ?? "Failed to add pair.");
      }
      setNewA("");
      setNewB("");
      setNewCreatedBy("");
      await onMutated();
    } catch (err) {
      setSectionError(err instanceof Error ? err.message : "Failed to add pair.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdate() {
    if (!editing) return;
    const a = editing.a.trim();
    const b = editing.b.trim();
    if (!a || !b) return;
    setBusy(true);
    setSectionError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/kernel/active/incompatibility/${editing.index}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ a, b }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { detail?: string };
        throw new Error(body.detail ?? "Failed to update pair.");
      }
      setEditing(null);
      await onMutated();
    } catch (err) {
      setSectionError(err instanceof Error ? err.message : "Failed to update pair.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(index: number) {
    setBusy(true);
    setSectionError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/kernel/active/incompatibility/${index}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { detail?: string };
        throw new Error(body.detail ?? "Failed to remove pair.");
      }
      if (editing?.index === index) setEditing(null);
      await onMutated();
    } catch (err) {
      setSectionError(err instanceof Error ? err.message : "Failed to remove pair.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">
            Incompatibility pairs
            <span className="ml-2 text-xs font-normal text-slate-500">
              Actions that cannot coexist
            </span>
          </CardTitle>
          <Badge className="border border-slate-200 bg-white text-slate-700">
            {isLoading ? "Loading\u2026" : `${pairs.length} pairs`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <p className="text-xs text-slate-500">
          Two actions are incompatible when they must not both be obligated for the
          same patient fact set.
        </p>

        {sectionError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {sectionError}
          </div>
        ) : null}

        {pairs.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">#</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Action A</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">&harr;</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Action B</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Added by</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pairs.map((pair, idx) => {
                  const isEditing = editing?.index === idx;
                  return (
                    <tr key={idx} className="border-b border-slate-100 last:border-b-0">
                      <td className="px-4 py-2 text-xs text-slate-400">{idx}</td>
                      {isEditing ? (
                        <>
                          <td className="px-4 py-2">
                            <TokenCombobox
                              value={editing.a}
                              onChange={(v) => setEditing({ ...editing, a: v })}
                              options={actionOptions}
                              className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                            />
                          </td>
                          <td className="px-4 py-2 text-center text-slate-400">&harr;</td>
                          <td className="px-4 py-2">
                            <TokenCombobox
                              value={editing.b}
                              onChange={(v) => setEditing({ ...editing, b: v })}
                              options={actionOptions}
                              className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                            />
                          </td>
                          <td className="px-4 py-2 text-xs text-slate-400">{displayActor(pair.createdBy)}</td>
                          <td className="px-4 py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button type="button" onClick={handleUpdate} disabled={busy} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60">Save</button>
                              <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50">Cancel</button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-2">
                            <Badge className="border border-slate-200 bg-white font-mono text-[11px] text-slate-700">{pair.a}</Badge>
                          </td>
                          <td className="px-4 py-2 text-center text-slate-400">&harr;</td>
                          <td className="px-4 py-2">
                            <Badge className="border border-slate-200 bg-white font-mono text-[11px] text-slate-700">{pair.b}</Badge>
                          </td>
                          <td className="px-4 py-2">
                            <span className="text-xs text-slate-500">{displayActor(pair.createdBy)}</span>
                            {pair.createdAt && pair.createdAt !== "seed" ? (
                              <span className="ml-1 text-[10px] text-slate-400">{formatTimestamp(pair.createdAt)}</span>
                            ) : null}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button type="button" onClick={() => setEditing({ index: idx, a: pair.a, b: pair.b })} disabled={busy} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60">Edit</button>
                              <button type="button" onClick={() => handleDelete(idx)} disabled={busy} className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-60">Remove</button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
            {isLoading ? "Loading\u2026" : "No incompatibility pairs defined."}
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Add pair
          </div>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            <div className="min-w-0">
              <label className="text-[11px] font-medium text-slate-500">Action A</label>
              <TokenCombobox value={newA} onChange={setNewA} options={actionOptions} placeholder="e.g. Action.ImmediateDelivery" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm" />
            </div>
            <div className="min-w-0">
              <label className="text-[11px] font-medium text-slate-500">Action B</label>
              <TokenCombobox value={newB} onChange={setNewB} options={actionOptions} placeholder="e.g. Action.ExpectantManagement" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm" />
            </div>
            <div className="min-w-0">
              <label className="text-[11px] font-medium text-slate-500">Created by</label>
              <input type="text" value={newCreatedBy} onChange={(e) => setNewCreatedBy(e.target.value)} placeholder="anonymous" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm" />
            </div>
          </div>
          {addValidationErrors.length > 0 && (newA.trim() || newB.trim()) ? (
            <div className="mt-2 text-xs text-red-600">
              {addValidationErrors.map((err) => (
                <div key={err}>{err}</div>
              ))}
            </div>
          ) : null}
          <div className="mt-3">
            <button type="button" onClick={handleAdd} disabled={busy || !isAddValid} className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70">
              {busy ? "Adding\u2026" : "Add"}
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Infeasibility section                                                     */
/* -------------------------------------------------------------------------- */

function InfeasibilitySection({
  entries,
  apiBaseUrl,
  isLoading,
  onMutated,
  actionOptions,
  factOptions,
}: {
  entries: InfeasibilityEntry[];
  apiBaseUrl: string;
  isLoading: boolean;
  onMutated: () => Promise<void>;
  actionOptions: string[];
  factOptions: string[];
}) {
  const [newAction, setNewAction] = useState("");
  const [newFacts, setNewFacts] = useState("");
  const [newCreatedBy, setNewCreatedBy] = useState("");
  const [editing, setEditing] = useState<EditingInfeas | null>(null);
  const [busy, setBusy] = useState(false);
  const [sectionError, setSectionError] = useState<string | null>(null);

  const addValidationErrors = useMemo(() => {
    const errors: string[] = [];
    if (newAction.trim()) {
      const va = validateAction(newAction, actionOptions);
      if (!va.valid) errors.push(...va.errors);
    }
    const fv = validateFacts(newFacts, factOptions);
    if (!fv.valid) errors.push(...fv.errors);
    return errors;
  }, [newAction, newFacts, actionOptions, factOptions]);
  const isAddValid = !!newAction.trim() && addValidationErrors.length === 0;

  function parseFacts(raw: string): string[] {
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }

  async function handleAdd() {
    const action = newAction.trim();
    if (!action) return;
    setBusy(true);
    setSectionError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/kernel/active/infeasibility`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          premises: parseFacts(newFacts),
          createdBy: newCreatedBy.trim() || "anonymous",
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { detail?: string };
        throw new Error(body.detail ?? "Failed to add entry.");
      }
      setNewAction("");
      setNewFacts("");
      setNewCreatedBy("");
      await onMutated();
    } catch (err) {
      setSectionError(err instanceof Error ? err.message : "Failed to add entry.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdate() {
    if (!editing) return;
    const action = editing.action.trim();
    if (!action) return;
    setBusy(true);
    setSectionError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/kernel/active/infeasibility/${editing.index}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, premises: parseFacts(editing.premises) }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { detail?: string };
        throw new Error(body.detail ?? "Failed to update entry.");
      }
      setEditing(null);
      await onMutated();
    } catch (err) {
      setSectionError(err instanceof Error ? err.message : "Failed to update entry.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(index: number) {
    setBusy(true);
    setSectionError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/kernel/active/infeasibility/${index}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { detail?: string };
        throw new Error(body.detail ?? "Failed to remove entry.");
      }
      if (editing?.index === index) setEditing(null);
      await onMutated();
    } catch (err) {
      setSectionError(err instanceof Error ? err.message : "Failed to remove entry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">
            Infeasibility table
            <span className="ml-2 text-xs font-normal text-slate-500">
              Conditions that make an action infeasible
            </span>
          </CardTitle>
          <Badge className="border border-slate-200 bg-white text-slate-700">
            {isLoading ? "Loading\u2026" : `${entries.length} entries`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <p className="text-xs text-slate-500">
          Every action is feasible by default. An entry fires when its premises are a subset of the
          patient&apos;s fact set, making the action infeasible.
        </p>

        {sectionError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {sectionError}
          </div>
        ) : null}

        {entries.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">#</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Action</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">&rarr;</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Premises</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Added by</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, idx) => {
                  const isEditing = editing?.index === idx;
                  return (
                    <tr key={idx} className="border-b border-slate-100 last:border-b-0">
                      <td className="px-4 py-2 text-xs text-slate-400">{idx}</td>
                      {isEditing ? (
                        <>
                          <td className="px-4 py-2">
                            <TokenCombobox value={editing.action} onChange={(v) => setEditing({ ...editing, action: v })} options={actionOptions} className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm" />
                          </td>
                          <td className="px-4 py-2 text-center text-slate-400">&rarr;</td>
                          <td className="px-4 py-2">
                            <TokenCombobox value={editing.premises} onChange={(v) => setEditing({ ...editing, premises: v })} options={factOptions} placeholder="comma-separated premises" className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm" multi />
                          </td>
                          <td className="px-4 py-2 text-xs text-slate-400">{displayActor(entry.createdBy)}</td>
                          <td className="px-4 py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button type="button" onClick={handleUpdate} disabled={busy} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60">Save</button>
                              <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50">Cancel</button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-2">
                            <Badge className="border border-slate-200 bg-white font-mono text-[11px] text-slate-700">{entry.action}</Badge>
                          </td>
                          <td className="px-4 py-2 text-center text-slate-400">&rarr;</td>
                          <td className="px-4 py-2">
                            {entry.premises.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {entry.premises.map((fact) => (
                                  <Badge key={fact} className="border border-slate-200 bg-white font-mono text-[11px] text-slate-700">{fact}</Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">Always infeasible</span>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            <span className="text-xs text-slate-500">{displayActor(entry.createdBy)}</span>
                            {entry.createdAt && entry.createdAt !== "seed" ? (
                              <span className="ml-1 text-[10px] text-slate-400">{formatTimestamp(entry.createdAt)}</span>
                            ) : null}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button type="button" onClick={() => setEditing({ index: idx, action: entry.action, premises: entry.premises.join(", ") })} disabled={busy} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60">Edit</button>
                              <button type="button" onClick={() => handleDelete(idx)} disabled={busy} className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-60">Remove</button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
            {isLoading ? "Loading\u2026" : "No infeasibility entries. All actions are feasible by default."}
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Add entry
          </div>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            <div className="min-w-0">
              <label className="text-[11px] font-medium text-slate-500">Action</label>
              <TokenCombobox value={newAction} onChange={setNewAction} options={actionOptions} placeholder="e.g. Action.ExpectantManagement" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm" />
            </div>
            <div className="min-w-0">
              <label className="text-[11px] font-medium text-slate-500">Premises (comma-separated)</label>
              <TokenCombobox value={newFacts} onChange={setNewFacts} options={factOptions} placeholder="e.g. Dx.FetalDemise" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm" multi />
            </div>
            <div className="min-w-0">
              <label className="text-[11px] font-medium text-slate-500">Created by</label>
              <input type="text" value={newCreatedBy} onChange={(e) => setNewCreatedBy(e.target.value)} placeholder="anonymous" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm" />
            </div>
          </div>
          {addValidationErrors.length > 0 && newAction.trim() ? (
            <div className="mt-2 text-xs text-red-600">
              {addValidationErrors.map((err) => (
                <div key={err}>{err}</div>
              ))}
            </div>
          ) : null}
          <div className="mt-3">
            <button type="button" onClick={handleAdd} disabled={busy || !isAddValid} className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70">
              {busy ? "Adding\u2026" : "Add"}
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
