import { Pill } from "@/components/selection/Pill";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ContextSectionProps = {
  comorbidities: string[];
  selectedComorbidities: string[];
  onToggleComorbidity: (value: string) => void;
  physiologicStates: string[];
  selectedPhysiologicStates: string[];
  onTogglePhysiologicState: (value: string) => void;
  gestationalWeeks: number;
  gestationalAgeMarks: number[];
  onChangeGestationalWeeks: (value: number) => void;
};

export function ContextSection({
  comorbidities,
  selectedComorbidities,
  onToggleComorbidity,
  physiologicStates,
  selectedPhysiologicStates,
  onTogglePhysiologicState,
  gestationalWeeks,
  gestationalAgeMarks,
  onChangeGestationalWeeks
}: ContextSectionProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Additional Patient Context</CardTitle>
        <p className="mt-1 text-sm text-slate-500">
          Inputs not gathered by conformal prediction or the decision support
          module.
        </p>
      </CardHeader>

      <CardContent className="space-y-5 pt-0">
        <div>
          <h3 className="mb-2 text-sm font-medium text-slate-600">
            Background Factors
          </h3>
          <div className="flex flex-wrap gap-2.5">
            {comorbidities.map((item) => (
              <Pill
                key={item}
                label={item}
                isActive={selectedComorbidities.includes(item)}
                onToggle={() => onToggleComorbidity(item)}
              />
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-medium text-slate-600">
            Clinical Findings and States
          </h3>
          <div className="flex flex-wrap gap-2.5">
            {physiologicStates.map((item) => (
              <Pill
                key={item}
                label={item}
                isActive={selectedPhysiologicStates.includes(item)}
                onToggle={() => onTogglePhysiologicState(item)}
              />
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-medium text-slate-600">
            Gestational Age
          </h3>
          <p className="mb-2 text-sm text-slate-500">{gestationalWeeks} weeks</p>
          <input
            className="semantic-slider w-full"
            type="range"
            min={20}
            max={42}
            value={gestationalWeeks}
            onChange={(event) => onChangeGestationalWeeks(Number(event.target.value))}
          />
          <div className="mt-2 grid grid-cols-5 text-xs text-slate-500">
            {gestationalAgeMarks.map((mark, index) => (
              <span
                key={mark}
                className={[
                  index === 0
                    ? "text-left"
                    : index === gestationalAgeMarks.length - 1
                      ? "text-right"
                      : "text-center",
                  index <= 1
                    ? "text-amber-600"
                    : index >= gestationalAgeMarks.length - 2
                      ? "text-emerald-600"
                      : "text-slate-500"
                ].join(" ")}
              >
                {mark}w
              </span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
