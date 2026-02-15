"use client";

import { useSimulationState } from "@/components/providers/SimulationStateProvider";
import { ContextSection } from "@/components/selection/ContextSection";
import { HeroHeader } from "@/components/selection/HeroHeader";
import { PillGroup } from "@/components/selection/PillGroup";
import { ProposedActionSection } from "@/components/selection/ProposedActionSection";
import { StepFlowBar } from "@/components/selection/StepFlowBar";
import {
  clinicalActions,
  bmiMarks,
  comorbidities,
  diagnoses,
  gestationalAgeMarks,
  maternalAgeMarks,
  physiologicStates
} from "@/lib/clinical-options";

export default function HomePage() {
  const {
    state: {
      selectedDiagnoses,
      selectedDiagnosisAttributes,
      selectedComorbidities,
      selectedPhysiologicStates,
      gestationalWeeks,
      maternalAgeYears,
      bmi,
      selectedAction
    },
    toggleDiagnosis,
    toggleDiagnosisAttribute,
    toggleComorbidity,
    togglePhysiologicState,
    setGestationalWeeks,
    setMaternalAgeYears,
    setBmi,
    setSelectedAction
  } = useSimulationState();
  const hasRequiredSimulatedInference =
    selectedDiagnoses.length > 0 && selectedAction !== null;

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 md:gap-6 md:px-6 md:py-10">
      <HeroHeader
        eyebrow="Hypergraph API - Proof of Concept v1.1"
        title="Maternal Health Decision Support Verification"
        subtitle=""
      />
      <StepFlowBar currentStep={1} />

      <div className="grid items-stretch gap-6 lg:grid-cols-12">
        <div className="h-full lg:col-span-6">
          <PillGroup
            title="Simulated AI Inference"
            description="Includes conformal prediction and proposed action."
            optionsLabel="Conformal Prediction"
            options={diagnoses}
            selected={selectedDiagnoses}
            onToggle={toggleDiagnosis}
            attributeOptionsByOptionId={Object.fromEntries(
              diagnoses
                .filter((diagnosis) => diagnosis.availableAttributes?.length)
                .map((diagnosis) => [
                  diagnosis.id,
                  diagnosis.availableAttributes ?? []
                ])
            )}
            selectedAttributesByOptionId={selectedDiagnosisAttributes}
            onToggleAttribute={toggleDiagnosisAttribute}
          >
            <>
              <ProposedActionSection
                actions={clinicalActions}
                selectedAction={selectedAction}
                onSelectAction={setSelectedAction}
              />
              {!hasRequiredSimulatedInference ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Required to proceed: choose at least one diagnosis and one
                  proposed action.
                </div>
              ) : (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  Required simulated AI inference complete.
                </div>
              )}
            </>
          </PillGroup>
        </div>

        <div className="h-full lg:col-span-6">
          <ContextSection
            comorbidities={comorbidities}
            selectedComorbidities={selectedComorbidities}
            onToggleComorbidity={toggleComorbidity}
            physiologicStates={physiologicStates}
            selectedPhysiologicStates={selectedPhysiologicStates}
            onTogglePhysiologicState={togglePhysiologicState}
            gestationalWeeks={gestationalWeeks}
            gestationalAgeMarks={gestationalAgeMarks}
            onChangeGestationalWeeks={setGestationalWeeks}
            maternalAgeYears={maternalAgeYears}
            maternalAgeMarks={maternalAgeMarks}
            onChangeMaternalAgeYears={setMaternalAgeYears}
            bmi={bmi}
            bmiMarks={bmiMarks}
            onChangeBmi={setBmi}
          />
        </div>
      </div>

    </main>
  );
}
