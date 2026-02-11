"use client";

import Link from "next/link";
import { LayoutGroup, motion } from "framer-motion";
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

const steps = [
  { href: "/", label: "Step 1: Inputs", step: 1 as const, Icon: InputIcon },
  {
    href: "/step-2",
    label: "Step 2: Normalization",
    step: 2 as const,
    Icon: NormalizeIcon
  },
  {
    href: "/step-3",
    label: "Step 3: Retrieval",
    step: 3 as const,
    Icon: RetrievalIcon
  },
  {
    href: "/step-4",
    label: "Step 4: Verification",
    step: 4 as const,
    Icon: VerifyIcon
  }
];

export function StepFlowBar({ currentStep }: StepFlowBarProps) {
  const { clearState } = useSimulationState();

  return (
    <nav
      className="rounded-xl border border-slate-200 bg-white/80 p-2"
      aria-label="Workflow steps"
    >
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
        <LayoutGroup id="workflow-step-tabs">
          <div className="grid flex-1 grid-cols-2 gap-2 lg:grid-cols-4">
            {steps.map(({ href, label, step, Icon }) => {
              const isActive = currentStep === step;
              return (
                <Link
                  key={href}
                  href={href}
                  scroll={false}
                  className="relative overflow-hidden rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium transition-colors hover:bg-slate-100"
                >
                  {isActive ? (
                    <motion.span
                      layoutId="active-step-pill"
                      className="absolute inset-0 rounded-lg bg-slate-800 shadow-[0_10px_24px_rgba(15,23,42,0.25)]"
                      transition={{
                        type: "spring",
                        stiffness: 430,
                        damping: 34,
                        mass: 0.7
                      }}
                    />
                  ) : null}
                  <span
                    className={`relative z-10 inline-flex items-center gap-2 ${
                      isActive ? "text-white" : "text-slate-700"
                    }`}
                  >
                    <Icon className="size-4" />
                    <span>{label}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </LayoutGroup>
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
