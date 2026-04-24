# Handoff: Toot Family Launch — UI Polish (Round 1)

> **Implementation branch:** `feature/claude-video-lab`
> **Do NOT use:** `feature/group-create-flow`
> (Yes, the branch is historically named "video-lab" — it is now our testing/polish branch.)

---

## 0. Important: Design is guidance, not source of truth

The HTML files in this bundle are **design references**, not code to copy. They describe the *intended* look, rhythm, spacing, color, and behavior — nothing more.

**Before writing any code, Claude Code must:**

1. Read the actual repo files listed in §4 ("Target files") and confirm they exist at those paths.
2. Audit the current implementation: what components already render, what props they take, what Tailwind classes they use, what state they manage.
3. Compare the current reality to the designed state, and only then plan the smallest non-breaking edits to reach the designed state.
4. If a file, route, or component listed here does not exist as described, **stop and report** — do not invent new routes or rename existing ones.

The repo's conventions win over the design bundle. If the design shows `rounded-2xl` but the repo uses `rounded-xl` everywhere, keep `rounded-xl`. If the design shows an icon library the repo doesn't have, use an inline stroke SVG instead. Small deviations are fine; IA changes are not.

---

## 1. Overview

Toot is a Persian-first (RTL, `lang="fa"`) mobile super-app on Next.js 14 + Tailwind. This handoff covers a **focused UI polish pass** for the family-launch milestone — typography, tokens, bottom nav, and the direct-messaging surfaces. No routes are added, renamed, or restructured.

The app has four primary tabs:
- `/home` — استوری (social feed)
- `/direct` — گفتگو (messaging list) + `/direct/[id]` (thread)
- `/vitrin` — ویترین (utility dashboard / marketplace)
- `/spaces` — فضاها (communities)

**Round 1 is explicitly scoped to messaging + global shell.** `/home`, `/vitrin`, `/spaces` designs are included as **visual references for later rounds** — do not implement them in Round 1.

---

## 2. Fidelity

**High-fidelity (hifi).** Final colors, typography, spacing, and interactions are decided. Reproduce the look pixel-accurately using the existing Tailwind + CSS variable stack — do not introduce new libraries, new icon packs, or a new state manager. Use existing `rounded-*`, `slate-*`, `shadow-*` vocabulary wherever possible; reach for CSS variables only when the token has no native Tailwind equivalent.

---

## 3. Approved visual direction

One-sentence brief: **Quiet, confident, Persian-first. Paper-white surfaces, ink-dark text, one warm accent. No gradients, no glassmorphism, no decorative illustration.**

Full token set, type scale, spacing scale, radius scale, and component rules live in `TOOT_DESIGN_SPEC.md` (bundled). That spec is the **canonical reference** for this handoff — the items below are a summary.

**Core tokens (drop into `src/app/globals.css` once, additive, non-breaking):**

| Role | Value |
|---|---|
| `--bg` | `#F7F7F5` |
| `--surface` | `#FFFFFF` |
| `--surface-2` | `#F1F0EC` |
| `--ink` | `#11151A` |
| `--ink-2` | `#3A4149` |
| `--ink-3` | `#6B7480` |
| `--ink-4` | `#A7ADB5` |
| `--line` | `#E6E5E0` |
| `--accent` | `#B4532A` (warm Persian-tea) |
| `--accent-soft` | `#F5E4DA` |
| `--accent-soft-ink` | `#6B2E14` |
| `--success` | `#2F7A4E` |
| `--danger` | `#B3261E` |

**Font:** Vazirmatn (weights 400/500/600/700) via `next/font/google`. Only font change. See `TOOT_DESIGN_SPEC.md` §3.1 for snippet.

**Type scale (mobile, base 16px):** display 24/1.25/700 · title 18/1.3/700 · body-lg 16/1.55/500 · body 15/1.6/400 · label 13/1.35/600 · caption 12/1.3/500 · micro 11/1.2/600.

**Radii:** `rounded-xl` (12) controls · `rounded-2xl` (16) cards/bubbles · `rounded-full` avatars/pills. Only these three.

**Elevation:** `shadow-sm` cards · `shadow-md` FAB only. Never `shadow-lg+`.

**RTL reminders:** use logical props (`ps-*`, `pe-*`, `ms-*`, `me-*`); mirror directional icons with `rtl:rotate-180`; Persian numerals via `toLocaleString('fa-IR')` at render time.

---

## 4. Target files (Round 1 only)

Claude Code must verify each path before editing. These are derived from `TOOT_DESIGN_SPEC.md`; adjust to match the actual repo layout.

| # | Route / concern | Likely file(s) |
|---|---|---|
| 1 | Global shell — tokens + font | `src/app/layout.tsx`, `src/app/globals.css` |
| 2 | Navbar — brand + avatar only | `src/components/Navbar.tsx` |
| 3 | Bottom nav polish | `src/components/AppBottomNav.tsx` |
| 4 | Direct list row rhythm | the file rendering `/direct` (likely `src/app/direct/page.tsx` + a `ConversationRow` component) |
| 5 | Direct thread: bubbles, header, composer | the file rendering `/direct/[id]` (likely `src/app/direct/[id]/page.tsx`) + any `MessageBubble`, `ChatHeader`, `ChatComposer` components |
| 6 | Shared format helpers | `src/lib/format.ts` (new file — see `TOOT_DESIGN_SPEC.md` §8) |

Also referenced but **not in Round 1 scope** (visual refs for later rounds):
- `/home` feed — see `screenshots/01-home.png`, `previews-v2.html`
- `/vitrin` — see `screenshots/04-vitrin.png`, `previews-v2.html`
- `/spaces` — see `screenshots/05-spaces.png`, `previews-v2.html`

---

## 5. Exact implementation scope — Round 1

Do these in the order given. Each item should be a small, reviewable commit. All items are **additive**: if you find yourself deleting props, renaming exports, or moving files, stop.

### 5.1 Global tokens + typography *(safe, foundational)*

- [ ] Add Vazirmatn via `next/font/google` in `src/app/layout.tsx` with `variable: '--font-vazir'`, weights 400/500/600/700, subsets `['arabic','latin']`.
- [ ] Apply `className={vazir.variable}` on `<html>`.
- [ ] Paste the `:root` token block from `TOOT_DESIGN_SPEC.md` §2 into `src/app/globals.css` **after** `@tailwind utilities;`.
- [ ] Set `body { background: var(--bg); color: var(--ink); font-family: var(--font-vazir), ui-sans-serif, system-ui, sans-serif; }`.
- [ ] Do **not** mass-replace `bg-slate-*` / `text-slate-*` elsewhere. Leave existing usage as-is — new work opts in via `bg-[var(--surface)]` etc.

**Safety check before shipping:** no visible regression on routes you don't touch. If a screen looks different after adding tokens, revert and flag — tokens should be invisible except via explicit opt-in.

### 5.2 Bottom nav polish (`AppBottomNav`)

- [ ] Add a 20px stroke icon (1.5px stroke, `currentColor`) above each of the four labels: استوری، گفتگو، ویترین، فضاها. Use inline SVG — no new icon library.
- [ ] Replace full-pill active state (`bg-slate-900 text-white`) with: **bold text + 4px accent dot** under the active label. Inactive tabs: `text-[var(--ink-3)]`.
- [ ] Keep existing `max-w-md`, safe-area padding, and `shadow-nav`.
- [ ] Add an **unread dot** on the گفتگو tab when there are unread DMs. Source the count from whatever hook/prop already exists; if no such source, add an 8px dot with a TODO prop `hasUnread?: boolean` and leave it wired at `false` — do not build a new state system.
- [ ] Reference: `screenshots/02-direct.png`, `screenshots/03-direct-id.png` (bottom nav visible in all shots).

### 5.3 `/direct` list polish

- [ ] Row anatomy: 48px circle avatar · name (label 13/600) + last-message preview (caption 12/500, `--ink-3`, `line-clamp-1`) · time (caption, RTL-end) + unread badge below.
- [ ] Unread badge: `rounded-full`, `bg-[var(--accent)]`, `text-[var(--accent-ink)]`, min 18×18, `text-micro`, Persian numerals.
- [ ] When unread: timestamp turns `text-[var(--accent)] font-bold`.
- [ ] 1px `border-[var(--line)]` divider between rows, full-bleed (no gutter).
- [ ] Previews must support the mini-leaders: `✓✓` seen (use `--accent` when read), `در حال تایپ…` in `var(--success)`, a 14px mic icon for voice messages, a 14px image icon for photo messages, a mute icon on muted rows. Keep whatever data the backend already provides — do not add new fields.
- [ ] Sticky search bar at top of list: `h-11`, `rounded-xl`, `bg-[var(--surface-2)]`, placeholder "جستجو در گفتگوها".
- [ ] FAB "گفتگوی جدید": 52×52, `rounded-full`, `bg-[var(--accent)]`, `shadow-md`, icon 22px, positioned `bottom: 88px; inset-inline-start: 18px;` (RTL-aware).
- [ ] Reference: `screenshots/02-direct.png`.

### 5.4 `/direct/[id]` thread polish

- [ ] **Replace the global Navbar** on this route with a chat-specific header: back arrow (RTL → use `rotate-180` on a left chevron) · 38px avatar · name (label) + presence (caption, `--success`) · camera/call/more icons (18px stroke).
- [ ] Hide the global `Navbar` for `pathname.startsWith('/direct/')` via `AppShell` check — or render the chat header inside the route and conditionally hide the global one. Pick whichever matches the repo's existing pattern.
- [ ] Bubbles (see `TOOT_DESIGN_SPEC.md` §5.3):
  - Incoming: `bg-[var(--surface)]` + 1px `border-[var(--line)]`, `rounded-2xl`, `rounded-tr-md` to point at sender, text `--ink`.
  - Outgoing: `bg-[var(--accent-soft)] text-[var(--accent-soft-ink)]`, no border, `rounded-2xl`, `rounded-tl-md`.
  - Max width 78%, padding `px-3 py-2`, text `body-lg`.
  - Timestamp **inside** the bubble, bottom-end, 10.5px, `tabular-nums`, float inline-end with a small `margin-inline-start`.
  - Delivery ticks (outgoing only): SVG, `✓` sent / `✓✓` delivered / `✓✓` in `--accent` when read. No unicode.
- [ ] Voice message bubble: 30px circle play button (accent-filled on outgoing receiver, accent-filled on sender too — see screenshot) · 15-bar waveform (played bars solid, unplayed dimmed) · duration text in `tabular-nums`.
- [ ] Day separator pill: centered, `bg-[var(--surface-2)]`, `text-[var(--ink-3)]`, `text-caption`, `rounded-full`, `px-3 py-1`. Labels: "امروز" / "دیروز" / weekday name / date.
- [ ] Composer: sticky bottom, `bg-[var(--surface)]`, top `border-[var(--line)]`. Left (RTL-start): emoji icon button. Middle: growing textarea inside `bg-[var(--surface-2)] rounded-[20px]` pill, min 40px, max 6 lines, placeholder "پیام بنویس…". Right: attach icon + send/mic button (40×40, `rounded-full`, `bg-[var(--accent)]`, icon `rotate-180` in RTL for send glyph; mic icon when input empty). Send disabled until input is non-empty.
- [ ] Auto-scroll to bottom on new message; preserve scroll when loading older history.
- [ ] Reference: `screenshots/03-direct-id.png`.

---

## 6. What NOT to change

- **Do not rename routes** or change IA. `/home`, `/direct`, `/direct/[id]`, `/vitrin`, `/spaces` stay. Any "groups" or "channels" routes mentioned in `TOOT_DESIGN_SPEC.md` are future-scope and out of Round 1.
- **Do not rename exported components.** Keep `Navbar`, `AppBottomNav`, `AppShell`, `Button`, `TextInput` names.
- **Do not add new dependencies** — no icon packs, no new state managers, no motion libraries, no UI kits. Inline SVG is always acceptable.
- **Do not touch** `<html lang="fa" dir="rtl">` — RTL is already set.
- **Do not dark-mode this round.** The token block includes a `prefers-color-scheme: dark` section; leave it as defined but do not polish or test dark surfaces.
- **Do not implement `/home`, `/vitrin`, `/spaces`** visual changes. They are refs only for Round 1. Bottom-nav polish will affect them cosmetically (new active state, icons) — that is expected and fine.
- **Do not rework `Button` variants** yet. If existing `Button` is blocking a specific Round 1 item, add the minimum new variant needed and document it in the PR; a full variant system can come later.
- **Do not build custom pull-to-refresh, long-press menus, haptics, or animations.** Everything in Round 1 is static styling + existing interaction behavior.
- **Do not widen `max-w-md`.** The app is mobile-first.

---

## 7. Priority order (strict)

Ship in this order. Each is its own PR/commit where possible. Do not start N+1 until N is merged or self-verified.

1. **5.1** Global tokens + Vazirmatn font
2. **5.2** Bottom nav polish
3. **5.3** `/direct` list polish
4. **5.4** `/direct/[id]` thread polish

If time runs out, ship what's done and defer the rest. Partial delivery of this list is fine; partial delivery of a single item (e.g. bubbles styled but header half-done) is not.

---

## 8. Acceptance criteria

### Visual
- All four Round 1 surfaces visually match `screenshots/02-direct.png` and `screenshots/03-direct-id.png`, and feel consistent with `previews-v2.html` (chat & list columns).
- Bottom nav on every route (including unchanged `/home`, `/vitrin`, `/spaces`) shows icons, correct active indicator, no full-pill fill.
- Vazirmatn is loading and applied site-wide; no `system-ui` fallback visible on any text.
- Persian numerals everywhere in the UI (timestamps, badges, counts) — no Latin digits in user-facing text except user-typed content.

### Structural
- No new routes created. `git diff --stat` shows no new files under `src/app/**/page.tsx` or `src/app/**/layout.tsx` except the optional `src/lib/format.ts`.
- No renamed exports. `git log -p -- src/components/` shows modifications, not deletions + creations.
- No new runtime dependencies added to `package.json`. `next/font` is already a Next.js built-in.
- `<html lang="fa" dir="rtl">` unchanged in `layout.tsx`.

### Behavioral
- `/direct` list renders unchanged data with the new styling — no fields added or removed from the row component's props.
- `/direct/[id]` thread sends, receives, and auto-scrolls exactly as before. Composer disabled state for empty input works.
- Global `Navbar` hides on `/direct/[id]` and reappears on every other route.
- Bottom-nav unread dot on گفتگو reflects real unread count if a hook exists; otherwise wired to `false` with a TODO.

### Non-regression
- Build succeeds (`next build`) with no new TypeScript errors.
- Lighthouse mobile scores do not drop relative to the pre-Round-1 baseline.
- No console errors or hydration warnings on any of the four tabs in local dev.
- Routes not touched in Round 1 still render their previous layouts — only the bottom nav and global typography should look different on them.

---

## 9. Files in this bundle

| File | Purpose |
|---|---|
| `README.md` | This document — handoff brief, scope, acceptance. |
| `TOOT_DESIGN_SPEC.md` | Canonical design spec: tokens, type scale, component rules, per-route checklist. **Primary reference for all values and rules.** |
| `previews-v2.html` | Latest 4-tab product-aligned mockup (feed tabs, voice bubble, BamaKhabar tiles, neighborhood hero). Open in any browser. |
| `previews.html` | Earlier previews doc (current-vs-proposed framing). Kept for context. |
| `screenshots/01-home.png` | `/home` visual reference (later round). |
| `screenshots/02-direct.png` | `/direct` list visual reference (Round 1). |
| `screenshots/03-direct-id.png` | `/direct/[id]` thread visual reference (Round 1). |
| `screenshots/04-vitrin.png` | `/vitrin` visual reference (later round). |
| `screenshots/05-spaces.png` | `/spaces` visual reference (later round). |

---

## 10. Open questions to resolve before coding

If any of these are unknown, ask **before** starting implementation — do not guess:

1. Does the repo already have a shared `ConversationRow` / `MessageBubble` / `ChatHeader` component, or is everything inline in `page.tsx`? The answer changes whether §5.3/§5.4 is one edit or several.
2. How does the repo detect unread DMs today (hook? prop drilled from layout? server component data)? Round 1 wires to whatever already exists; if nothing exists, a `hasUnread` prop wired to `false` is acceptable.
3. Does `AppShell` already do pathname-based chrome hiding, or will this be the first such case? If first, match the simplest possible pattern.
4. Is `next/font` already in use for any font? If yes, use the same pattern; if no, add Vazirmatn as the first `next/font` import.

— end of handoff —
