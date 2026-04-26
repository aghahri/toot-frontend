export function StickerIcon({ className }: { className?: string }) {
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
      <path d="M7.5 3.5h6.9a2.4 2.4 0 0 1 1.7.7l3.2 3.2a2.4 2.4 0 0 1 .7 1.7v7.4a4 4 0 0 1-4 4H7.5a4 4 0 0 1-4-4v-9a4 4 0 0 1 4-4Z" />
      <path d="M14.5 3.5V7a1.8 1.8 0 0 0 1.8 1.8H20" />
      <circle cx="9.3" cy="12.3" r="0.9" />
      <circle cx="14.7" cy="12.3" r="0.9" />
      <path d="M8.6 15.8c1 .9 2.1 1.4 3.4 1.4s2.4-.5 3.4-1.4" />
    </svg>
  );
}
