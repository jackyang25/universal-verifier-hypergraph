import { Pill } from "@/components/selection/Pill";
import type { ClinicalOption } from "@/components/build/useTokenRegistry";

type ProposedActionSectionProps = {
  actions: ClinicalOption[];
  selectedAction: string | null;
  onSelectAction: (value: string | null) => void;
};

export function ProposedActionSection({
  actions,
  selectedAction,
  onSelectAction
}: ProposedActionSectionProps) {
  return (
    <div className="border-t border-slate-200 pt-4">
      <h3 className="mb-1 text-sm font-semibold text-slate-700">
        Proposed Action
      </h3>
      <div className="flex flex-wrap gap-2.5">
        {actions.map((action) => (
          <Pill
            key={action.id}
            label={action.label}
            isActive={selectedAction === action.id}
            onToggle={() =>
              onSelectAction(selectedAction === action.id ? null : action.id)
            }
          />
        ))}
      </div>
    </div>
  );
}
