"use client";

import Link from "next/link";
import { useSimulationState } from "@/components/providers/SimulationStateProvider";
import {
  InputIcon,
  NormalizeIcon,
  RetrievalIcon,
  VerifyIcon
} from "@/components/ui/icons";

type StepFlowBarProps = {
  currentStep: 1 | 2 | 3 | 4;
};

export function StepFlowBar({ currentStep }: StepFlowBarProps) {
  const { clearState } = useSimulationState();

  return (
    <nav
      className="rounded-xl border border-slate-200 bg-white/80 p-2"
      aria-label="Workflow steps"
    >
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
        <div className="grid flex-1 grid-cols-2 gap-2 lg:grid-cols-4">
          <Link
            href="/"
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              currentStep === 1
                ? "bg-blue-600 text-white"
                : "bg-slate-50 text-slate-700 hover:bg-slate-100"
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <InputIcon className="size-4" />
              <span>Step 1: Inputs</span>
            </span>
          </Link>
          <Link
            href="/step-2"
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              currentStep === 2
                ? "bg-blue-600 text-white"
                : "bg-slate-50 text-slate-700 hover:bg-slate-100"
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <NormalizeIcon className="size-4" />
              <span>Step 2: Normalization</span>
            </span>
          </Link>
          <Link
            href="/step-3"
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              currentStep === 3
                ? "bg-blue-600 text-white"
                : "bg-slate-50 text-slate-700 hover:bg-slate-100"
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <RetrievalIcon className="size-4" />
              <span>Step 3: Retrieval</span>
            </span>
          </Link>
          <Link
            href="/step-4"
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              currentStep === 4
                ? "bg-blue-600 text-white"
                : "bg-slate-50 text-slate-700 hover:bg-slate-100"
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <VerifyIcon className="size-4" />
              <span>Step 4: Verification</span>
            </span>
          </Link>
        </div>
        <button
          type="button"
          onClick={clearState}
          className="self-end whitespace-nowrap rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 lg:self-auto"
        >
          Clear selections
        </button>
      </div>
    </nav>
  );
}
