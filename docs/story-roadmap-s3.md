# Story system — S3 roadmap (planning only)

This document captures the next-pass plan for the Story subsystem after
S1 (URL mapping + frontend rail polish), S2 (scheduler + telemetry
columns), and S2.5 (admin queue / sources operationalization).

**Nothing below is implemented.** Each item lists the scope, the rough
risk profile, and the data/migration shape so the implementer can pick
them up one at a time.

---

## S3.1 — `/story/[id]` detail page

**Goal:** a real per-story landing page for the rail card tap and for
share-to-Toot links.

**Frontend**
- New route `src/app/story/[id]/page.tsx` (dynamic, client).
- Fetches `GET /story/published/:id` (new) or reuses the candidates
  list filter for now.
- Layout (handoff-aligned, warm tokens):
  - Cover image (full-bleed, aspect-[16/9], fallback monogram on
    `--surface-2`).
  - Persian title + source name + relative time.
  - Body (`bodyRaw` from candidate, sanitized) — line-height 1.6,
    `text-[var(--ink)]`.
  - Quality / trust line in `--ink-3` for transparency.
  - "بازگشت به /vitrin" + "بازکردن منبع اصلی" buttons.
- Wires `view` telemetry on mount (`recordTelemetry(id, 'view')`)
  same as the rail does.

**Backend**
- Add `GET /story/published/:id` — returns the same `presentCandidate`
  shape, only when status=`PUBLISHED`. 404 otherwise to avoid surfacing
  pending/rejected drafts. Public, throttled.
- No new fields. No migration.

**Risk:** Low. Read-only endpoint, new client route, no shared code
mutated. Internal candidates with `internal://posts/X` URLs still
deep-link via the existing rewrite — the detail page is only useful
for true external sources or for the time-line view of internal items.

**Effort:** 1 backend commit, 1 frontend commit. ~150 LOC each.

---

## S3.2 — Personalized relevance

**Goal:** feed items are weighted by the viewing user's `preferredSpaces`
+ neighborhood association, not the global `relevanceScore` only.

**Backend**
- Extend `listPublishedStories(scope, limit, opts)` to accept an
  optional `viewerUserId` (already on the JWT path) + `preferredSpaces`
  + `neighborhoodNetworkId` (lazy-loaded from `users` + `network_members`
  tables).
- Recompute the per-row sort key:
  `personalizedScore = relevanceScore
                     + spaceBoost (preferredSpace match → +20)
                     + neighborhoodBoost (locationText overlaps user's
                       neighborhood → +25)
                     + freshnessTieBreaker`
- Cap output at the same `limit` budget. Does NOT mutate
  `relevanceScore` in DB; the personalized score is computed on read.

**Frontend**
- No change to `StoryCuratedRail` shape. Optionally pass `scope=for-you`
  to a new endpoint variant if we don't want to add an auth-aware
  request to the existing path.

**Risk:** Medium. The rail today is `@Public()` — adding a viewer-aware
variant means the endpoint splits in two (`@Public` keeps the global
default; an authenticated `@Get('for-you')` returns the personalized
order). Need to verify no caching layer breaks.

**Effort:** 1 backend commit (+ small DB query plan check), 1 small
frontend hookup.

---

## S3.3 — Source health dashboard

**Goal:** when an RSS source breaks (404, parse error, rate-limit), the
operator sees it immediately on `/admin/story/sources`.

**Migration (S3.3-only)**
```
ALTER TABLE story_sources
  ADD COLUMN last_ingested_at TIMESTAMP(3),
  ADD COLUMN last_error_at    TIMESTAMP(3),
  ADD COLUMN last_error_code  VARCHAR(64),
  ADD COLUMN last_error_msg   VARCHAR(512);
```

**Backend**
- `ingestSingleSource()` writes `last_ingested_at = now()` on success.
- On error path, writes `last_error_at` + `last_error_code` (one of:
  `HTTP_4XX`, `HTTP_5XX`, `TIMEOUT`, `PARSE_FAIL`, `EMPTY_FEED`) +
  the truncated error message.
- `listStorySources()` already returns the row spread — new fields
  surface automatically.
- `StoryScheduler.runOnce()` logs "X sources had errors" if any
  `last_error_at >= now-1h` after the tick.

**Frontend**
- `/admin/story/sources` row meta line gets a 4th chip:
  - green dot + "آخرین دریافت: ۱ ساعت پیش" when `last_ingested_at`
    fresh and no recent error
  - amber dot + "خطا: <code>" when `last_error_at` is recent
  - dim "هرگز دریافت نشده" when both null
- Optional: add a "Retry" button that calls the existing single-source
  ingest endpoint without changing `isActive`.

**Risk:** Low. Additive columns + a single `update()` call inside the
existing ingest path. No behavior change for the public Story endpoint.

**Effort:** 1 migration commit, 1 backend commit, 1 frontend commit.

---

## S3.4 — Redis lock for the scheduler

**Goal:** when Toot runs more than one API instance, the cron tick
fires on every node — currently each one independently re-runs both
ingest paths, leading to duplicate-detection thrash and wasted upstream
RSS fetches.

**Backend**
- Add a thin `LockService` provider that takes a key (`'story-auto-
  ingest'`) and a TTL. Uses Redis SETNX with EX (or a single Postgres
  advisory lock if Redis isn't available — `SELECT pg_try_advisory_
  lock(<bigint>)`).
- `StoryScheduler.runOnce()` wraps its body:
  ```
  const handle = await this.lock.acquire('story-auto-ingest', 5 * 60_000);
  if (!handle) { logger.log('skipped: another instance is running'); return; }
  try { ...existing tick... } finally { await this.lock.release(handle); }
  ```
- Logger line surfaces which instance won the lock (use `process.pid`
  + `os.hostname()` for human triage).

**Risk:** Low if Redis client already exists in the project (verify in
`src/`). If not, this could pull a new dependency — defer until a
multi-instance deployment is actually planned.

**Effort:** 1 commit. ~80 LOC. No migration.

---

## S3.5 — Admin moderation workflow

**Goal:** moderation team gets a single inbox to handle reported stories
(currently `/admin/story` is curatorial — pending → published, no path
for "reported by user" stories).

**Migration (S3.5)**
```
CREATE TABLE story_reports (
  id              TEXT NOT NULL PRIMARY KEY,
  candidate_id    TEXT NOT NULL REFERENCES story_candidates(id) ON DELETE CASCADE,
  reporter_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  reason          VARCHAR(64) NOT NULL,
  body            VARCHAR(512),
  status          VARCHAR(16) NOT NULL DEFAULT 'OPEN',  -- OPEN | RESOLVED | DISMISSED
  resolved_at     TIMESTAMP(3),
  resolved_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX story_reports_status_created_at_idx ON story_reports(status, created_at);
CREATE INDEX story_reports_candidate_id_idx     ON story_reports(candidate_id);
```

**Backend**
- New `POST /story/candidates/:id/report` (public, throttled) — accepts
  `{ reason, body }` and writes a row. Reuses the candidate-id sanitizer
  from `recordTelemetry`.
- `GET /admin/story/reports?status=OPEN` — paginated list with the
  joined candidate summary.
- `PATCH /admin/story/reports/:id` — `{ action: 'resolve' | 'dismiss' }`,
  audit-logged via the existing `AuditService`.
- Whether a report being marked RESOLVED auto-rejects the candidate is
  left to the operator: the admin sees both report list + candidate
  status and can act manually.

**Frontend**
- New `/admin/story/reports` page (same chrome as the queue).
- Per-report row: reporter (or "ناشناس"), reason + body, candidate
  preview, "حل شد / رد شد" buttons. "مشاهده در صف" link to
  `/admin/story?focus=<candidateId>` (the queue page accepts an optional
  focus query → scrolls to that row + highlights for 3s).
- A 'گزارش' kebab item is added to the public rail card on `/vitrin`
  (and `/home` if the rail is ever re-enabled). Opens a small modal
  with reason chips (نامرتبط / تکراری / محتوای نامناسب / دیگر) +
  optional body. Telemetry pings keep working alongside.

**Risk:** Medium. New table, new public endpoint (anti-abuse: per-IP
throttling already covers it; per-user uniqueness `(candidate_id,
reporter_user_id)` would prevent dogpiling).

**Effort:** 1 migration, 1-2 backend commits, 2 frontend commits.

---

## Out-of-scope notes

These came up during S1–S2.5 but didn't make the cut:

- **De-dup viewCount per IP/session.** Server-side counter is currently
  uncapped — a refresh of `/home` (when the rail is enabled there)
  re-counts. Aggregate per-(candidate, day, hashed-IP) when the
  marketing team actually starts reading the numbers.
- **`formatPriceFa(n)` helper.** Listed in the handoff §8 but no
  consumer exists yet. Add when the marketplace lands.
- **Story search in admin queue.** Page already loads `?limit=120` with
  no filter beyond status; once volume grows past ~500 candidates,
  add a `?search=` parameter on `listStoryCandidates` + a search input
  on the page.
- **Internal candidate "open in feed" deep-link.** The S1 URL rewrite
  already routes internal posts to `/home?postId=`. No change needed.

---

## Suggested order

1. **S3.3 source health** — smallest scope, biggest ops win, no
   public-API change. Land first.
2. **S3.1 detail page** — shippable on its own, makes share links work.
3. **S3.2 personalized relevance** — needs a stable surface to land on,
   and the detail page makes the personalized rail valuable to navigate.
4. **S3.4 Redis lock** — pull in only when a second API replica is
   actually planned.
5. **S3.5 moderation workflow** — last, because it's the largest scope
   and depends on real user reports volume to be worthwhile.
