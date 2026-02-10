import { Badge } from "@/components/ui/badge";

type HeroHeaderProps = {
  title: string;
  subtitle: string;
  eyebrow: string;
};

export function HeroHeader({ title, subtitle, eyebrow }: HeroHeaderProps) {
  return (
    <header className="rounded-xl border-b border-slate-200 pb-4">
      <Badge className="w-fit">{eyebrow}</Badge>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-2 text-sm text-slate-600 md:text-base">{subtitle}</p>
      ) : null}
    </header>
  );
}
