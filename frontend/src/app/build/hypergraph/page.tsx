import { PublishPanel } from "@/components/build/PublishPanel";
import { RuntimePanel } from "@/components/build/RuntimePanel";

export default function BuildHypergraphPage() {
  return (
    <div className="grid w-full gap-6">
      <PublishPanel />

      <RuntimePanel />
    </div>
  );
}
