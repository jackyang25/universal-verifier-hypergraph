import { HeroHeader } from "@/components/selection/HeroHeader";
import { StepFlowBar } from "@/components/selection/StepFlowBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Step2Page() {
  return (
    <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 md:px-6 md:py-10">
      <HeroHeader
        eyebrow="Clinical Selection Interface"
        title="Maternal Health Decision Support Verification"
        subtitle=""
      />
      <StepFlowBar currentStep={2} />

      <Card>
        <CardHeader>
          <CardTitle>Step 2: Ontology Normalization Preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-600">
            This page is reserved for normalized fact encoding (e.g., Dx.* and
            Ctx.* tokens) before verifier execution.
          </p>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            Example: <span className="font-mono">Dx.SeverePreeclampsia</span>,{" "}
            <span className="font-mono">Ctx.GA_&gt;=34w</span>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
