type PillProps = {
  label: string;
  isActive: boolean;
  onToggle: () => void;
};

export function Pill({ label, isActive, onToggle }: PillProps) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-10 items-center justify-center rounded-full border px-4 py-2 text-sm font-medium leading-tight transition ${
        isActive
          ? "border-blue-700 bg-blue-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
          : "border-slate-200 bg-slate-50/80 text-slate-900 hover:border-blue-300 hover:bg-blue-50"
      }`}
      onClick={onToggle}
      aria-pressed={isActive}
    >
      {label}
    </button>
  );
}
