# Cross-Worktree Functionality Recovery

Audit of four parallel `kuwait-feedback-platform*` worktrees to find functionality that
existed in a sibling but was missing from the consolidation target, and to carry over
anything genuinely absent.

**Target:** `kuwait-feedback-platform-kiosk-clean`
**Date:** 2026-08-01

## Worktrees inventoried

| Worktree | HEAD | Role |
|---|---|---|
| `kuwait-feedback-platform-kiosk-clean` | (target) | Consolidation target |
| `kuwait-feedback-platform` | `86ad9b7` | Auth/security hardening WIP |
| `kuwait-feedback-platform-signature-verification` | `29fc1e2` | Email signature renderer WIP |
| `kuwait-feedback-platform-kiosk` | `02004af` | Earlier kiosk implementation |

## Findings

The kiosk feature set was already fully present in the target — and in better shape than
in the source worktrees. The earlier `kuwait-feedback-platform-kiosk` worktree placed the
management UI under an `(authenticated)` route group with `/api/admin/kiosks` REST
endpoints; the target instead uses the `(dashboard)` group with server-side data loading
and RPC calls, which matches the conventions of every other management page. The target
version is the one to keep.

One real gap: **the Kiosks entry point was missing from the feedback channels index.**
`/dashboard/settings/channels` listed Email Signatures, Campaigns, and Escalation Rules
but had no Kiosks card, so kiosks were reachable only via the sidebar. There was also no
`channels/kiosks` route, making kiosks the only channel absent from that URL space.

### Carried over

| Change | File |
|---|---|
| Kiosks card on the channels index, with a live device count | `src/app/(dashboard)/dashboard/settings/channels/page.tsx` |
| Canonical `channels/kiosks` route redirecting to the management UI | `src/app/(dashboard)/dashboard/settings/channels/kiosks/page.tsx` |
| `countKioskDevices` helper | `src/features/kiosk/count.ts` |
| Tests for the helper | `src/features/kiosk/count.test.ts` |

The new route redirects to `/dashboard/kiosks` rather than duplicating the management
screen, keeping one implementation while making the channels URL space consistent.

`countKioskDevices` degrades to `0` on RPC failure or missing organization instead of
throwing, so a kiosk data problem cannot take down the whole channels index. The kiosks
page itself still surfaces load errors, which is where an operator would act on them.

### Deliberately not carried over

Uncommitted work in the sibling worktrees is unrelated in-progress feature work, not
functionality missing from the target. It was left untouched:

- **`kuwait-feedback-platform`** — auth/security hardening: `src/lib/security/*`
  (account lockout, audit, rate limiter, sanitize), an `auth_security_hardening`
  migration, and edits to the feedback rate endpoint. Absent from the target by design;
  this is a separate initiative mid-flight.
- **`kuwait-feedback-platform-signature-verification`** — email renderer changes and a
  new renderer test. Actively being worked on in that worktree.
- **`kuwait-feedback-platform-kiosk`** — the superseded kiosk implementation described
  above.

Pulling any of these in would mean importing half-finished work from another branch.
They should land through their own worktrees.

## Verification

| Check | Before | After |
|---|---|---|
| `vitest run` | 36 files / 196 tests | **37 files / 201 tests, all passing** |
| `tsc --noEmit` | clean | **clean** |
| `eslint` | 0 errors | **0 errors** |
| `next build` | — | **exit 0, compiled successfully** |

The 5 added tests are the `countKioskDevices` cases. ESLint reports 4 pre-existing
warnings (unused `context`/`messages`/`createCampaign`) in the sibling channel pages;
these predate this work and were left alone.

Build output confirms both routes registered:

```
├ ƒ /dashboard/kiosks
├ ƒ /dashboard/settings/channels
├ ƒ /dashboard/settings/channels/kiosks
```

All three source worktrees were re-checked after the changes and remain at their original
HEADs with their working trees byte-identical — nothing was staged, committed, or reverted
in any of them.

## Not verified

The dev server was not exercised, so the Kiosks card and redirect have not been
click-tested in a browser. The device count renders through the same RPC the kiosks page
already uses, and the count helper is unit-tested, but end-to-end behavior against a live
Supabase instance is unconfirmed.
