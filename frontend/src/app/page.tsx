"use client";

import { useSimulationState } from "@/components/providers/SimulationStateProvider";
import {
  ContextFactorsCard,
  QuantitativeProfileCard
} from "@/components/selection/ContextSection";
import { PillGroup } from "@/components/selection/PillGroup";
import { ProposedActionSection } from "@/components/selection/ProposedActionSection";
import { Badge } from "@/components/ui/badge";
import { useTokenRegistry } from "@/components/build/useTokenRegistry";

export default function HomePage() {
  const registry = useTokenRegistry();
  const opts = registry.inputOptions;

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
  const selectedActionLabel =
    opts.clinicalActions.find((action) => action.id === selectedAction)?.label ?? null;

  if (opts.diagnoses.length === 0) {
    return (
      <div className="flex w-full items-center justify-center p-12 text-sm text-slate-500">
        Loading clinical options...
      </div>
    );
  }

  return (
    <div className="grid w-full gap-6">
      <section className="flex flex-wrap items-center gap-2">
        {hasRequiredSimulatedInference ? (
          <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700">
            Ready
          </Badge>
        ) : (
          <Badge className="border border-amber-200 bg-amber-50 text-amber-800">
            Needs inputs
          </Badge>
        )}
        <Badge className="border-slate-200 bg-white text-slate-700">
          {selectedActionLabel ?? "No action"}
        </Badge>
        <span className="text-xs text-slate-400">
          Select at least 1 diagnosis and a proposed action.
        </span>
      </section>

      <PillGroup
        title="Bayesian Inference"
        description="Posterior over diagnosis candidates + a proposed clinical action."
        optionsLabel="Conformal Prediction"
        options={opts.diagnoses}
        selected={selectedDiagnoses}
        onToggle={toggleDiagnosis}
        attributeOptionsByOptionId={Object.fromEntries(
          opts.diagnoses
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
            actions={opts.clinicalActions}
            selectedAction={selectedAction}
            onSelectAction={setSelectedAction}
          />
        </>
      </PillGroup>

      <ContextFactorsCard
        comorbidities={opts.comorbidities}
        selectedComorbidities={selectedComorbidities}
        onToggleComorbidity={toggleComorbidity}
        physiologicStates={opts.physiologicStates}
        selectedPhysiologicStates={selectedPhysiologicStates}
        onTogglePhysiologicState={togglePhysiologicState}
      />

      <QuantitativeProfileCard
        gestationalWeeks={gestationalWeeks}
        gestationalAgeMarks={opts.gestationalAgeMarks}
        onChangeGestationalWeeks={setGestationalWeeks}
        maternalAgeYears={maternalAgeYears}
        maternalAgeMarks={opts.maternalAgeMarks}
        onChangeMaternalAgeYears={setMaternalAgeYears}
        bmi={bmi}
        bmiMarks={opts.bmiMarks}
        onChangeBmi={setBmi}
      />
    </div>
  );
}
