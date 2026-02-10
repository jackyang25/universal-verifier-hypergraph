import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SelectionSummaryProps = {
  totalSelected: number;
  gestationalWeeks: number;
  selectedAction: string | null;
};

export function SelectionSummary({
  totalSelected,
  gestationalWeeks,
  selectedAction
}: SelectionSummaryProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Current Selection</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2 pt-0">
        <Badge>{totalSelected} pill selections</Badge>
        <Badge className="border-slate-200 bg-slate-100 text-slate-700">
          {gestationalWeeks} weeks selected
        </Badge>
        <Badge className="border-slate-200 bg-white text-slate-700">
          {selectedAction ?? "No action selected"}
        </Badge>
      </CardContent>
    </Card>
  );
}
