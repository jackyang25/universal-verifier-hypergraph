import { HeroHeader } from "@/components/selection/HeroHeader";
import { StepFlowBar } from "@/components/selection/StepFlowBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Step4Page() {
  return (
    <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 md:px-6 md:py-10">
      <HeroHeader
        eyebrow="Clinical Selection Interface"
        title="Maternal Health Decision Support Verification"
        subtitle=""
      />
      <StepFlowBar currentStep={4} />

      <Card>
        <CardHeader>
          <CardTitle>Step 4: Verification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-600">
            Verification stage placeholder for evaluating retrieved edges against
            constraints and producing pass/fail outcomes.
          </p>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            Example output:{" "}
            <span className="font-mono">status=valid, violated_rules=[]</span>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
