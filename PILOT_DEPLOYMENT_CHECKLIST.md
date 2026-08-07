# Kuwait Feedback Platform — Pilot Deployment Checklist v2

**Target:** A real Kuwait business running this system on an iPad kiosk  
**Date:** July 26, 2026  
**Audience:** Deployment technician, IT admin, business owner  

---

## BEFORE YOU START

### Required Access
- [ ] Supabase account (cloud.supabase.com) — Pro plan or higher
- [ ] Vercel account (vercel.com) — Pro plan or higher
- [ ] Domain name (e.g., feedback.yourcompany.com)
- [ ] iPad (9th gen or newer) with charging cable
- [ ] iPad security enclosure with lock
- [ ] WiFi network (business-grade, 5 Mbps+)
- [ ] QR code printer + laminator (for backup collection)

### Required Credentials
- [ ] Supabase project URL + anon key + service_role key
- [ ] SMTP credentials (Resend / SendGrid / Mailgun)
- [ ] Cloudflare Turnstile site key + secret key
- [ ] SMTP_FROM_EMAIL verified domain

---

## STEP 1 — SUPABASE PROJECT SETUP

```bash
# 1. Create a new Supabase project
#    - Region: Europe West (closest to Kuwait)
#    - Database password: save securely
#    - Plan: Pro ($25/month)

# 2. Enable required extensions
#    Go to SQL Editor and run:
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

# 3. Apply all migrations
#    From project root:
npx supabase link --project-ref <your-project-ref>
npx supabase db push

# 4. Configure Authentication
#    Go to Authentication > Settings
#    - Site URL: https://feedback.yourcompany.com
#    - Redirect URLs: https://feedback.yourcompany.com/*
#    - Enable email/password signups
#    - Disable "Confirm email" for pilot (or keep enabled for production)
#    - Min password length: 10

# 5. Create Storage bucket
#    Go to Storage > Create bucket
#    - Name: organization-branding
#    - Public: false (private with RLS)
```

### Verify Supabase Setup
```bash
# Run database tests
npm run db:verify:native
npm run db:validate:migrations
```

---

## STEP 2 — ENVIRONMENT CONFIGURATION

Create `.env.production` (never commit this):

```env
# Required — Public
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
NEXT_PUBLIC_APP_URL=https://feedback.yourcompany.com

# Required — Application environment
APP_ENV=production
SUPABASE_PROJECT_ENVIRONMENT=production
SUPABASE_PROJECT_REF=<your-project-ref>

# Required — Server keys
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
SUBMISSION_FINGERPRINT_SECRET=<64-char-random-string>

# Required — Email (production requires SMTP)
EMAIL_DELIVERY_MODE=smtp
SMTP_HOST=<smtp-host>
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USERNAME=<smtp-username>
SMTP_PASSWORD=<smtp-password>
SMTP_FROM_EMAIL=noreply@feedback.yourcompany.com
SMTP_FROM_NAME="Kuwait Feedback Platform"

# Required — Bot protection (production requires Turnstile)
BOT_PROTECTION_PROVIDER=turnstile
BOT_PROTECTION_SITE_KEY=<turnstile-site-key>
BOT_PROTECTION_SECRET_KEY=<turnstile-secret-key>
BOT_PROTECTION_EXPECTED_HOSTNAME=feedback.yourcompany.com
BOT_PROTECTION_EXPECTED_ACTION=public_survey_submission
BOT_PROTECTION_LOCAL_BYPASS=false

# Operational
LOG_LEVEL=info
DEPLOYMENT_VERSION=1.0.0
```

### Generate Random Secrets
```bash
openssl rand -hex 32  # Use output as SUBMISSION_FINGERPRINT_SECRET
```

---

## STEP 3 — VERCE L DEPLOYMENT

```bash
# 1. Install Vercel CLI & login
npm i -g vercel
vercel login

# 2. Link project
vercel link

# 3. Set all environment variables
#    Option A: Vercel Dashboard UI
#    Go to Project > Settings > Environment Variables
#    Add each env var from .env.production

#    Option B: Vercel CLI
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
# ... repeat for all env vars

# 4. Deploy to production
vercel --prod

# 5. Configure domain
vercel domains add feedback.yourcompany.com
# Update DNS records at your domain registrar:
# - Add CNAME record: feedback.yourcompany.com → cname.vercel-dns.com

# 6. Verify deployment
curl -I https://feedback.yourcompany.com
# Expected: 200 OK with strict-transport-security header
```

### Verify HTTPS
```bash
# Test security headers
curl -sI https://feedback.yourcompany.com | grep -i strict-transport-security
curl -sI https://feedback.yourcompany.com | grep -i content-security-policy
```

---

## STEP 4 — SYSTEM CONFIGURATION (IN-BROWSER)

1. **Open** `https://feedback.yourcompany.com/onboarding`
2. **Create your organization** — Fill in:
   - English name
   - Arabic name
   - Slug (e.g., "al-kout-food")
3. **Create at least one location** — Fill in:
   - English name + Arabic name
   - Governorate (e.g., Hawalli, Farwaniya)
   - Area (e.g., Salmiya, Shuwaikh)
4. **Create a survey:**
   - Title in English + Arabic
   - Add 3-5 questions (mix of rating + optional text)
   - Set as "active" (published)
5. **Get your kiosk URL:**
   - Navigate to the survey detail page
   - Look for "Kiosk link" or copy `/kiosk/{public-slug}`
   - Full URL: `https://feedback.yourcompany.com/kiosk/{public-slug}`

### Protect Your Data
```bash
# After creating admin account, IMMEDIATELY:
# 1. Go to dashboard > Team
# 2. Verify only YOU are listed as admin
# 3. Add your backup email as co-admin
```

---

## STEP 5 — DATABASE BACKUP CONFIGURATION

Supabase Pro plan includes:
- Daily automatic backups (retained 7 days)
- Point-in-time recovery (retained 7 days)

### Manual Backup Verification
```sql
-- Run this weekly to verify data integrity:
SELECT count(*) as total_organizations FROM organizations;
SELECT count(*) as total_locations FROM locations;
SELECT count(*) as total_surveys FROM surveys;
SELECT count(*) as total_responses FROM survey_responses;
SELECT count(*) as total_alerts FROM alerts;
```

### Additional Backup Strategy
```bash
# Weekly: export critical tables as CSV
# Run this from a trusted machine:
PGPASSWORD=<db-password> psql -h <db-host> -U postgres -d postgres \
  -c "\copy (SELECT id, name_en, name_ar, created_at FROM organizations) TO 'orgs-backup-$(date +%Y-%m-%d).csv' CSV HEADER"
```

---

## STEP 6 — IPAD KIOSK SETUP (10 MINUTES)

### Hardware Assembly
1. Charge iPad to 100%
2. Install the security enclosure
3. Run charging cable through enclosure cable channel
4. Mount enclosure at counter/wall (eye level is ideal)
5. Connect power cable to outlet
6. Verify iPad fits securely and cannot be removed

### iPad Configuration
```yaml
Step 1: Initial Setup
  - Turn on iPad
  - Connect to business WiFi
  - Update to latest iPadOS
  - Sign in with business Apple ID

Step 2: Guided Access
  Settings → Accessibility → Guided Access:
    - Toggle ON
    - Passcode Settings → Set Passcode → "7799"
    - (Write this down and store safely)
    - Timeout → "Never" or longest
  
  Settings → Display & Brightness:
    - Auto-Lock → "Never"
    - Brightness → 80% (bright enough for kiosk)

Step 3: Open Kiosk Mode
  - Open Safari
  - Navigate to: https://feedback.yourcompany.com/kiosk/{slug}
  - Wait for welcome screen to load fully (verify both EN/AR work)
  - Triple-click Home button (or Side button on newer iPads)
  - Tap "Start" in top-right corner

Step 4: Verify
  - Walk through full customer flow
  - Check thank-you screen appears
  - Verify auto-reset after 5 seconds
```

### iPad Troubleshooting
```
Problem: Screen is black
  → Tap screen once
  → Check power cable is connected
  → Press Top button briefly
  
Problem: Survey page not showing
  → Triple-click Home/Side button
  → Enter passcode "7799"
  → Tap "End" in top-left
  → Reload Safari → kiosk URL
  → Restart Guided Access

Problem: No internet
  → Check WiFi symbol in corner
  → If missing, restart iPad
  → If persists, check business router

Problem: Touch not responding
  → Wipe screen with soft cloth
  → Grease/fingerprints block touch
  → If still not responding, restart iPad
```

---

## STEP 7 — BUSINESS NETWORK SETUP

### WiFi Requirements
```
Speed:  5 Mbps minimum (10+ Mbps recommended)
Secure: WPA2 or WPA3 (not open wifi)
Stable: Business-grade router (not consumer)
SSID:   Visible and known to staff
```

### Firewall Configuration
```yaml
Outbound Rules (iPad → Internet):
  Allow: *.supabase.co (port 443)
  Allow: vercel.com (port 443)
  Allow: *.turnstile.cloudflare.com (port 443)
  Block: All other outbound (optional, for security)

Inbound Rules:
  None required (iPad only connects outbound)
```

### Bandwidth Testing
```bash
# From the iPad or a laptop on the same network:
# Visit: https://www.speedtest.net
# Requirements:
#   Download: 5+ Mbps
#   Upload:   2+ Mbps
#   Latency:  <100ms to Europe
```

---

## STEP 8 — GO-LIVE VERIFICATION

### Full System Test
```
☐ 1. Open kiosk URL on iPad
☐ 2. Welcome screen appears with logo
☐ 3. Language toggle works (EN/AR)
☐ 4. "Start Feedback" button works
☐ 5. Survey questions render correctly
☐ 6. Touch/rating selection works
☐ 7. Text input works (keyboard appears)
☐ 8. Submit button works
☐ 9. Thank-you screen appears
☐ 10. Auto-reset works (5 seconds)
☐ 11. Submitted response appears in dashboard
```

### Stress Test
```
☐ 1. Submit 10 responses rapidly
☐ 2. All 10 appear in dashboard
☐ 3. No error messages shown
☐ 4. No duplicate entries (check IDs)
```

### Admin Verification
```
☐ 1. Login at https://feedback.yourcompany.com
☐ 2. Dashboard loads with analytics
☐ 3. Can see the new responses
☐ 4. Average rating displays correctly
☐ 5. Test CSV export works
☐ 6. Team member can login with different role
☐ 7. Location manager sees only their location
```

---

## STEP 9 — GO-LIVE DAY SCHEDULE

```yaml
Morning (8:00 AM):
  - Final hardware check
  - Verify iPad is charging
  - Test submission from kiosk
  
Mid-day (12:00 PM):
  - Check dashboard for responses
  - Verify no error alerts
  - Staff check-in
  
Evening (6:00 PM):
  - Review all daily responses
  - Acknowledge any alerts
  - Verify system still running
  - Clean iPad screen
```

---

## STEP 10 — POST-GO-LIVE MONITORING

### First 24 Hours
```
☐ Hour 1: Verify first customer can submit
☐ Hour 4: Check response volume
☐ Hour 8: No error pages reported
☐ Hour 12: Kiosk still running
☐ Hour 24: Review full day of data
```

### First Week
```
☐ Monday: Deploy + verify
☐ Tuesday: Check database size
☐ Wednesday: Review alert configurations
☐ Thursday: Staff feedback session
☐ Friday: (Closed) — verify kiosk shut down gracefully
```

### First Month
```
☐ Backup verified
☐ No unexpected errors
☐ Staff trained on all flows
☐ Analytics reviewed
☐ Scaling plan evaluated
```

---

## EMERGENCY CONTACTS

```yaml
First line support:
  Business IT admin: ____________________
  Phone: ____________________

Second line:
  System administrator: ____________________
  Phone: ____________________

Escalation:
  Vercel support: https://vercel.com/support
  Supabase support: https://supabase.com/support
```

---

## ROLLBACK PLAN

### If deployment fails (P0 issues):
```bash
# 1. Vercel instant rollback
vercel rollback

# 2. If database migration caused issue:
npx supabase db restore --project-ref <ref>

# 3. If all else fails:
#    - Keep existing kiosk running (it uses the OLD frontend)
#    - Responses will queue and sync (if offline mode active)
#    - Revert DNS to old host
```

### If kiosk malfunctions:
```yaml
# Immediate:
- Display QR code card at counter
- "Scan to leave feedback" with your phone
- QR code redirects to same survey (works on mobile data)
- No customer data lost (direct to Supabase)

# Resolution:
- Troubleshoot iPad (see Step 6)
- If iPad is physically damaged:
  1. Remove from enclosure
  2. Replace with backup iPad
  3. Reconfigure Guided Access
  4. Return to service in <30 minutes
```

---

## FINAL SIGN-OFF

```yaml
Date of deployment: _______________
Deployed by: ______________________
Business location: ________________
Kiosk URL: ________________________

Verification:
  ☐ Production environment set up
  ☐ Domain configured and HTTPS active
  ☐ Database migrations applied
  ☐ Environment variables set
  ☐ iPad kiosk operational
  ☐ Test submission successful
  ☐ Dashboard accessible by admin
  ☐ All staff trained
  ☐ Emergency contacts established
  ☐ Rollback plan documented

Signed: __________________________
```

---

## QUICK REFERENCE CARD

### Kiosk Start/Stop
```
START KIOSK:
1. Open Safari → kiosk URL
2. Triple-click Home/Side button
3. Tap "Start"

STOP KIOSK:
1. Triple-click Home/Side button
2. Enter passcode: 7799
3. Tap "End"

EXIT TO SAFARI:
1. End Guided Access
2. Touch outside address bar
3. Enter new URL or navigate

FULLSCREEN:
- System usually requests it automatically
- If not, tap the screen to trigger
```

### Daily Health Check
```
☐ 1. Screen is ON and bright
☐ 2. Survey welcome screen showing
☐ 3. Power cable connected
☐ 4. No error messages visible
☐ 5. One test tap registers response
```

---

**End of Pilot Deployment Checklist**
