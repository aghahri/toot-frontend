# Contacts / Phonebook integration — v1 plan (planning only)

This document captures the next-pass plan for letting Toot users start
direct chats and add group members from their phone's contact list,
**without** turning the app into a contact-syncing platform.

**Nothing below is implemented.** Each section lists scope, risk
profile, and the surface area an implementer needs to touch. Pickup
is sequential (one phase at a time).

---

## Goals

Allow the user to:

1. Start a direct chat with someone they already have in their phone
   contacts (and who is already on Toot).
2. Add multiple group members from phone contacts in one pass.

## Anti-goals (v1)

- No full contact sync.
- No background contact upload.
- No persistent storage of raw phonebook data on Toot servers.
- No "who has my number?" reverse lookup beyond the user's own
  explicit picks.
- No automatic invite-SMS to non-Toot contacts (deferred to a later
  invite-flow proposal).

## Hard rules

- Picker is **only** opened by an explicit user tap on
  `انتخاب از مخاطبین گوشی`.
- Only the contacts the user picks in the OS sheet are sent to the
  backend.
- Numbers are **normalized client-side** before transit.
- Backend matches against Toot users by normalized phone number, but
  **does not store** the submitted phone numbers — match is in-memory
  only, request is logged with redacted last-4-digits at most.
- Unmatched numbers are **discarded** and never persisted.
- Server response only returns the matched Toot users (id, name,
  username, avatar) — never echoes which input numbers matched which
  user, so the client can't accidentally build a reverse-mapping
  cache.

---

## 1. Web / PWA — Contact Picker API feasibility

`navigator.contacts.select(['name', 'tel'], { multiple: true })`

- **Coverage:** Chrome on Android (>=80), Edge on Android. **Not**
  Safari, **not** Firefox, **not** desktop Chrome. Effectively
  Android-Chrome-only.
- **Permission UX:** OS-level sheet, one-shot, per-call. No
  persistent permission. User picks contacts in the sheet — only the
  picked subset is returned.
- **Caveats:**
  - Requires HTTPS + secure context (we have it).
  - Returns raw E.164 / local strings; we normalize before send.
  - `await navigator.contacts.getProperties()` should be feature-
    detected first.
- **Verdict:** Good fit for the "tap → OS sheet → matched Toot users"
  flow. Falls back gracefully (button hidden) on unsupported
  platforms.

## 2. Capacitor Android — native contacts feasibility

- We already ship the Android shell (`android/`) and have FCM. Adding
  `@capacitor-community/contacts` (or rolling a thin native bridge)
  is mechanical.
- **Permission:** `READ_CONTACTS` runtime permission. Must be
  requested only at the moment the user taps `انتخاب از مخاطبین گوشی`
  (no upfront prompt on first app launch).
- **Recommendation:** Even on Capacitor, prefer the **system contact
  picker intent** (`Intent.ACTION_PICK` / `ContactsContract`) over
  full `READ_CONTACTS` access. The picker intent does **not** need
  the runtime permission and only returns the user-picked entry,
  which matches our hard rules. Use `READ_CONTACTS` only if multi-
  select is required and the picker intent doesn't cover it.
- **Caveats:** Play Store now reviews any app declaring
  `READ_CONTACTS`. Picker intent avoids that review entirely.

## 3. iOS limitations

- No web Contact Picker API. PWAs cannot read contacts.
- Capacitor on iOS: requires `NSContactsUsageDescription` in
  `Info.plist`, full address-book read permission. There is **no**
  Apple-provided multi-pick contact picker UI on iOS without
  `CNContactPickerViewController` (single contact only) — anything
  multi-pick means full address-book access.
- **Verdict for v1:** iOS is **out of scope**. v1 ships
  Android-Chrome (web) + Capacitor Android. iOS users see the same
  manual /users/search picker they have today. The
  `انتخاب از مخاطبین گوشی` button is hidden on iOS.

## 4. Is existing /users/search enough?

`GET /users/search?q=...&limit=...&networkId=...` already supports
phone-prefix matching (`mobile contains`) and Persian-y/k normalization
(see `src/users/users.service.ts`).

But:

- It's **one query at a time**. A 12-contact picker would fire 12
  HTTP requests with 12 typing-debounce hacks — wasteful and chatty.
- It's a public-shape autocomplete; results include `name`,
  `username`, masked phone — not ideal for a batch matcher because
  it returns prefix matches, not exact-equality on the full
  normalized number.
- No way to pass an array of normalized E.164 numbers in one call.

Hence: **a dedicated batch endpoint is worth the small surface
expansion.**

## 5. Recommended backend endpoint

```
POST /users/match-phones
Body: { phones: string[] }     // each pre-normalized to "98XXXXXXXXXX" by client
Response: {
  matches: Array<{
    id: string;
    name: string;
    username: string;
    avatarUrl?: string;
  }>;
}
```

Constraints:

- Auth required (existing JWT guard).
- Hard cap on `phones.length` (proposed: **50** per request).
  Anything bigger → 400.
- Server-side **re-normalization** of each phone (defense-in-depth)
  before Prisma `mobile: { in: [...] }` query.
- **No persistence** of the input list. No log of phone numbers in
  request logs (redact in interceptor).
- Response order is **deterministic by user.id** so the client
  cannot infer "input N matched user X" — purely a set of matched
  users.
- Excludes the caller themselves and excludes any blocked-pair (if
  block table exists) — same exclusions as `/users/search`.
- Ungated by network: we don't restrict matches to a particular
  neighborhood, because the user already knows this person — they
  picked them from their own phonebook.

Rate limit: per-user 30 requests / hour (defends against using the
endpoint as a phone-number enumeration oracle).

## 6. Privacy policy implications

The privacy policy needs an addendum **before** v1 ships:

- A new "Contacts" section explaining:
  - When we read contacts (only at user tap).
  - Which contacts leave the device (only the user-picked subset,
    only as normalized numbers).
  - That we **don't** store the submitted numbers; matching is
    in-memory.
  - That we never send the user's picks to other users.
  - How to revoke OS permission.
- The Capacitor `READ_CONTACTS` declaration (if used) must be
  reflected in the Play Store data-safety form.

The policy must be Persian-first (the rest of the app is) with an
English mirror.

## 7. Permission UX (Persian)

When the user taps `انتخاب از مخاطبین گوشی` for the first time:

**Inline pre-prompt** (before triggering the OS sheet — explains
why, in Persian):

> ### دسترسی به مخاطبین گوشی
> برای اینکه راحت‌تر دوستانت را پیدا کنی، می‌توانی از لیست مخاطبین
> گوشی‌ات افراد را انتخاب کنی. **توت فقط همان مخاطبینی را که خودت
> انتخاب می‌کنی می‌بیند** و آن‌ها را روی سرورش ذخیره نمی‌کند.
>
> [ ادامه ] [ بی‌خیال ]

If user taps `ادامه`, fire `navigator.contacts.select(...)` (web) or
the Android picker intent (Capacitor). The OS sheet handles the
actual contact selection. **No screen between** the OS sheet and the
match-results screen — we don't show "uploading…" because we want
the user to feel the data isn't lingering.

Match-results screen (after `POST /users/match-phones`):

> ### مخاطبینی که در توت پیدا شدند
>
> [list of matched Toot users with avatar + name + @username + a
> tap-to-start-chat or tap-to-add-to-group action]
>
> اگر کسی در این لیست نیست، یعنی هنوز در توت ثبت‌نام نکرده. می‌توانی
> از طریق دعوت پیامکی او را به توت دعوت کنی. *(deferred to a future
> invite phase — for v1 this line is hidden.)*

Graceful empty state (no matches): `هیچ‌کدام از مخاطبینی که انتخاب
کردی هنوز در توت نیستند.`

Graceful error state (network / 5xx): `الان نمی‌توانیم با مخاطبینت
چک کنیم. بعداً دوباره امتحان کن.`

## 8. Recommended implementation phasing

**Phase A — Backend endpoint, behind feature flag**
- `POST /users/match-phones` shipped with `FEATURE_CONTACTS_MATCH=0`
  by default.
- Unit tests: normalization, dedupe of input list, exclusion of
  caller, hard cap, deterministic order, rate-limit guard.
- Logging redactor confirmed via integration test.

**Phase B — Frontend picker, Android-Chrome web only**
- New small component `ContactPickerButton.tsx` that:
  - Feature-detects `navigator.contacts && navigator.contacts.select`.
  - On tap, shows the Persian pre-prompt (modal, warm tokens).
  - On confirm, calls `navigator.contacts.select(['tel'], { multiple: true })`.
  - Normalizes each `tel` value to `98XXXXXXXXXX` (reuses existing
    OTP registration normalizer).
  - Calls `/users/match-phones` and renders matched users in the
    existing direct/new-chat or groups-add-member UI.
- Wire into:
  1. `/direct` (new-chat modal): `انتخاب از مخاطبین گوشی` shown
     under the search bar when API supported.
  2. `/groups/[id]/members` (add-member screen): same button under
     the search bar.
- Hidden on iOS (web) and on desktop browsers via feature detection.

**Phase C — Capacitor Android picker intent**
- Add a thin native bridge that fires `Intent.ACTION_PICK` against
  `ContactsContract.CommonDataKinds.Phone.CONTENT_URI` for single-
  pick. Use a multi-pick implementation only if Phase B usage data
  shows users want multi-select.
- Wire `ContactPickerButton.tsx` to call the Capacitor bridge when
  `Capacitor.isNativePlatform()` is true, falling back to web Contact
  Picker API otherwise.

**Phase D — Privacy policy update + Play Store data-safety form**
- Persian + English policy text shipped.
- Play Store data-safety section updated to disclose contact-pick
  flow (even if zero retention).
- Rollout flag enabled to public.

**Phase E — Future, not v1**
- Optional invite-by-SMS for unmatched contacts (re-uses the SMS
  provider system, requires a fresh consent screen — out of scope
  here).
- iOS multi-pick if Apple's policy stance on
  `CNContactPickerViewController` evolves, or via a custom screen
  with full address-book read (likely never, given our anti-goals).

---

## Out of scope for this doc

- Full contact graph / "people you may know" — different problem.
- Server-side contact graph storage of any kind.
- Web push for "your contact joined Toot" — also requires storage
  we don't want.

## Risks to flag at implementation time

- **Phone number enumeration oracle:** even with rate limits the
  endpoint can probe whether arbitrary numbers exist on Toot. The
  cap (50/req, 30/hr) plus auth requirement plus deterministic-order
  output mitigates but does not eliminate. Consider Bloom-filter
  responses or per-user daily caps if abuse appears.
- **Persian number formats:** users' phonebooks often hold mixed
  formats (`0912...`, `+98912...`, `+98 912 ...`). Client-side
  normalizer must strip non-digits, drop leading 0, prepend `98`,
  and **also** handle Persian/Arabic-Indic digits (۰۱۲۳ → 0123).
  Reuse the OTP registration normalizer to guarantee parity.
- **Capacitor permission escalation:** if we ever switch from picker
  intent to full `READ_CONTACTS`, Play Store will require a
  data-safety review.
- **Trust signal preservation:** match results must visually match
  the existing /users/search picker rows (handoff warm tokens) so
  there's no second visual language for "this is a Toot user".
