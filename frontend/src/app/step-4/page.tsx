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
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex min-h-[11rem] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-4 text-center">
              <div>
                <p className="text-sm font-medium text-slate-700">
                  Verification output will appear here.
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Example output:
                  <span className="ml-1 font-mono">
                    status=valid, violated_rules=[]
                  </span>
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
