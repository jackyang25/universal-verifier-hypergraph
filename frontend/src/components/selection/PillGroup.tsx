import { Pill } from "@/components/selection/Pill";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SparkIcon } from "@/components/ui/icons";

type PillGroupProps = {
  title: string;
  description?: string;
  optionsLabel?: string;
  optionsDescription?: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  children?: React.ReactNode;
};

export function PillGroup({
  title,
  description,
  optionsLabel,
  optionsDescription,
  options,
  selected,
  onToggle,
  children
}: PillGroupProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="inline-flex items-center gap-2">
          <SparkIcon className="size-4 text-blue-600" />
          <span>{title}</span>
        </CardTitle>
        {description ? (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-5 pt-0">
        {optionsLabel ? (
          <div>
            <h3 className="text-sm font-semibold text-slate-700">{optionsLabel}</h3>
            {optionsDescription ? (
              <p className="mt-1 text-sm text-slate-500">{optionsDescription}</p>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2.5">
          {options.map((option) => (
            <Pill
              key={option}
              label={option}
              isActive={selected.includes(option)}
              onToggle={() => onToggle(option)}
            />
          ))}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}
