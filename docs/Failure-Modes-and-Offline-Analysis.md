# Kiosk Failure Modes & Offline Capability Analysis

**Date:** July 26, 2026
**Version:** 1.0

---

## 1. FAILURE MODE MATRIX

Every failure scenario a real kiosk in a Kuwait business could encounter:

| # | Failure Scenario | Current Behavior | Risk | Fix Status |
|---|-----------------|------------------|------|------------|
| 1 | **Internet disconnected during submission** | Error shown + retry button added | Medium | ✅ Fixed |
| 2 | **Slow internet (fetch timeout after 30s)** | AbortController signals timeout | Low | ✅ Fixed |
| 3 | **Browser refreshed mid-survey** | Answers lost, kiosk resets to welcome | Medium | ⚠️ Acceptable |
| 4 | **iPad restarts** | Guided Access not active → kiosk URL not auto-loaded | High | ❌ See fix below |
| 5 | **Database unavailable** | API throws 500 → customer sees error | Medium | ✅ Error handling |
| 6 | **Duplicate submission** | Idempotency key prevents duplicates | Low | ✅ Built-in |
| 7 | **45-second idle timeout** | Auto-resets to welcome screen | Low | ✅ Built-in |
| 8 | **Power outage** | iPad turns off → must be manually restarted | Medium | ⚠️ Physical issue |
| 9 | **Screen becomes unresponsive (grease/dirt)** | No feedback to customer | High | ❌ See fix below |
| 10 | **Customer navigates away from kiosk URL** | Back-button trapped, but Safari controls still visible | Medium | ⚠️ Partial fix |
| 11 | **Multiple rapid submissions** | Rate limiting prevents abuse | Low | ✅ Built-in |
| 12 | **Survey expired/became archived** | Kiosk shows "Kiosk unavailable" | Low | ✅ Built-in |
| 13 | **iPad storage full** | Safari may crash | Low | ⚠️ Acceptable |
| 14 | **SSL certificate expired** | Browser shows security warning | Critical | ❌ Auto-renew via Vercel |
| 15 | **API rate limit hit for real submissions** | Returns 429 → customer sees error | Low | ✅ Built-in |

---

## 2. DETAILED ANALYSIS OF EACH FAILURE

### Failure 1: Internet Disconnected During Submission

**Before fix:** Error message with no retry. Customer leaves without submitting.
**After fix:** Retry button restores form state. Customer can tap "Try Again" when internet returns.

```
Flow before fix:
  Submit → Fetch hangs → Caught → "Error" message → Customer walks away → Feedback lost

Flow after fix:
  Submit → Fetch fails → "Error" + "Try Again" button → Customer taps retry → Submits successfully
```

**Code change:** Added retry button + AbortController timeout.

### Failure 3: Browser Refresh

**What happens:**
- All React state is lost
- `startedAt` is gone → session is invalid
- Kiosk Shell resets to welcome screen

**Is this acceptable?** Yes — the welcome screen is better than a broken state. The customer starts fresh. The 45s idle timer already resets to welcome, so this is consistent behavior.

**Potential improvement:** Could store partial answers in `sessionStorage` and restore on reload. But this adds complexity — for a kiosk, starting fresh is simpler and safer.

### Failure 4: iPad Restart

**What happens:**
- iPad boots to lock screen
- Guided Access is NOT active after restart
- Safari does NOT automatically reopen

**This is the MOST CRITICAL kiosk failure.** Without auto-restart, the kiosk shows a lock screen or home screen — not the survey.

**Short-term fix:** Train staff to restart Guided Access after any reboot.

**Medium-term fix** (implement if this happens repeatedly):
```yaml
Option A: Use "Guided Access" persistent mode
  - After first Guided Access setup, the iPad remembers
  - BUT: after reboot, Touch ID / passcode is required first

Option B: Use Apple Configurator 2 (macOS app)
  - Configure "Single App Mode" — iPad boots directly into Safari at the kiosk URL
  - Requires Mac + Apple Configurator + supervised iPad
  - Most reliable approach for production

Option C: Use MDM (Jamf / Scalefusion)
  - Configure "Kiosk Mode" with auto-launch URL
  - Device always boots to the survey
  - Recommended for 5+ kiosks
```

**Recommended approach for pilot:** Option B (Apple Configurator) for each iPad during setup. Takes 5 minutes per iPad but ensures restart resilience.

### Failure 9: Screen Unresponsive

**What happens:**
- Kiosk screen has fingerprints / grease
- Touch doesn't register
- Customer thinks the kiosk is broken
- May walk away frustrated

**Mitigation:**
1. Daily cleaning schedule (included in Staff Guide below)
2. Anti-fingerprint screen protector (one-time cost ~5 KWD)
3. Clear "Touch screen here" visual cue on welcome screen (already present)

### Failure 14: SSL Certificate Expired

**Risk: Critical**

With Vercel, SSL certificates are automatically provisioned and renewed via Let's Encrypt. **This should never happen** with Vercel hosting. However:

**What to check:**
- Vercel handles SSL automatically for `*.vercel.app` domains
- For custom domains (feedback.yourcompany.com), Vercel also auto-provisions via Let's Encrypt
- No action needed unless using non-Vercel SSL termination

**If using non-Vercel hosting:** Set up automated renewal with certbot or DNS challenge.

---

## 3. OFFLINE CAPABILITY ANALYSIS

### Question: Does the kiosk NEED offline support?

**Short answer: No, for the pilot phase.**

### Analysis

| Factor | Assessment |
|--------|------------|
| Kuwait internet reliability | 4G/5G excellent in urban areas. Businesses have stable WiFi. |
| Business WiFi uptime | Usually 99%+ in Kuwait businesses. Router restarts < 5 min. |
| Customer expectation | Short feedback (30s). They expect it works immediately. |
| Data loss risk | Internet down → customer sees error → tries later or uses QR on phone |
| Implementation cost | High (IndexedDB, queue management, conflict resolution) |
| Business impact | Low — 5-minute internet gap loses at most 1-2 responses |

### What to tell the business owner

> "The kiosk requires an active internet connection to submit feedback. If your WiFi goes down temporarily, customers will see an error message. They can try again when internet returns, or scan the QR code on their own phone (which uses mobile data). Typical WiFi outages in Kuwait last under 5 minutes — during which 1-2 responses might be missed."

### Offline Architecture Design (Future)

If offline support is requested, here is the recommended approach:

```
Customer submits feedback
       │
       ▼
┌─────────────────────┐
│  IndexedDB Queue     │
│  (in-browser storage)│
└─────────┬───────────┘
          │
          ▼ (when online)
┌─────────────────────┐
│  Service Worker      │
│  detects connectivity│
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Background sync     │
│  POSTs to API        │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Supabase Database   │
└─────────────────────┘
```

**Implementation steps:**
1. Register a Service Worker with `sync` event listener
2. Store pending submissions in IndexedDB
3. On `online` event, replay queued submissions
4. Each submission carries its idempotency key (already built-in)
5. Conflict resolution: Supabase `ON CONFLICT DO NOTHING` on idempotency key

**Estimated effort:** 3-5 days for a production-quality offline queue.

### Recommendation: Skip offline for Phase 1

| Criteria | Decision | Rationale |
|----------|----------|-----------|
| Business need | Low | Kuwait internet is stable |
| Implementation cost | High | 3-5 days of engineering |
| User experience impact | Low | QR code cards serve as fallback |
| Complexity | High | Service Workers, IndexedDB, sync conflicts |

**Revisit if:** The business has frequent internet outages (>1 per week lasting >5 minutes).

---

## 4. RECOVERY PROCEDURES

### For Staff (Quick Fix)

```yaml
Problem: Kiosk shows error message
  1. Check if WiFi is working (look at another device)
  2. If WiFi is down → restart router
  3. Tap "Try Again" on kiosk
  4. If still fails → restart iPad (hold Top button + slide)

Problem: iPad screen is blank/black
  1. Is charger connected? (check enclosure)
  2. Tap screen once (might be asleep)
  3. Press Top button briefly
  4. Hold Top button until Apple logo appears
  5. Wait 2 minutes for restart
  6. Re-enable Guided Access (see setup guide)

Problem: Survey showing "Kiosk unavailable"
  1. The survey was archived or the link is wrong
  2. Contact your admin to publish the survey again
  3. Admin can get a new kiosk URL from the dashboard
  
Problem: Customer feedback appearing twice
  1. Check the response ID — are they identical?
  2. The system prevents duplicates, but network retries can appear as duplicates
  3. This is harmless — the system marks duplicates via idempotency keys
```

### For Admin (Escalation)

```yaml
Problem: Database errors in dashboard
  1. Check Supabase status: https://status.supabase.com
  2. Check Vercel status: https://www.vercel-status.com
  3. Review application logs (Vercel dashboard > Logs)
  4. Contact system administrator

Problem: Lost data
  1. Check Supabase daily backups
  2. Navigate to Supabase > Database > Backups
  3. Restore from last backup if necessary
  4. For point-in-time recovery: Supabase Pro plan includes this
  
Problem: Security incident (unauthorized access)
  1. Check Supabase Auth logs for unusual login patterns
  2. Check audit_logs table in database
  3. Revoke all sessions (Settings > Security)
  4. Reset passwords for all users
  5. Contact IT security team
```

---

## 5. FAILURE TEST LOG

Use this log during deployment testing:

| Test | Result | Notes |
|------|--------|-------|
| Submit with WiFi OFF | ☐ Pass / ☐ Fail | Error message + retry button visible |
| Submit with slow connection (throttled) | ☐ Pass / ☐ Fail | Aborts at 30s, error shown |
| Refresh mid-survey | ☐ Pass / ☐ Fail | Returns to welcome screen gracefully |
| iPad restart | ☐ Pass / ☐ Fail | Staff knows how to restart Guided Access |
| Submit 10 rapid responses | ☐ Pass / ☐ Fail | All accepted, no duplicates |
| Wait 60 seconds idle | ☐ Pass / ☐ Fail | Auto-resets to welcome |
| Open archived survey kiosk URL | ☐ Pass / ☐ Fail | Shows "Kiosk unavailable" |
| Submit with invalid data (empty required) | ☐ Pass / ☐ Fail | Validation error shown |
| Switch language mid-survey | ☐ Pass / ☐ Fail | Language persists correctly |
| Rotate iPad orientation | ☐ Pass / ☐ Fail | Layout adapts (or gracefully clips) |

---

## 6. MONITORING FOR FAILURES

### Automated (Can be added in Phase 2)

```yaml
Uptime monitoring:
  - Use: BetterUptime, Pingdom, or UptimeRobot (free tier)
  - Check: https://feedback.yourcompany.com/api/health/live
  - Alert: Email/SMS when endpoint returns non-200

Error tracking:
  - Use: Sentry (free tier: 5k events/month)
  - Monitor: Front-end and API errors
  - Alert: Email on new errors

Database monitoring:
  - Use: Supabase built-in monitoring
  - Check: Database size, connections, query performance
  - Alert: When storage > 80% of plan limit
```

### Manual (Pilot Phase)

```yaml
Daily checks (2 minutes):
  ☐ Open kiosk URL — does it load?
  ☐ Submit one test response
  ☐ Check dashboard — does response appear?
  ☐ Check for any alerts

Weekly checks (10 minutes):
  ☐ Review all kiosk test submissions
  ☐ Check database size
  ☐ Review error logs (Vercel)
  ☐ Clean iPad screen + verify charging
```

---

**End of Failure Modes & Offline Analysis**
