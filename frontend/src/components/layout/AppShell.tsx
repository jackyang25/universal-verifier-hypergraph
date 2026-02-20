"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { RouteTransition } from "@/components/providers/RouteTransition";
import { useSimulationState } from "@/components/providers/SimulationStateProvider";
import { Badge } from "@/components/ui/badge";
import {
  CubeIcon,
  DocumentIcon,
  GitHubIcon,
  GridIcon,
  InputIcon,
  LinkChainIcon,
  NormalizeIcon,
  RetrievalIcon,
  VerifyIcon
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";

type StepStatus = "complete" | "ready" | "blocked";

const APP_TITLE = "Obstetrics Decision Support Dashboard";
const APP_EYEBROW = "Lean-verified protocol engine";
const DOCS_URL = "https://www.overleaf.com/read/cpkdxmxtkpfs#ef562e";
const DOCS_LABEL = "Cohere Docs";
const DOCS_TOOLTIP = "Overleaf: Lean verification spec";
const GITHUB_DASHBOARD_URL = "https://github.com/jackyang25/verified-protocol-hypergraph";
const GITHUB_KERNEL_URL = "https://github.com/jackyang25/cohere";

type WorkflowStep = {
  href: "/" | "/step-2" | "/step-3" | "/step-4";
  label: string;
  description: string;
  Icon: (props: { className?: string }) => React.ReactNode;
};

type BuildStep = {
  href: "/build" | "/build/rules" | "/build/constraints" | "/build/hypergraph";
  label: string;
  description: string;
  Icon: (props: { className?: string }) => React.ReactNode;
};

const workflowSteps: WorkflowStep[] = [
  {
    href: "/",
    label: "Inputs",
    description: "Select diagnoses, context, and a proposed action.",
    Icon: InputIcon
  },
  {
    href: "/step-2",
    label: "Normalization",
    description: "Encode selections into canonical ontology facts.",
    Icon: NormalizeIcon
  },
  {
    href: "/step-3",
    label: "Retrieval",
    description: "Match facts against hyperedges and derive outcomes.",
    Icon: RetrievalIcon
  },
  {
    href: "/step-4",
    label: "Verification",
    description: "Validate action support and emit a certificate.",
    Icon: VerifyIcon
  }
];

const buildSteps: BuildStep[] = [
  {
    href: "/build",
    label: "Build overview",
    description: "Preview build artifacts and versioned outputs.",
    Icon: GridIcon
  },
  {
    href: "/build/rules",
    label: "Ruleset",
    description: "Prepare ontology + rule inputs for compilation.",
    Icon: DocumentIcon
  },
  {
    href: "/build/constraints",
    label: "Constraints",
    description: "Define incompatibility and infeasibility rules.",
    Icon: LinkChainIcon
  },
  {
    href: "/build/hypergraph",
    label: "Publish and verify",
    description: "Compile, verify invariants, and promote to runtime.",
    Icon: CubeIcon
  }
];

function statusForStep({
  href,
  hasRequiredInputs,
  hasNormalizedOntology,
  hasHypergraphRetrieval,
  hasActionToken
}: {
  href: WorkflowStep["href"];
  hasRequiredInputs: boolean;
  hasNormalizedOntology: boolean;
  hasHypergraphRetrieval: boolean;
  hasActionToken: boolean;
}): StepStatus {
  if (href === "/") {
    return hasRequiredInputs ? "complete" : "ready";
  }
  if (href === "/step-2") {
    if (!hasRequiredInputs) return "blocked";
    return hasNormalizedOntology ? "complete" : "ready";
  }
  if (href === "/step-3") {
    if (!hasNormalizedOntology) return "blocked";
    return hasHypergraphRetrieval ? "complete" : "ready";
  }
  if (href === "/step-4") {
    if (!hasHypergraphRetrieval || !hasActionToken) return "blocked";
    return "ready";
  }
  return "blocked";
}

function StatusDot({ status }: { status: StepStatus }) {
  const className =
    status === "complete"
      ? "bg-emerald-500"
      : status === "ready"
        ? "bg-indigo-500"
        : "bg-slate-300";
  return <span className={cn("inline-flex size-2.5 rounded-full", className)} />;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { state, clearState } = useSimulationState();

  const normalizedPath = useMemo(
    () => (pathname === "/" ? "/" : pathname.replace(/\/$/, "")),
    [pathname]
  );
  const isBuildRoute = useMemo(
    () => normalizedPath === "/build" || normalizedPath.startsWith("/build/"),
    [normalizedPath]
  );

  const activeStep = useMemo(() => {
    return workflowSteps.find((step) => step.href === normalizedPath) ?? null;
  }, [normalizedPath]);

  const activeBuildStep = useMemo(() => {
    return buildSteps.find((step) => step.href === normalizedPath) ?? null;
  }, [normalizedPath]);

  const shellTitle = useMemo(() => {
    if (isBuildRoute) return activeBuildStep?.label ?? "Build";
    return activeStep?.label ?? "Dashboard";
  }, [activeBuildStep, activeStep, isBuildRoute]);

  const snapshot = useMemo(() => {
    const hasRequiredInputs =
      state.selectedDiagnoses.length > 0 && Boolean(state.selectedAction);
    const hasNormalizedOntology = Boolean(state.normalizedOntology);
    const hasHypergraphRetrieval = Boolean(state.hypergraphRetrieval);
    const hasActionToken = Boolean(state.normalizedOntology?.actionToken);

    return {
      hasRequiredInputs,
      hasNormalizedOntology,
      hasHypergraphRetrieval,
      hasActionToken,
      diagnosisCount: state.selectedDiagnoses.length,
      contextCount:
        state.selectedComorbidities.length + state.selectedPhysiologicStates.length,
      factCount: state.normalizedOntology?.facts.length ?? 0,
      matchedRuleCount: state.hypergraphRetrieval?.matchedEdgeCount ?? 0
    };
  }, [state]);

  return (
    <div className="h-screen overflow-hidden">
      <div className="mx-auto flex h-screen w-full">
        {/* ── Sidebar ──────────────────────────────────────────── */}
        <aside className="sticky top-0 hidden h-screen w-[19rem] shrink-0 border-r border-slate-200/70 bg-white/55 p-4 backdrop-blur-xl md:block">
          <div className="flex h-full flex-col gap-3">
            {/* app identity */}
            <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="text-sm font-semibold tracking-tight text-slate-900">
                  {APP_TITLE}
                </div>
                <Badge className="border border-indigo-200 bg-indigo-50 text-indigo-700">
                  Preview
                </Badge>
              </div>
              <div className="mt-1 text-xs text-slate-500">{APP_EYEBROW}</div>
            </div>

            {/* Runtime navigation */}
            <nav className="space-y-1 overflow-y-auto rounded-2xl border border-slate-200/70 bg-white/70 p-3 shadow-sm">
              <div className="px-3 pb-1 pt-1">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Runtime
                </div>
              </div>
              <div className="space-y-1">
                {workflowSteps.map((step) => {
                  const isActive = normalizedPath === step.href;
                  const status = statusForStep({
                    href: step.href,
                    hasRequiredInputs: snapshot.hasRequiredInputs,
                    hasNormalizedOntology: snapshot.hasNormalizedOntology,
                    hasHypergraphRetrieval: snapshot.hasHypergraphRetrieval,
                    hasActionToken: snapshot.hasActionToken
                  });
                  const Icon = step.Icon;

                  return (
                    <Link
                      key={step.href}
                      href={step.href}
                      scroll={false}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "group flex items-start gap-3 rounded-xl px-3 py-2.5 transition",
                        isActive
                          ? "bg-slate-900 text-white shadow-[0_18px_40px_rgba(15,23,42,0.22)]"
                          : "text-slate-700 hover:bg-slate-100/80"
                      )}
                    >
                      <div
                        className={cn(
                          "mt-0.5 inline-flex size-9 items-center justify-center rounded-xl border",
                          isActive
                            ? "border-white/15 bg-white/10"
                            : "border-slate-200 bg-white"
                        )}
                      >
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="truncate text-sm font-semibold">
                            {step.label}
                          </div>
                          <StatusDot status={status} />
                        </div>
                        <div
                          className={cn(
                            "mt-0.5 line-clamp-2 text-xs",
                            isActive ? "text-white/80" : "text-slate-500"
                          )}
                        >
                          {step.description}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>

              {/* snapshot counters */}
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                <div className="flex flex-1 items-center justify-around text-xs">
                  {[
                    { value: snapshot.diagnosisCount, label: "Dx" },
                    { value: snapshot.contextCount, label: "Ctx" },
                    { value: snapshot.factCount, label: "Facts" },
                    { value: snapshot.matchedRuleCount, label: "Rules" },
                  ].map((item) => (
                    <div key={item.label} className="text-center">
                      <div className="text-sm font-semibold text-slate-900">
                        {item.value}
                      </div>
                      <div className="text-[10px] text-slate-500">{item.label}</div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={clearState}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  Clear
                </button>
              </div>
            </nav>

            {/* Build navigation */}
            <nav className="space-y-1 overflow-y-auto rounded-2xl border border-slate-200/70 bg-white/70 p-3 shadow-sm">
              <div className="px-3 pb-1 pt-1">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Build
                </div>
              </div>
              <div className="space-y-1">
                {buildSteps.map((step) => {
                  const isActive = normalizedPath === step.href;
                  const Icon = step.Icon;
                  return (
                    <Link
                      key={step.href}
                      href={step.href}
                      scroll={false}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "group flex items-start gap-3 rounded-xl px-3 py-2.5 transition",
                        isActive
                          ? "bg-slate-900 text-white shadow-[0_18px_40px_rgba(15,23,42,0.22)]"
                          : "text-slate-700 hover:bg-slate-100/80"
                      )}
                    >
                      <div
                        className={cn(
                          "mt-0.5 inline-flex size-9 items-center justify-center rounded-xl border",
                          isActive
                            ? "border-white/15 bg-white/10"
                            : "border-slate-200 bg-white"
                        )}
                      >
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">
                          {step.label}
                        </div>
                        <div
                          className={cn(
                            "mt-0.5 line-clamp-2 text-xs",
                            isActive ? "text-white/80" : "text-slate-500"
                          )}
                        >
                          {step.description}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </nav>

            {/* footer */}
            <div className="mt-auto px-4 text-right">
              <span className="text-[11px] text-slate-400">Version 1.1</span>
            </div>
          </div>
        </aside>

        {/* ── Main content ─────────────────────────────────────── */}
        <div className="flex h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/40 backdrop-blur-xl">
            <div className="px-6 py-3 md:px-8">
              <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {isBuildRoute ? "Build" : "Runtime"}
                  </div>
                  <div className="truncate text-base font-semibold text-slate-900">
                    {shellTitle}
                  </div>
                </div>
                <nav
                  aria-label="Workflow steps"
                  className="flex items-center gap-1 md:hidden"
                >
                  {(isBuildRoute ? buildSteps : workflowSteps).map((step) => {
                    const isActive = normalizedPath === step.href;
                    const Icon = step.Icon;
                    const dotClassName = isBuildRoute
                      ? "bg-slate-300"
                      : (() => {
                          const status = statusForStep({
                            href: step.href as WorkflowStep["href"],
                            hasRequiredInputs: snapshot.hasRequiredInputs,
                            hasNormalizedOntology: snapshot.hasNormalizedOntology,
                            hasHypergraphRetrieval: snapshot.hasHypergraphRetrieval,
                            hasActionToken: snapshot.hasActionToken
                          });
                          return status === "complete"
                            ? "bg-emerald-500"
                            : status === "ready"
                              ? "bg-indigo-500"
                              : "bg-slate-300";
                        })();

                    return (
                      <Link
                        key={step.href}
                        href={step.href}
                        scroll={false}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "relative inline-flex size-10 items-center justify-center rounded-xl border transition",
                          isActive
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        )}
                      >
                        <Icon className="size-4" />
                        <span className="sr-only">{step.label}</span>
                        <span
                          className={cn(
                            "absolute right-1 top-1 size-2 rounded-full",
                            dotClassName
                          )}
                          aria-hidden="true"
                        />
                      </Link>
                    );
                  })}
                </nav>
                <div className="hidden items-center gap-2 md:flex">
                  <a
                    href={DOCS_URL}
                    target="_blank"
                    rel="noreferrer"
                    title={DOCS_TOOLTIP}
                    className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    {DOCS_LABEL}
                  </a>
                  <a
                    href={GITHUB_DASHBOARD_URL}
                    target="_blank"
                    rel="noreferrer"
                    title="GitHub: Dashboard repo"
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    <GitHubIcon className="size-3.5" />
                    Dashboard
                  </a>
                  <a
                    href={GITHUB_KERNEL_URL}
                    target="_blank"
                    rel="noreferrer"
                    title="GitHub: Cohere kernel repo"
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    <GitHubIcon className="size-3.5" />
                    Kernel
                  </a>
                </div>
              </div>
            </div>
          </header>

          <main className="min-w-0 flex-1 overflow-y-auto px-6 py-8 md:px-8 md:py-10">
            <div className="mx-auto w-full max-w-7xl">
              <RouteTransition>{children}</RouteTransition>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
