"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { type KernelRule, displayActor, formatTimestamp } from "./kernel-types";
import { TokenCombobox } from "./TokenCombobox";
import { invalidTokens } from "./useTokenRegistry";

export type EditingRule = {
  originalRuleId: string;
  ruleId: string;
  premises: string;
  outcome: string;
  note: string;
  createdBy: string;
};

type RuleCardProps = {
  rule: KernelRule;
  editing: EditingRule | null;
  busy: boolean;
  onEdit?: (rule: KernelRule) => void;
  onRemove?: (ruleId: string) => void;
  onSave?: (data: EditingRule) => void;
  onCancel?: () => void;
  onEditingChange?: (data: EditingRule) => void;
  outcomeOptions?: string[];
  factOptions?: string[];
};

function RuleCard({
  rule,
  editing,
  busy,
  onEdit,
  onRemove,
  onSave,
  onCancel,
  onEditingChange,
  outcomeOptions = [],
  factOptions = [],
}: RuleCardProps) {
  const isEditing = editing?.originalRuleId === rule.ruleId;
  const mutable = !!(onEdit || onRemove);

  if (isEditing && editing && onSave && onCancel && onEditingChange) {
    const outcomeValid = outcomeOptions.length === 0 || outcomeOptions.includes(editing.outcome.trim());
    const badFacts = factOptions.length > 0 ? invalidTokens(editing.premises, factOptions) : [];
    const editValid = !!editing.ruleId.trim() && !!editing.outcome.trim() && outcomeValid && badFacts.length === 0;
    const editErrors: string[] = [];
    if (editing.outcome.trim() && !outcomeValid) editErrors.push(`"${editing.outcome.trim()}" is not a valid outcome.`);
    badFacts.forEach((t) => editErrors.push(`"${t}" is not a valid fact.`));

    return (
      <div className="rounded-2xl border border-indigo-200 bg-indigo-50/30 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-[11px] font-medium text-slate-500">Rule ID</label>
            <input
              type="text"
              value={editing.ruleId}
              onChange={(e) => onEditingChange({ ...editing, ruleId: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-500">Outcome</label>
            <TokenCombobox
              value={editing.outcome}
              onChange={(v) => onEditingChange({ ...editing, outcome: v })}
              options={outcomeOptions}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-[11px] font-medium text-slate-500">
              Premises (comma-separated)
            </label>
            <TokenCombobox
              value={editing.premises}
              onChange={(v) => onEditingChange({ ...editing, premises: v })}
              options={factOptions}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
              multi
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-500">Note</label>
            <input
              type="text"
              value={editing.note}
              onChange={(e) => onEditingChange({ ...editing, note: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-500">Created by</label>
            <input
              type="text"
              value={editing.createdBy}
              onChange={(e) => onEditingChange({ ...editing, createdBy: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
            />
          </div>
        </div>
        {editErrors.length > 0 ? (
          <div className="mt-2 text-xs text-red-600">
            {editErrors.map((err) => (
              <div key={err}>{err}</div>
            ))}
          </div>
        ) : null}
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSave(editing)}
            disabled={busy || !editValid}
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
          >
            Save
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-mono text-xs font-semibold text-slate-900">
            {rule.ruleId}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <Badge className="border border-slate-200 bg-white text-slate-700">
              Added by: {displayActor(rule.createdBy)}
            </Badge>
            <span className="text-slate-400">&middot;</span>
            <span>{formatTimestamp(rule.createdAt)}</span>
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-800">
            {rule.outcome}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="border border-slate-200 bg-white text-slate-700">
            Premises: {rule.premises.length}
          </Badge>
          {mutable ? (
            <div className="flex items-center gap-1">
              {onEdit ? (
                <button
                  type="button"
                  onClick={() => onEdit(rule)}
                  disabled={busy}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  Edit
                </button>
              ) : null}
              {onRemove ? (
                <button
                  type="button"
                  onClick={() => onRemove(rule.ruleId)}
                  disabled={busy}
                  className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-60"
                >
                  Remove
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      {rule.note ? (
        <div className="mt-2 text-xs text-slate-600">{rule.note}</div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {rule.premises.map((premise) => (
          <Badge
            key={`${rule.ruleId}-${premise}`}
            className="border border-slate-200 bg-white font-mono text-slate-700"
          >
            {premise}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export function SearchableRuleList({
  rules,
  emptyMessage,
  editing,
  busy = false,
  onEdit,
  onRemove,
  onSave,
  onCancel,
  onEditingChange,
  outcomeOptions = [],
  factOptions = [],
}: {
  rules: KernelRule[];
  emptyMessage: string;
  editing?: EditingRule | null;
  busy?: boolean;
  onEdit?: (rule: KernelRule) => void;
  onRemove?: (ruleId: string) => void;
  onSave?: (data: EditingRule) => void;
  onCancel?: () => void;
  onEditingChange?: (data: EditingRule) => void;
  outcomeOptions?: string[];
  factOptions?: string[];
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rules;
    return rules.filter(
      (r) =>
        r.ruleId.toLowerCase().includes(q) ||
        r.outcome.toLowerCase().includes(q) ||
        r.note.toLowerCase().includes(q) ||
        r.premises.some((p) => p.toLowerCase().includes(q))
    );
  }, [rules, search]);

  if (rules.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <label className="text-xs font-medium text-slate-600">
          Search rules
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rule id, premise, outcome, note…"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100 md:min-w-[22rem]"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="border border-slate-200 bg-white text-slate-700">
            Showing: {filtered.length}
          </Badge>
          {search.trim() ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
          No rules match your search.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.slice(0, 50).map((rule) => (
            <RuleCard
              key={rule.ruleId}
              rule={rule}
              editing={editing ?? null}
              busy={busy}
              onEdit={onEdit}
              onRemove={onRemove}
              onSave={onSave}
              onCancel={onCancel}
              onEditingChange={onEditingChange}
              outcomeOptions={outcomeOptions}
              factOptions={factOptions}
            />
          ))}
          {filtered.length > 50 ? (
            <div className="text-xs text-slate-500">
              Showing first 50 rules. Refine your search to narrow results.
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
