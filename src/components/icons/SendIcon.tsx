/**
 * Inline send icon used by the chat composers in /direct/[id] and
 * /groups/[id]. Lucide-style paper-plane stroke. The shape itself is
 * direction-agnostic enough to read as 'send' in both LTR and RTL — we
 * never apply scaleX(-1) since that would mis-render the strokes.
 *
 * Sized via Tailwind class on the parent (`h-5 w-5` in current call sites).
 */
export function SendIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M22 2 11 13" />
      <path d="m22 2-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}
