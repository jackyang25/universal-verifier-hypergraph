import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const GITHUB_KERNEL_URL = "https://github.com/jackyang25/cohere";
const GITHUB_DASHBOARD_URL = "https://github.com/jackyang25/verified-protocol-hypergraph";
const OVERLEAF_URL = "https://www.overleaf.com/read/cpkdxmxtkpfs#ef562e";

const invariants = [
  {
    name: "No contradiction",
    formal: "Obligated(a) and Rejected(a) never co-derive",
    description:
      "The same fact set cannot produce both an obligation and a rejection for the same action. Similarly, Allowed(a) and Rejected(a) are mutually exclusive.",
  },
  {
    name: "No incompatible obligations",
    formal: "Two incompatible actions are never both Obligated",
    description:
      "If two actions are declared incompatible in the action algebra, the derivation engine will never obligate both simultaneously.",
  },
  {
    name: "Ought implies can",
    formal: "Obligated(a) never triggers an infeasibility entry",
    description:
      "An action cannot be obligated if the patient's fact set makes it infeasible. This prevents the system from demanding clinically impossible interventions.",
  },
];

const pipelineSteps = [
  {
    step: "1",
    label: "Inputs",
    description:
      "Clinician selects diagnoses, comorbidities, context factors, and a proposed action. These are raw clinical selections, not yet in canonical form.",
  },
  {
    step: "2",
    label: "Normalization",
    description:
      "Selections are encoded into canonical ontology tokens (Dx.*, DxAttr.*, Ctx.*) via the backend's normalization layer. This produces a deterministic fact set.",
  },
  {
    step: "3",
    label: "Retrieval",
    description:
      "The fact set is matched against verified hyperedge rules. Rules whose premise sets are subsets of the fact set fire, and specificity-based shadowing produces the final verdict set.",
  },
  {
    step: "4",
    label: "Verification",
    description:
      "The proposed action is checked against the derived verdicts (Obligated / Allowed / Rejected). A deterministic certificate is emitted summarizing the decision and its supporting evidence.",
  },
];

const whyLeanReasons = [
  {
    title: "Small kernel, high stakes",
    description:
      "The kernel is a few hundred lines of Lean covering derivation, specificity shadowing, and three safety invariants. A ruleset contradiction could directly affect a clinical decision, and the untested combinations (rare patients with unusual condition mixes) are exactly where that matters. Most systems are too large to verify or too low-stakes to justify it. This kernel is neither.",
  },
  {
    title: "Structural fit",
    description:
      "Derive takes a ruleset and a fact set and returns a verdict set -- a pure function over finite sets with no IO, concurrency, or side effects. Clinical decision support is not a traditional verification target, but the kernel has the same structural properties as compilers and cryptographic libraries that make verification tractable.",
  },
  {
    title: "Refactor safety",
    description:
      "If someone changes the specificity ordering, adds a fourth invariant, or restructures the exclusion groups, the proofs either compile or they don't. A broken proof points to exactly which guarantee was violated. In a test-based system, a missed edge case ships silently. In Lean, it is a compile error.",
  },
  {
    title: "Accumulating verified knowledge",
    description:
      "Every rule added to the system either passes all three invariants or exposes a conflict that must be resolved before promotion. Each successful verification permanently covers that rule's interaction with every other rule across all possible patient fact sets. The verified ruleset grows over time, and so does the coverage of the proofs.",
  },
];

export default function AboutPage() {
  return (
    <div className="grid w-full gap-8">
      {/* Hero */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-xl">How it works</CardTitle>
            <Badge className="border border-indigo-200 bg-indigo-50 text-indigo-700">
              Developer reference
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-2">
          <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
            This system encodes clinical protocols as hyperedge rules, verifies
            them against safety invariants using a{" "}
            <a
              href="https://lean-lang.org/"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-indigo-700 underline-offset-2 hover:underline"
            >
              Lean 4
            </a>{" "}
            kernel called{" "}
            <a
              href={GITHUB_KERNEL_URL}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-indigo-700 underline-offset-2 hover:underline"
            >
              Cohere
            </a>
            , and serves verified rulesets through an interactive dashboard.
            Only rulesets that pass all invariants are promoted to the runtime
            retrieval layer.
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            <a
              href={GITHUB_DASHBOARD_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Dashboard repo
            </a>
            <a
              href={GITHUB_KERNEL_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Kernel repo
            </a>
            <a
              href={OVERLEAF_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Verification spec (Overleaf)
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Why Lean */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Why Lean 4</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
            A test suite can check invariants against generated fact sets, but
            nothing verifies the checker itself. Lean&apos;s type system does --
            if the proof compiles, the property holds over every valid fact set,
            not just the ones you tested.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {whyLeanReasons.map((reason) => (
              <div
                key={reason.title}
                className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"
              >
                <div className="text-sm font-semibold text-slate-900">
                  {reason.title}
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                  {reason.description}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Architecture */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prototype Architecture</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
            Two repositories, three layers. The frontend and backend live in{" "}
            <span className="font-mono text-xs">verified-protocol-hypergraph</span>;
            the Lean kernel lives in{" "}
            <span className="font-mono text-xs">cohere</span>, cloned and compiled
            inside the Docker build.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-4">Layer</th>
                  <th className="pb-2 pr-4">Technology</th>
                  <th className="pb-2">Role</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                <tr className="border-b border-slate-100">
                  <td className="py-2.5 pr-4 font-medium">Frontend</td>
                  <td className="py-2.5 pr-4">
                    <span className="font-mono text-xs">Next.js 16, React 19, Tailwind CSS 4</span>
                  </td>
                  <td className="py-2.5">4-step clinical workflow + Build console</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-2.5 pr-4 font-medium">Backend</td>
                  <td className="py-2.5 pr-4">
                    <span className="font-mono text-xs">Python 3.11, FastAPI, Pydantic</span>
                  </td>
                  <td className="py-2.5">Ontology normalization, hypergraph retrieval, kernel store</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 font-medium">Kernel</td>
                  <td className="py-2.5 pr-4">
                    <span className="font-mono text-xs">Lean 4 (v4.15.0)</span>
                  </td>
                  <td className="py-2.5">Derivation, specificity shadowing, invariant proofs</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs leading-relaxed text-slate-500">
            The frontend talks to the backend over REST. At publish time, the
            backend shells out to the{" "}
            <span className="font-mono">cohere-verify</span> binary for formal
            verification. Nonzero exit code blocks promotion to runtime.
          </p>
        </CardContent>
      </Card>

      {/* Runtime pipeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Runtime pipeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-2">
          <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
            The dashboard exposes a 4-step clinical simulation pipeline. Each
            step feeds its output into the next.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {pipelineSteps.map((s) => (
              <div
                key={s.step}
                className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"
              >
                <div className="flex items-center gap-2">
                  <span className="inline-flex size-6 items-center justify-center rounded-lg bg-slate-900 text-xs font-semibold text-white">
                    {s.step}
                  </span>
                  <span className="text-sm font-semibold text-slate-900">
                    {s.label}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  {s.description}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Kernel invariants */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">Kernel invariants</CardTitle>
            <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700">
              Lean-verified
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
            The Lean kernel enforces three safety properties. These are
            verified at build time by{" "}
            <span className="font-mono text-xs">cohere-verify</span> and are
            guaranteed by the structure of the derivation engine.
          </p>
          <div className="space-y-3">
            {invariants.map((inv, i) => (
              <div
                key={inv.name}
                className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"
              >
                <div className="flex items-start gap-3">
                  <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-lg bg-emerald-700 text-xs font-semibold text-white">
                    {i + 1}
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {inv.name}
                    </div>
                    <p className="mt-0.5 font-mono text-xs text-slate-500">
                      {inv.formal}
                    </p>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                      {inv.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Build workflow */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Build workflow</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-2">
          <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
            Rules and constraints are authored in a Draft workspace. Publishing
            takes a frozen JSON snapshot, runs the Lean verifier, and promotes
            to Runtime only on success.
          </p>
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-700">
            <div>
              <span className="font-semibold">Draft vs Runtime</span> -- Draft
              constraints persist across publishes; draft rules clear after
              promotion. This lets teams iterate on rules while keeping
              constraint invariants stable.
            </div>
            <div>
              <span className="font-semibold">Token registry</span> -- Single
              source of truth for all valid tokens (
              <span className="font-mono text-xs">Action.*, Dx.*, DxAttr.*, Ctx.*</span>
              ). Derived from the ontology normalizer, fetched at{" "}
              <span className="font-mono text-xs">/api/kernel/registry</span>.
            </div>
            <div>
              <span className="font-semibold">Hyperedge</span> -- A rule of the
              form{" "}
              <span className="font-mono text-xs">
                {"{"}premises{"}"} → Verdict(Action)
              </span>
              . Premises are ontology tokens; verdicts are{" "}
              <span className="font-mono text-xs">
                Obligated | Allowed | Disallowed | Rejected
              </span>
              .
            </div>
            <div>
              <span className="font-semibold">Constraints</span> --
              Incompatibility pairs (actions that cannot both be obligated) and
              infeasibility entries (conditions that make an action infeasible).
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Limits */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scope and limits</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
            The kernel proves rule consistency, not clinical truth. It
            guarantees that a ruleset satisfies its safety invariants across
            all possible fact sets. Everything outside of that is explicitly
            out of scope.
          </p>
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-700">
            <div>
              <span className="font-semibold">Clinical correctness</span> --
              The kernel cannot tell you whether a rule is medically sound.
              It can tell you that the ruleset is internally consistent.
              Rule authoring requires domain expertise.
            </div>
            <div>
              <span className="font-semibold">Ontology mapping</span> --
              If a patient&apos;s condition is assigned the wrong token
              upstream, the kernel has no way to detect that. It operates
              on the fact set it receives.
            </div>
            <div>
              <span className="font-semibold">Probabilistic reasoning</span> --
              The system does not perform diagnosis, risk prediction, or
              calibration. It evaluates rules deterministically against a
              given fact set.
            </div>
          </div>
          <p className="max-w-3xl text-sm font-medium text-slate-700">
            This is a research prototype and must not be used for patient care.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
