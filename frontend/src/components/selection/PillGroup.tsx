import { useState } from "react";
import { Pill } from "@/components/selection/Pill";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SparkIcon } from "@/components/ui/icons";
import type { ClinicalOption } from "@/lib/clinical-options";

type PillGroupProps = {
  title: string;
  description?: string;
  optionsLabel?: string;
  optionsDescription?: string;
  options: ClinicalOption[];
  selected: string[];
  onToggle: (value: string) => void;
  attributeOptionsByOptionId?: Record<string, { id: string; label: string }[]>;
  selectedAttributesByOptionId?: Record<string, string[]>;
  onToggleAttribute?: (optionId: string, attributeId: string) => void;
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
  attributeOptionsByOptionId,
  selectedAttributesByOptionId,
  onToggleAttribute,
  children
}: PillGroupProps) {
  const [activeOptionForAttributes, setActiveOptionForAttributes] = useState<
    string | null
  >(null);

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
            <div key={option.id} className="relative">
              <Pill
                label={option.label}
                isActive={selected.includes(option.id)}
                onToggle={() => {
                  const hasAttributes = Boolean(
                    attributeOptionsByOptionId?.[option.id]?.length
                  );
                  const isCurrentlySelected = selected.includes(option.id);

                  if (hasAttributes && isCurrentlySelected) {
                    setActiveOptionForAttributes((current) =>
                      current === option.id ? null : option.id
                    );
                    return;
                  }

                  onToggle(option.id);
                  if (hasAttributes) {
                    setActiveOptionForAttributes(option.id);
                  } else {
                    setActiveOptionForAttributes((current) =>
                      current === option.id ? null : current
                    );
                  }
                }}
              />
              {activeOptionForAttributes === option.id &&
              selected.includes(option.id) &&
              attributeOptionsByOptionId?.[option.id]?.length ? (
                <div className="absolute left-0 top-[calc(100%+6px)] z-20 min-w-[13rem] rounded-md border border-slate-200 bg-white p-2 shadow-md">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <div className="text-xs font-medium text-slate-700">
                      Attributes
                    </div>
                    <button
                      type="button"
                      className="rounded px-1 text-sm leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      onClick={() => setActiveOptionForAttributes(null)}
                      aria-label="Close attributes"
                      title="Close"
                    >
                      ×
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {attributeOptionsByOptionId[option.id].map((attribute) => (
                      <Pill
                        key={`${option.id}-${attribute.id}`}
                        label={attribute.label}
                        tone="orange"
                        size="compact"
                        isActive={Boolean(
                          selectedAttributesByOptionId?.[option.id]?.includes(
                            attribute.id
                          )
                        )}
                        onToggle={() =>
                          onToggleAttribute?.(option.id, attribute.id)
                        }
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    className="mt-2 text-xs font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
                    onClick={() => {
                      onToggle(option.id);
                      setActiveOptionForAttributes(null);
                    }}
                  >
                    Remove diagnosis
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}
