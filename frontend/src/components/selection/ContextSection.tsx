import { Pill } from "@/components/selection/Pill";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContextIcon } from "@/components/ui/icons";
import type { ClinicalOption } from "@/lib/clinical-options";

type SliderMarksProps = {
  marks: number[];
  min: number;
  max: number;
  formatMark?: (value: number) => string;
  minLabel?: string;
  maxLabel?: string;
};

function SliderMarks({
  marks,
  min,
  max,
  formatMark = (value) => String(value),
  minLabel,
  maxLabel
}: SliderMarksProps) {
  return (
    <>
      <div className="relative mt-2 h-4 text-[11px] leading-none text-slate-500">
        {marks.map((mark) => {
          const ratio = (mark - min) / (max - min);
          const leftPercent = Math.max(0, Math.min(100, ratio * 100));
          const alignmentClass =
            mark === min
              ? "translate-x-0"
              : mark === max
                ? "-translate-x-full"
                : "-translate-x-1/2";
          return (
            <span
              key={mark}
              className={`absolute whitespace-nowrap ${alignmentClass}`}
              style={{ left: `${leftPercent}%` }}
            >
              {formatMark(mark)}
            </span>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-slate-400">
        <span>{minLabel ?? formatMark(min)}</span>
        <span>{maxLabel ?? formatMark(max)}</span>
      </div>
    </>
  );
}

type ContextSectionProps = {
  comorbidities: ClinicalOption[];
  selectedComorbidities: string[];
  onToggleComorbidity: (value: string) => void;
  physiologicStates: ClinicalOption[];
  selectedPhysiologicStates: string[];
  onTogglePhysiologicState: (value: string) => void;
  gestationalWeeks: number;
  gestationalAgeMarks: number[];
  onChangeGestationalWeeks: (value: number) => void;
  maternalAgeYears: number;
  maternalAgeMarks: number[];
  onChangeMaternalAgeYears: (value: number) => void;
  bmi: number;
  bmiMarks: number[];
  onChangeBmi: (value: number) => void;
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
  onChangeGestationalWeeks,
  maternalAgeYears,
  maternalAgeMarks,
  onChangeMaternalAgeYears,
  bmi,
  bmiMarks,
  onChangeBmi
}: ContextSectionProps) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="inline-flex items-center gap-2">
          <ContextIcon className="size-4 text-indigo-600" />
          <span>Additional Patient Context</span>
        </CardTitle>
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
                key={item.id}
                label={item.label}
                isActive={selectedComorbidities.includes(item.id)}
                onToggle={() => onToggleComorbidity(item.id)}
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
                key={item.id}
                label={item.label}
                isActive={selectedPhysiologicStates.includes(item.id)}
                onToggle={() => onTogglePhysiologicState(item.id)}
              />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-medium text-slate-600">
            Quantitative Profile
          </h3>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm text-slate-600">Gestational Age</span>
              <span className="text-sm text-slate-500">{gestationalWeeks} weeks</span>
            </div>
            <input
              className="semantic-slider w-full"
              type="range"
              min={20}
              max={42}
              value={gestationalWeeks}
              onChange={(event) =>
                onChangeGestationalWeeks(Number(event.target.value))
              }
            />
            <SliderMarks
              marks={gestationalAgeMarks}
              min={20}
              max={42}
              formatMark={(value) => `${value}w`}
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm text-slate-600">Maternal Age</span>
              <span className="text-sm text-slate-500">{maternalAgeYears} years</span>
            </div>
            <input
              className="semantic-slider w-full"
              type="range"
              min={15}
              max={55}
              value={maternalAgeYears}
              onChange={(event) =>
                onChangeMaternalAgeYears(Number(event.target.value))
              }
            />
            <SliderMarks
              marks={maternalAgeMarks}
              min={15}
              max={55}
              formatMark={(value) => `${value}y`}
              minLabel="15y"
              maxLabel="55y"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm text-slate-600">BMI</span>
              <span className="text-sm text-slate-500">{bmi}</span>
            </div>
            <input
              className="semantic-slider w-full"
              type="range"
              min={15}
              max={60}
              value={bmi}
              onChange={(event) => onChangeBmi(Number(event.target.value))}
            />
            <SliderMarks marks={bmiMarks} min={15} max={60} minLabel="15" maxLabel="60" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
