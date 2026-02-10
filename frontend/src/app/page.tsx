"use client";

import { useMemo, useState } from "react";
import { ContextSection } from "@/components/selection/ContextSection";
import { HeroHeader } from "@/components/selection/HeroHeader";
import { PillGroup } from "@/components/selection/PillGroup";
import { ProposedActionSection } from "@/components/selection/ProposedActionSection";
import { SelectionSummary } from "@/components/selection/SelectionSummary";
import {
  clinicalActions,
  comorbidities,
  diagnoses,
  gestationalAgeMarks,
  physiologicStates
} from "@/lib/clinical-options";
import { toggleSelection } from "@/lib/selection";

export default function HomePage() {
  const [selectedDiagnoses, setSelectedDiagnoses] = useState<string[]>([]);
  const [selectedComorbidities, setSelectedComorbidities] = useState<string[]>(
    []
  );
  const [selectedPhysiologicStates, setSelectedPhysiologicStates] = useState<
    string[]
  >([]);
  const [gestationalWeeks, setGestationalWeeks] = useState(31);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);

  const totalSelected = useMemo(
    () =>
      selectedDiagnoses.length +
      selectedComorbidities.length +
      selectedPhysiologicStates.length,
    [selectedDiagnoses, selectedComorbidities, selectedPhysiologicStates]
  );

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 md:gap-6 md:px-6 md:py-10">
      <HeroHeader
        eyebrow="Clinical Selection Interface"
        title="Maternal Health Decision Support Verification"
        subtitle=""
      />

      <div className="grid items-stretch gap-6 lg:grid-cols-12">
        <div className="h-full lg:col-span-5">
          <PillGroup
            title="Simulated AI Inference"
            description="Includes conformal prediction and proposed action."
            optionsLabel="Conformal Prediction"
            options={diagnoses}
            selected={selectedDiagnoses}
            onToggle={(value) =>
              setSelectedDiagnoses((current) => toggleSelection(current, value))
            }
          >
            <ProposedActionSection
              actions={clinicalActions}
              selectedAction={selectedAction}
              onSelectAction={setSelectedAction}
            />
          </PillGroup>
        </div>

        <div className="h-full lg:col-span-7">
          <ContextSection
            comorbidities={comorbidities}
            selectedComorbidities={selectedComorbidities}
            onToggleComorbidity={(value) =>
              setSelectedComorbidities((current) => toggleSelection(current, value))
            }
            physiologicStates={physiologicStates}
            selectedPhysiologicStates={selectedPhysiologicStates}
            onTogglePhysiologicState={(value) =>
              setSelectedPhysiologicStates((current) =>
                toggleSelection(current, value)
              )
            }
            gestationalWeeks={gestationalWeeks}
            gestationalAgeMarks={gestationalAgeMarks}
            onChangeGestationalWeeks={setGestationalWeeks}
          />
        </div>
      </div>

      <SelectionSummary
        totalSelected={totalSelected}
        gestationalWeeks={gestationalWeeks}
        selectedAction={selectedAction}
      />
    </main>
  );
}
