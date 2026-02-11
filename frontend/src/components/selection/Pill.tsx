type PillProps = {
  label: string;
  isActive: boolean;
  onToggle: () => void;
  tone?: "blue" | "orange";
  size?: "default" | "compact";
};

export function Pill({
  label,
  isActive,
  onToggle,
  tone = "blue",
  size = "default"
}: PillProps) {
  const activeClasses =
    tone === "orange"
      ? "border-amber-700 bg-amber-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
      : "border-blue-700 bg-blue-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]";
  const inactiveClasses =
    tone === "orange"
      ? "border-amber-200 bg-amber-50/80 text-amber-900 hover:border-amber-300 hover:bg-amber-100"
      : "border-slate-200 bg-slate-50/80 text-slate-900 hover:border-blue-300 hover:bg-blue-50";
  const sizeClasses =
    size === "compact"
      ? "min-h-8 px-3 py-1 text-xs font-semibold"
      : "min-h-10 px-4 py-2 text-sm font-medium";

  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-full border leading-tight transition ${sizeClasses} ${
        isActive ? activeClasses : inactiveClasses
      }`}
      onClick={onToggle}
      aria-pressed={isActive}
    >
      {label}
    </button>
  );
}
