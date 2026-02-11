import { Badge } from "@/components/ui/badge";
import { Lora } from "next/font/google";

type HeroHeaderProps = {
  title: string;
  subtitle: string;
  eyebrow: string;
};

const headingFont = Lora({
  subsets: ["latin"],
  weight: ["600", "700"]
});

export function HeroHeader({ title, subtitle, eyebrow }: HeroHeaderProps) {
  return (
    <header className="rounded-xl border-b border-slate-200 pb-4">
      <Badge className="w-fit">{eyebrow}</Badge>
      <h1
        className={`${headingFont.className} mt-3 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl`}
      >
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-2 text-sm text-slate-600 md:text-base">{subtitle}</p>
      ) : null}
    </header>
  );
}
