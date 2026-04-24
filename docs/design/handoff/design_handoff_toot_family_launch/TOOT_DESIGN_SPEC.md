# Toot — RTL Persian Mobile UI Spec

> **Scope:** Family-launch polish for existing Next.js 14 + Tailwind app.
> **Rule:** No IA changes. No route renames. No component renames. Gradual, additive polish only.
> **Audience:** Cursor / Claude Code.

---

## 0. How to use this spec (for the coding agent)

1. Do **not** create new routes or rename existing ones.
2. Prefer adding Tailwind classes over writing new CSS.
3. Tokens below are **CSS variables** added once in `src/app/globals.css`; Tailwind keeps working. No `tailwind.config.ts` overhaul required.
4. When in doubt: match existing `rounded-xl` / `rounded-2xl` / `slate-*` vocabulary already in the repo. Don't introduce new rounding scales.
5. RTL is already set on `<html dir="rtl" lang="fa">` in `layout.tsx`. Do not touch that.
6. Do not introduce new libraries, new state managers, new icon packs unless asked. If an icon is missing, use a simple inline SVG stroke icon (1.5px stroke, `currentColor`).

---

## 1. Visual direction

**One sentence:** Quiet, confident, Persian-first. Paper-white surfaces, ink-dark text, one warm accent. No gradients, no glassmorphism beyond what already exists, no decorative illustration.

**Mood anchors:**
- Reads like a well-typeset Persian book app, not a Western SaaS dashboard.
- Feels closer to a native iOS/Android messaging app than to a web product.
- Surfaces are calm; color is used for *state* (unread, active, destructive), not decoration.

**Density:** Mobile-first, one-hand reachable. Max content width stays at `max-w-md` (already used in `Navbar` and `AppBottomNav`) — do not widen.

**Do:**
- Keep existing `slate-50` background, `slate-900` ink.
- Use a single warm Persian-leaning accent (see tokens) for primary actions, unread badges, active tab indicator.
- Round corners generously on cards (`rounded-2xl`), medium on controls (`rounded-xl`), full on avatars/pills.
- Use subtle 1px `slate-200` borders over shadows wherever possible.

**Don't:**
- No multi-color gradients.
- No neon, no candy pastels.
- No heavy drop shadows (keep `shadow-sm`, occasionally `shadow-md`).
- No emoji as UI icons.
- No English-only microcopy in user-facing surfaces (keep Persian; English only inside `Navbar` admin-ish links for now — flag for cleanup, don't break).

---

## 2. Tokens (drop-in, non-breaking)

Add to `src/app/globals.css` under `@tailwind utilities;`. These are additive — existing `bg-slate-*` / `text-slate-*` classes continue to work. Components can opt in via `bg-[var(--surface)]` etc. as they are touched.

```css
:root {
  /* Surfaces */
  --bg:          #F7F7F5;   /* page background — warmer than slate-50 */
  --surface:     #FFFFFF;   /* cards, bubbles (received), sheets */
  --surface-2:  #F1F0EC;    /* subtle fills, pressed states, skeletons */
  --overlay:    rgba(15, 18, 20, 0.45);

  /* Ink */
  --ink:        #11151A;    /* primary text */
  --ink-2:      #3A4149;    /* secondary text */
  --ink-3:      #6B7480;    /* tertiary, timestamps, meta */
  --ink-4:      #A7ADB5;    /* disabled, placeholder */

  /* Lines */
  --line:       #E6E5E0;    /* default borders, dividers */
  --line-strong:#D4D2CB;

  /* Accent — single warm Persian-tea tone */
  --accent:     #B4532A;    /* primary actions, send, unread badge */
  --accent-ink: #FFFFFF;    /* text on accent */
  --accent-soft:#F5E4DA;    /* tinted chips, outgoing bubble bg */
  --accent-soft-ink:#6B2E14;

  /* Status */
  --success:    #2F7A4E;
  --danger:     #B3261E;
  --warning:    #A2700A;
  --info:       #2B5E9C;

  /* Radius */
  --r-sm: 8px;
  --r-md: 12px;
  --r-lg: 16px;
  --r-xl: 20px;
  --r-pill: 999px;

  /* Elevation */
  --shadow-1: 0 1px 2px rgba(17,21,26,0.04), 0 1px 1px rgba(17,21,26,0.03);
  --shadow-2: 0 4px 16px -6px rgba(17,21,26,0.10);
  --shadow-nav: 0 -4px 24px -8px rgba(17,21,26,0.12); /* already used in AppBottomNav */
}

/* Dark mode — planned, not required for family launch. Keep variables ready. */
@media (prefers-color-scheme: dark) {
  :root {
    --bg:        #0F1214;
    --surface:   #171B1F;
    --surface-2: #1E2328;
    --ink:       #EDEEEF;
    --ink-2:     #B8BCC1;
    --ink-3:     #8A9098;
    --ink-4:     #5B6169;
    --line:      #252A30;
    --line-strong:#333941;
    --accent:    #E07A4A;
    --accent-ink:#1B0F08;
    --accent-soft:#3A1D10;
    --accent-soft-ink:#F5D2BC;
  }
}

body {
  background: var(--bg);
  color: var(--ink);
}
```

**Tailwind-native mapping** (no config change required — used inline):
- `bg-[var(--bg)]`, `bg-[var(--surface)]`, `text-[var(--ink)]`, `border-[var(--line)]`, etc.
- Existing `bg-slate-50` is an acceptable temporary stand-in for `--bg`. Don't rush a mass find-replace.

---

## 3. Typography

### 3.1 Font

Load **Vazirmatn** (OFL, excellent Persian coverage, neutral sans) via `next/font`. This is the *only* font change; keep Latin fallback sensible.

```ts
// src/app/layout.tsx — additive
import { Vazirmatn } from 'next/font/google';

const vazir = Vazirmatn({
  subsets: ['arabic', 'latin'],
  display: 'swap',
  variable: '--font-vazir',
  weight: ['400', '500', '600', '700'],
});

// <html lang="fa" dir="rtl" className={vazir.variable}>
// body: font-family: var(--font-vazir), ui-sans-serif, system-ui, sans-serif;
```

Add to `globals.css`:

```css
body {
  font-family: var(--font-vazir), ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  font-feature-settings: "ss01", "ss02"; /* Vazirmatn stylistic sets — optional */
}
```

### 3.2 Scale (mobile, base 16px)

| Role        | Size  | Weight | Line-height | Usage |
|-------------|-------|--------|-------------|-------|
| display     | 24px  | 700    | 1.25        | empty-state titles, onboarding |
| title       | 18px  | 700    | 1.3         | page/section headers, sheet titles |
| body-lg     | 16px  | 500    | 1.55        | chat bubbles, feed post body |
| body        | 15px  | 400    | 1.6         | default text, descriptions |
| label       | 13px  | 600    | 1.35        | button text, tab labels, chips |
| caption     | 12px  | 500    | 1.3         | timestamps, meta, counters |
| micro       | 11px  | 600    | 1.2         | unread badge digits, tags |

**Rules:**
- Persian text breathes — bump `line-height` by ~0.1 vs an equivalent Latin design. Values above already account for this.
- Numerals: use `font-variant-numeric: tabular-nums` on timestamps, counters, and unread badges so they don't jitter.
- Never use Latin numerals inside Persian UI copy except on tokens the user typed themselves. Convert display numbers with `toLocaleString('fa-IR')` at the render site.
- Avoid italic — Persian doesn't italicize. Use weight for emphasis.

---

## 4. Spacing, radius, elevation

**Spacing scale (Tailwind-native — use these only):**
`1 (4px)`, `2 (8px)`, `3 (12px)`, `4 (16px)`, `5 (20px)`, `6 (24px)`, `8 (32px)`, `10 (40px)`, `12 (48px)`.
Ban intermediate half-steps (`1.5`, `2.5`) except on tab/nav padding that already uses them.

**Touch targets:** minimum 44×44px. Bottom-nav tabs already use `min-h-[3.25rem]` — keep.

**Safe area:** already handled via `env(safe-area-inset-bottom)` in `AppShell` + `AppBottomNav`. Mirror the same pattern for any future top-stick headers: `pt-[max(0.75rem,env(safe-area-inset-top))]`.

**Radii (stick to these four):**
- `rounded-xl` (12px) — buttons, inputs, tab pills, small chips.
- `rounded-2xl` (16px) — cards, chat bubbles, modals, sheets.
- `rounded-3xl` (24px) — hero/empty-state illustrations containers only.
- `rounded-full` — avatars, dots, FAB, unread badges.

**Elevation — use three tiers only:**
- **Flat:** default. Border + surface.
- **shadow-sm:** cards, composer, floating chips.
- **shadow-md:** FAB, open sheets, toast. Avoid `shadow-lg` and up.

---

## 5. Component rules

> Format per component: **Intent → Anatomy → Rules → States → Class recipe**. The class recipe is a *reference*, not a mandate — the agent should inline these into existing components without restructuring props.

### 5.1 Navbar (`src/components/Navbar.tsx`)

**Intent:** Minimal top bar. Brand on the right (RTL start), contextual actions on the left (RTL end). Currently mixes English Home/Profile/Upload links with a Persian "توت" brand — this is inconsistent for a Persian-first app.

**Rules:**
- Brand "توت" stays, bumped to `font-extrabold text-base`.
- Replace English nav links with an **avatar button** on the left that opens profile. Upload lives inside `/home` composer (FAB), not in the global navbar.
- Logout moves into `/profile`. Global navbar should have at most: brand + avatar.
- Height fixed at `56px`. Sticky, `backdrop-blur`, 1px bottom border in `var(--line)`.
- On chat detail (`/direct/[id]`) the global Navbar must be *replaced* by a chat-specific header (see §5.3). Use the existing `AppSectionHeader` pattern or hide Navbar via pathname check.

**Class recipe (reference):**
```
header: sticky top-0 z-10 w-full border-b border-[var(--line)] bg-[var(--surface)]/85 backdrop-blur
inner:  mx-auto flex max-w-md items-center justify-between gap-3 px-4 h-14
brand:  text-base font-extrabold tracking-tight text-[var(--ink)]
avatar: h-9 w-9 rounded-full border border-[var(--line)] bg-[var(--surface-2)]
```

### 5.2 Bottom nav (`src/components/AppBottomNav.tsx`)

**Intent:** 4-tab primary navigation. Current labels (استوری، گفتگو، ویترین، فضاها) are correct — keep.

**Rules:**
- Add a **small icon** above each label (20px, stroke 1.5, `currentColor`). Labels stay at 11–12px below.
- Active state: replace full `bg-slate-900 text-white` pill with an accent **dot indicator** under the active tab label + `text-[var(--ink)] font-bold`. The whole-pill fill is visually heavy for a bottom nav used constantly. Inactive: `text-[var(--ink-3)]`.
- Unread dot on گفتگو tab when there are unread DMs — 8px circle in `var(--accent)`, top-left of the icon (RTL: visually top-right of icon container).
- Keep existing `max-w-md`, safe-area padding, and shadow.

**State matrix:**

| State    | Label color      | Icon         | Indicator           |
|----------|------------------|--------------|---------------------|
| default  | `--ink-3`        | stroke       | none                |
| active   | `--ink` bold     | filled/stroke| 4px dot, `--accent` |
| badge    | unchanged        | stroke       | 8px dot top-corner  |

### 5.3 Chat bubbles (`/direct/[id]`, groups, channels)

**Intent:** WhatsApp-parity readability. Persian text rarely mixes with punctuation well — bubbles must not clip trailing dots/ZWNJ.

**Anatomy:**
```
[timestamp • status]  ← meta row, 12px, --ink-3
[bubble]              ← text + optional media
[reactions bar]       ← optional
```

**Rules:**
- **Incoming:** `bg-[var(--surface)]` + 1px `border-[var(--line)]`, `rounded-2xl` with the RTL-start corner (right-top in RTL) at `rounded-tr-md` to point at the sender.
- **Outgoing:** `bg-[var(--accent-soft)] text-[var(--accent-soft-ink)]`, no border. RTL-end corner (left-top in RTL) at `rounded-tl-md`. Do **not** use solid `--accent` as bubble fill — too heavy for long threads.
- Max width `75%` of chat width. Padding `px-3.5 py-2.5`. Bubble text: `body-lg` (16/1.55).
- Bubble tails (the classic "beak"): **skip for launch**. Corner variation is enough and ships faster.
- Consecutive bubbles from the same author: collapse vertical gap to `4px`, and square the adjacent corner (bottom of previous, top of next) to `rounded-md` for a visual group.
- Timestamps: **inside** the bubble, bottom-end corner, 11px `--ink-3` (outgoing: `--accent-soft-ink` at 60% opacity). Not outside — saves vertical space.
- Delivery status (outgoing only): `✓` sent, `✓✓` delivered, `✓✓` in `--accent` when read. SVG, not unicode, so style stays consistent.
- Reply quote: a 3px right border (RTL-start) in `--accent`, `bg-[var(--surface-2)]`, `rounded-md`, two lines max with `line-clamp-2`, above the message text.
- Media (image/video): inside the bubble, `rounded-xl`, no extra padding. If caption exists, image flush top, text padding below.
- System messages (joined, created): centered pill, `text-caption`, `bg-[var(--surface-2)]`, `text-[var(--ink-3)]`, no bubble.

**Chat header (replaces Navbar on `/direct/[id]`):**
```
h-14, sticky, surface bg, line bottom
[← back] [avatar 36] [name + presence] [... menu]
```
Back arrow is RTL-aware: in RTL, the back chevron points *right*. Use `→` visually (`<svg>` with `rotate-180` of a left chevron, or a proper right chevron).

### 5.4 Feed cards (`/home`)

**Intent:** X/Twitter parity, but calmer. Story strip on top, then a linear feed of post cards.

**Story strip (top of `/home`):**
- Horizontal scroller, 88px tall, `gap-3`, `overflow-x-auto no-scrollbar`, `snap-x snap-mandatory`.
- Each story: 64×64 avatar with 2px ring (`--accent` if unseen, `--line` if seen), `rounded-full`, name below in 11px `line-clamp-1`.
- First item is always "شما" (you) with a `+` overlay to add a story.

**Post card:**
```
Card (rounded-2xl, border --line, bg --surface, p-4, space-y-3)
├── header row: avatar(40) • name(label, bold) • @handle(--ink-3) • · • time(--ink-3) • ...(menu, left)
├── body: text (body-lg, whitespace-pre-wrap, line-clamp-8 + "ادامه" when long)
├── media (optional): rounded-xl, aspect-ratio maintained, max-h-[420px]
└── actions row: reply • retoot • like • share — icon+count, 24px tap area, --ink-3; like active = --accent
```

**Rules:**
- No card elevation — flat surfaces separated by 8px vertical gap + the 1px border. Shadows pile up and feel Western-SaaS.
- Action counts: Persian numerals via `toLocaleString('fa-IR')`.
- Hashtags and @mentions: `text-[var(--accent)]`, no underline.
- Never truncate with `...` — use Persian `…` or the word "ادامه" for long bodies.
- Long numbers (1.2K): format as `۱٫۲ هزار` / `۳٫۴ میلیون` locally.

### 5.5 Vitrin cards (`/vitrin`)

**Intent:** Shop/directory surface. Product-ish cards but calm — Toot is not a marketplace-first app.

**Layout:** 2-column grid, `gap-3`, each card:
```
Card (rounded-2xl, border, bg --surface, overflow-hidden)
├── image (aspect-[4/5], bg --surface-2, fallback monogram)
├── body (p-3, space-y-1)
│   ├── title (label, line-clamp-2, text-[var(--ink)])
│   ├── seller (caption, --ink-3, line-clamp-1)
│   └── price row: price (label, --ink) • old price (caption, line-through --ink-4)
```

**Rules:**
- Currency: "تومان" after the number, `text-caption --ink-3`, never before.
- Never show a star-rating unless the backend provides one. For launch, omit ratings entirely.
- Featured badge (if any): top-end corner chip, `bg-[var(--accent-soft)] text-[var(--accent-soft-ink)]`, `text-micro`, `rounded-pill`, `px-2 py-0.5`.
- Empty cells while loading: the same card shape with `--surface-2` fills, `animate-pulse`. Never a spinner in the grid.

### 5.6 Empty states

**Intent:** Every list (`/direct`, `/home`, `/vitrin`, `/spaces`, chat threads) needs a real empty state. No "Loading…" that sticks.

**Anatomy:**
```
centered column, max-w-xs, gap-3, py-16
├── glyph: 64×64 square, rounded-2xl, bg --surface-2, a single inline stroke icon centered
├── title: title style, text-[var(--ink)]
├── body:  body, text-[var(--ink-3)], text-wrap: balance
└── action (optional): single primary button, not full-width — auto width, px-5 py-2.5
```

**Copy rules (Persian):**
- Start with the situation, not an apology. "هنوز گفتگویی نداری" > "متأسفانه چیزی پیدا نشد".
- Action verb ending matches second-person singular informal ("شروع کن"، "اضافه کن"), consistent with messaging apps.
- Never use "کلیک کنید" — this is mobile. Use "بزن" / "باز کن" or a button label only.

**Required empty states (minimum for launch):**
- `/home` no posts: "هنوز چیزی اینجا نیست" + "اولین توت رو بنویس" button (opens composer).
- `/direct` no conversations: "گفتگویی نداری" + "شروع گفتگو" button.
- `/direct/[id]` new thread: centered caption "اولین پیامت رو بفرست".
- `/vitrin` no items: "چیزی برای نمایش نیست".
- `/spaces` no spaces: "هنوز عضو فضایی نیستی" + "کشف فضاها".
- Search no results: "چیزی پیدا نشد" + hint to change query.

### 5.7 Buttons & FAB (`src/components/ui/Button.tsx`)

**Current `Button` is always full-width + `bg-slate-900`.** That's fine for forms, too blunt everywhere else. Extend (don't replace) with a `variant` and `size`.

**Variants:**

| variant   | bg                     | text                       | border                  | use                      |
|-----------|------------------------|----------------------------|-------------------------|--------------------------|
| primary   | `--accent`             | `--accent-ink`             | none                    | send, confirm, main CTA  |
| neutral   | `--ink`                | `#FFFFFF`                  | none                    | form submit (keep legacy)|
| secondary | `--surface`            | `--ink`                    | 1px `--line`            | dismiss, cancel, alt     |
| ghost     | transparent            | `--ink-2`                  | none                    | inline text actions      |
| danger    | `--danger`             | `#FFFFFF`                  | none                    | delete, block            |

**Sizes:**
- `sm`: `h-9 px-3 text-label rounded-xl`
- `md`: `h-11 px-4 text-label rounded-xl` (default)
- `lg`: `h-12 px-5 text-body-lg font-semibold rounded-xl` (full-width forms)

**States:**
- `:hover` on touch devices is unreliable — rely on `:active` for feedback (`active:opacity-90` on filled, `active:bg-[var(--surface-2)]` on secondary/ghost).
- `:disabled`: `opacity-50 cursor-not-allowed`. Never hide the icon, never change text to "لطفاً صبر کنید".
- `loading`: keep the existing spinner pattern; disable the button; keep width (no layout shift).

**FAB (Floating Action Button):**
- Only on `/home` (compose توت) and `/direct` (new conversation).
- 56×56, `rounded-full`, `bg-[var(--accent)]`, `shadow-md`, centered icon 24px in `--accent-ink`.
- Position in RTL: **bottom-left** (24px from left, 88px from bottom to clear bottom-nav + safe area).
- On scroll down: shrink to icon-only (it already is) and optionally slide out. For launch: no hide-on-scroll — keep it simple.

**Icon button (toolbar, chat composer):**
- 40×40, `rounded-full`, transparent bg, `text-[var(--ink-2)]`, `active:bg-[var(--surface-2)]`.

---

## 6. Form inputs (`src/components/forms/TextInput.tsx`)

Not in the request list, but chat composer and auth pages live and die by this. Rules:

- Height `h-11` (chat composer) / `h-12` (auth). `rounded-xl`. Border `--line`, focus border `--ink`, no glow ring.
- Placeholder: `--ink-4`, 15px, Persian only.
- Error text: 12px, `--danger`, below input, `mt-1`.
- Labels: 13px, `--ink-2`, above input, `mb-1.5`.
- Never put icons inside the input on the RTL-end side if they are decorative; only interactive icons (clear, search) go inside.

---

## 7. Prioritized polish checklist (by route)

> Each row is a single, shippable, non-breaking change. Pick top-to-bottom.

### 7.1 Global (`src/app/layout.tsx`, `globals.css`)
- [ ] **P0** Load Vazirmatn via `next/font`; wire `--font-vazir`.
- [ ] **P0** Paste the `:root` token block into `globals.css`.
- [ ] **P0** Set `body { background: var(--bg); color: var(--ink); font-family: var(--font-vazir) }`.
- [ ] **P1** Convert `Navbar` to brand+avatar only; move English links out.
- [ ] **P1** Hide global `Navbar` on `/direct/[id]` (pathname check in `AppShell`), reuse `AppSectionHeader` pattern.
- [ ] **P2** Add `tabular-nums` globally to elements with a `data-numeric` attr (or a `.num` utility class).

### 7.2 `AppBottomNav`
- [ ] **P0** Add 20px stroke icons above each label (story, chat, bag, compass).
- [ ] **P0** Swap active state from full pill fill to bold text + 4px accent dot underline.
- [ ] **P1** Add unread dot on "گفتگو" sourced from a simple hook (`useUnreadCount()` or prop).
- [ ] **P2** Haptic feedback on tab change where available (`navigator.vibrate?.(8)`), behind a feature flag.

### 7.3 `/home` (feed)
- [ ] **P0** Add story strip row above feed. Placeholder data OK for launch.
- [ ] **P0** Post card header: avatar + name + handle + time + menu — reorder to RTL-correct order.
- [ ] **P0** Action row: reply/retoot/like/share with counts in Persian numerals.
- [ ] **P1** FAB "نوشتن توت" bottom-left.
- [ ] **P1** Empty state (see §5.6).
- [ ] **P2** Long-post "ادامه" toggle (`line-clamp-8` + button).
- [ ] **P2** Pull-to-refresh hint (native behavior only, don't build custom).

### 7.4 `/direct` (conversation list)
- [ ] **P0** Row rhythm: avatar(48) • name(label) + last-message preview(caption, `--ink-3`, line-clamp-1) • time(caption) + unread badge.
- [ ] **P0** Unread badge: `rounded-full`, `bg-[var(--accent)]`, `text-[var(--accent-ink)]`, 18×18 min, `text-micro`, Persian numerals.
- [ ] **P0** 1px `--line` divider between rows, no padding inside the divider (full-bleed).
- [ ] **P1** Sticky search bar at top (`h-11`, `rounded-xl`, `bg-[var(--surface-2)]`).
- [ ] **P1** FAB "گفتگوی جدید" bottom-left.
- [ ] **P1** Empty state.
- [ ] **P2** Pinned conversations section with a tiny pin glyph.

### 7.5 `/direct/[id]` (chat thread)
- [ ] **P0** Replace top Navbar with chat header: back(→) • avatar • name + presence • menu.
- [ ] **P0** Bubble styling per §5.3 — incoming/outgoing, corner variation, in-bubble timestamp.
- [ ] **P0** Composer: sticky bottom, `bg-[var(--surface)]` with top `--line` border, attach icon (RTL-start), growing textarea (min `h-11`, max 6 lines), send button on RTL-end. Send button disabled until non-empty.
- [ ] **P0** Auto-scroll to bottom on new message + preserve scroll on history load.
- [ ] **P1** Delivery ticks on outgoing bubbles.
- [ ] **P1** Reply-to quote preview inside composer.
- [ ] **P1** "Today" / "دیروز" / "سه‌شنبه" date separators between day groups — centered pill, `--surface-2`.
- [ ] **P2** Typing indicator: 3-dot animation in a ghost bubble.
- [ ] **P2** Long-press message → action sheet (reply, copy, delete). For launch, a `...` on the bubble is acceptable.

### 7.6 `/groups` *(planned — route does not exist yet)*
- [ ] **P0** When route is scaffolded, reuse `/direct` list and `/direct/[id]` thread shells verbatim — **do not fork styles**. Differences are data-only.
- [ ] **P1** Group header: group avatar + member count (`caption`, `--ink-3`) under name.
- [ ] **P1** Member join/leave system messages per §5.3.
- [ ] **P2** Mention autocomplete inside composer (@user) styled in `--accent`.

### 7.7 `/channels` *(planned — route does not exist yet)*
- [ ] **P0** List surface ≈ `/direct` but each row is read-only channel; no unread composer affordance on row.
- [ ] **P0** Channel thread: outgoing bubble variant is **disabled** for non-admins; everyone sees incoming-style bubbles only. Centered view count below each post.
- [ ] **P1** Subscribe/Unsubscribe button pinned below channel header.
- [ ] **P2** Reactions strip under each post (tap to react, long-press for picker).

### 7.8 `/spaces`
- [ ] **P0** Treat as a discovery surface. Grid of space cards (similar anatomy to Vitrin, 2-col) with space avatar + title + member count + 1-line description.
- [ ] **P1** Filter chips row at top: "دنبال‌شده"، "پیشنهادی"، "جدید" — `rounded-pill`, `bg-[var(--surface-2)]` default, active `bg-[var(--ink)] text-white`.
- [ ] **P1** Empty state per §5.6.

### 7.9 `/vitrin`
- [ ] **P0** 2-column card grid per §5.5. Swap current layout to use the new card anatomy.
- [ ] **P0** Price formatting utility (`formatPriceFa(n)` in `src/lib/format.ts`): Persian numerals, thousand separators as `٬`, suffix "تومان".
- [ ] **P1** Category chips row (sticky under section header). Same chip style as §7.8.
- [ ] **P1** Skeleton cards while loading (`animate-pulse`, `--surface-2` fills).
- [ ] **P1** Empty state.
- [ ] **P2** Saved/bookmarked toggle (heart outline → filled `--accent`) on each card, top-end corner.

---

## 8. Shared utilities (recommend adding to `src/lib/`)

Pure helpers. No new deps.

```ts
// src/lib/format.ts
export const toFaDigits = (n: number | string) =>
  String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);

export const formatCount = (n: number) => {
  if (n < 1000) return toFaDigits(n);
  if (n < 1_000_000) return toFaDigits((n / 1000).toFixed(1)) + ' هزار';
  return toFaDigits((n / 1_000_000).toFixed(1)) + ' میلیون';
};

export const formatPriceFa = (n: number) =>
  toFaDigits(n.toLocaleString('fa-IR')) + ' تومان';

export const formatTimeFa = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
};

export const formatRelativeFa = (iso: string) => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)       return 'همین الان';
  if (diff < 3600)     return toFaDigits(Math.floor(diff / 60))   + ' دقیقه پیش';
  if (diff < 86_400)   return toFaDigits(Math.floor(diff / 3600)) + ' ساعت پیش';
  if (diff < 604_800)  return toFaDigits(Math.floor(diff / 86_400)) + ' روز پیش';
  return new Date(iso).toLocaleDateString('fa-IR');
};
```

---

## 9. Accessibility & RTL gotchas

- **Logical properties over physical:** prefer `ps-*` / `pe-*` / `ms-*` / `me-*` over `pl/pr/ml/mr` when Tailwind supports them (Tailwind 3.3+). The repo is on `^3.4.10`, so logical utilities are available.
- **Icons that imply direction** (back, next, send-paper-plane) must be mirrored in RTL. For Next.js inline SVGs, add `className="rtl:rotate-180"` on directional glyphs.
- Every interactive element needs a Persian `aria-label` if the visible text is just an icon.
- Color alone never conveys state — unread uses badge + color, active tab uses weight + dot + color.
- Minimum contrast: `--ink-3` on `--bg` = 4.6:1 (passes AA for body). `--ink-4` is for placeholder/disabled only, not body text.

---

## 10. Out of scope for family launch

Listed so the coding agent doesn't wander into these:

- Dark mode polish beyond the token block above.
- Multi-language (English) UI.
- Push-notification permission UX.
- In-app theming / user-picked accents.
- Motion system (page transitions, shared-element). Use `transition-colors duration-150` ad hoc only.
- Custom illustrations / lottie.
- Voice messages UI.
- Video/voice calling surface.

---

## 11. Suggested commit slicing (non-binding)

Keep PRs small so code review stays sane:

1. `chore(ui): add CSS tokens + Vazirmatn`
2. `feat(nav): simplify Navbar + bottom-nav active state`
3. `feat(home): feed card rhythm + story strip`
4. `feat(direct): conversation list rhythm + unread badges`
5. `feat(chat): bubble styling + chat header`
6. `feat(vitrin): card grid + price formatter`
7. `feat(spaces): discovery grid + filter chips`
8. `chore(ui): empty states across routes`
9. `feat(ui): Button variants + FAB`

— end of spec —
