import { HeroHeader } from "@/components/selection/HeroHeader";
import { StepFlowBar } from "@/components/selection/StepFlowBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Step3Page() {
  return (
    <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 md:px-6 md:py-10">
      <HeroHeader
        eyebrow="Clinical Selection Interface"
        title="Maternal Health Decision Support Verification"
        subtitle=""
      />
      <StepFlowBar currentStep={3} />

      <Card>
        <CardHeader>
          <CardTitle>Step 3: Retrieval</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-600">
            Retrieval stage placeholder for pulling relevant hyperedges and
            policy constraints using normalized fact tokens.
          </p>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            Example retrieval query:{" "}
            <span className="font-mono">
              facts=[Dx.SeverePreeclampsia, Ctx.GA_&gt;=34w]
            </span>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
