export function Spinner({ label = 'در حال انجام...' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-6">
      <div
        className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900"
        aria-hidden
      />
      <span className="text-sm text-slate-700">{label}</span>
    </div>
  );
}

