# Device Management & Scaling Strategy

**Date:** July 26, 2026  
**For:** IT administrators, deployment teams, enterprise operators

---

## 1. DEVICE MANAGEMENT BY SCALE

### 1 Kiosk (Single Location)

| Aspect | Approach |
|--------|----------|
| **Kiosk mode** | Guided Access (manual, free) |
| **Setup** | 10 minutes per iPad, done once |
| **Monitoring** | Manual — staff checks daily |
| **Recovery** | Staff follows quick-reference guide |

**Cost:** 0 KWD/month for device management

### 10 Kiosks (Multi-Location Business)

| Aspect | Recommended Approach |
|--------|---------------------|
| **Kiosk mode** | Apple Configurator 2 → Single App Mode (supervised) |
| **Setup** | 30 minutes for first iPad, 5 minutes per additional |
| **Monitoring** | Manual + basic uptime monitoring |
| **Recovery** | Standardized recovery procedure |
| **Recommended MDM** | Jamf Now ($4/device/month) or Scalefusion ($3/device/month) |

**Cost:** 30-50 KWD/month for MDM

### 100 Kiosks (Enterprise / Multiple Brands)

| Aspect | Recommended Approach |
|--------|---------------------|
| **Kiosk mode** | MDM Kiosk Mode (automated, zero-touch) |
| **Setup** | DEP (Apple Device Enrollment Program) — zero-touch deployment |
| **Monitoring** | Automated — real-time device dashboard |
| **Recovery** | Remote restart, remote reset via MDM |
| **Recommended MDM** | Jamf Pro or Microsoft Intune |

**Cost:** 300-500 KWD/month for enterprise MDM

---

## 2. MDM (MOBILE DEVICE MANAGEMENT)

### Why use MDM?

Without MDM, every iPad must be configured manually. With MDM:

| Task | Manual (10 kiosks) | With MDM (10 kiosks) |
|------|-------------------|---------------------|
| Initial setup | 100 minutes | 5 minutes (push policy) |
| iOS update | 100 minutes | 0 minutes (automatic) |
| Kiosk URL change | 100 minutes | 2 minutes (push URL) |
| Troubleshoot issue | Visit location | Remote |
| Security wipe | Visit location | Remote |

### Recommended MDM Providers for Kuwait

| Provider | Cost | Best For | Notes |
|----------|------|----------|-------|
| **Jamf Now** | ~4 KWD/device/month | 3-50 devices | Apple-only, excellent kiosk mode |
| **Jamf Pro** | ~8 KWD/device/month | 50+ devices | Full enterprise features |
| **Scalefusion** | ~3 KWD/device/month | Mixed devices | Supports Android, Windows too |
| **Microsoft Intune** | Included in M365 | Already using Microsoft | Can manage alongside computers |
| **Kandji** | ~4 KWD/device/month | 10-100 devices | Modern, Apple-focused, auto-enrollment |

### What MDM configuration to push

```yaml
Kiosk configuration profile:
  - Single App Mode: Safari (com.apple.mobilesafari)
  - Auto-launch URL: https://feedback.yourcompany.com/kiosk/{slug}
  - Guided Access: ON
  - Auto-Lock: Never
  - WiFi: Pre-configured for business SSID
  - Restrictions:
    - Prevent account modification
    - Prevent app installation
    - Prevent Safari bookmark editing
    - Disable Safari developer tools
    - Force fraud warning (anti-phishing)
    - Prevent remote UI (screen sharing)
```

---

## 3. DEVICE HEALTH MONITORING

### Current State

The system currently has **no device health monitoring**. The kiosk is a passive web page — it doesn't report back its status.

### Recommended: Device Heartbeat Feature

For Phase 2, implement a heartbeat system:

```
Each kiosk:
  ─ Every 5 minutes ─→ GET /api/kiosk/heartbeat
                       Creates/updates kiosk_heartbeat record
                       
Dashboard:
  Shows:
  - Last heartbeat time
  - Online/Offline status (offline = no heartbeat in 10+ min)
  - Device name
  - iOS version
  - Current survey slug
  - Battery level
  - Storage remaining
```

### Implementation Plan

```sql
-- New table: kiosk_devices
create table public.kiosk_devices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  location_id uuid references locations(id),
  device_name text,
  device_id text unique, -- from localStorage or generated
  ios_version text,
  last_heartbeat_at timestamptz,
  battery_level integer,
  storage_free_mb integer,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- RLS: only own org
alter table public.kiosk_devices enable row level security;
```

**Estimated effort:** 2-3 days for full implementation (table, API, dashboard widget, kiosk JS)

### Without Heartbeat (Pilot Phase)

Manual checks suffice:
- Staff daily visual inspection
- Test submission at start of shift
- Manager checks dashboard for response gaps

---

## 4. LOCATION & BRANCH ARCHITECTURE

### How the system organizes your business

```
Organization (e.g., "Al Kout Food Group")
    │
    ├── Location (e.g., "Salmiya Branch")
    │       ├── Departments (e.g., Kitchen, Service, Cleaning)
    │       ├── Touchpoints (e.g., Kiosk-01, QR-Counter)
    │       ├── Surveys (e.g., "Customer Satisfaction Q3")
    │       └── Users (Location Manager, Analyst)
    │
    ├── Location (e.g., "Shuwaikh Branch")
    │       ├── Departments
    │       ├── Touchpoints
    │       ├── Surveys
    │       └── Users
    │
    └── Location (e.g., "Hawalli Branch")
            └── ...
```

### Adding a new branch
1. Go to **Settings** → **Locations** → **New location**
2. Fill in English name + Arabic name
3. Select governorate and area
4. Create a new survey for the new location (or duplicate existing)
5. Get the kiosk URL from the new survey
6. Configure the new iPad with the kiosk URL
7. Add a location manager (or assign existing)

### Moving a kiosk to a different survey
1. iPad: Exit Guided Access (triple-click, enter passcode, End)
2. Safari: Navigate to the new kiosk URL
3. Restart Guided Access
4. With MDM: Push the new URL remotely — iPad updates automatically

---

## 5. MANAGING USERS AT SCALE

### Role Permissions Matrix

| Capability | Platform Admin | Org Owner | Org Admin | Quality Mgr | Sr Mgt | Location Mgr | Analyst |
|------------|:-------------:|:---------:|:---------:|:-----------:|:------:|:------------:|:-------:|
| View all locations | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ Own only | ❌ Own only |
| Create surveys | — | ✅ | ✅ | ✅ | ✅ | Own only | ❌ |
| Manage responses | — | ✅ | ✅ | ✅ | ✅ | Own only | ❌ |
| View analytics | — | ✅ | ✅ | ✅ | ✅ | Own only | Own only |
| Manage alerts | — | ✅ | ✅ | ✅ | ✅ | Own only | ❌ |
| Corrective actions | — | ✅ | ✅ | ✅ | ✅ | Own only | ❌ |
| Manage team | — | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage settings | — | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| View reports | — | ✅ | ✅ | ✅ | ✅ | Own only | ✅ |
| Delete entities | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

### User management at 100+ users

```yaml
Recommendations:
  - Create location managers for each branch (self-service)
  - Use "Quality Manager" role for QA team members (cross-location)
  - Use "Analyst" role for HQ reporting team (read-only)
  - Avoid giving "Org Admin" to more than 2-3 people
  - Platform Admin should be 1 person (technical contact)
  - Review user list monthly for inactive accounts
```

---

## 6. KIOSK ANALYTICS (PROPOSED)

For Phase 2, add kiosk-specific analytics to the dashboard:

```yaml
Per-kiosk metrics:
  ⏱ Average completion time (seconds)
  ✅ Completion rate (% started vs % submitted)
  🔄 Reset reason (timeout vs manual)
  📱 Touch interaction count
  ❌ Abandonment point (which question they gave up on)
  🌐 Network health (response time to API)
  
Dashboard widget:
  Card showing:
  - Total kiosk submissions today
  - Active kiosks (heartbeat in last 10 min)
  - Offline kiosks
  - Average completion time
```

---

## 7. UPDATE & VERSION MANAGEMENT

### Frontend Updates

The frontend (what customers and admins see) is deployed to Vercel:

```
Update flow:
  1. Developer pushes code to GitHub
  2. Vercel auto-deploys (or manual trigger)
  3. Next.js builds new version
  4. New version goes live (~30 seconds)
  5. Users see new version on next page load
  
Impact on kiosk:
  - iPad loads new version automatically (Safari caches briefly)
  - No action needed on the iPad
  - If Safari caches an old version: close Safari, reopen
```

### Database Migrations

```
Update flow:
  1. Developer runs: npx supabase db push
  2. Migrations applied sequentially
  3. Zero-downtime (PostgreSQL handles live connections)
  
Impact on kiosk:
  - No downtime during migration
  - Old API calls still work
  - New features available immediately after migration
```

### Version Compatibility

The system uses **forward-only migrations**. All versions are compatible:
- Old frontend + new database = Works (new columns have defaults)
- New frontend + old database = Works (new features gracefully degrade)
- Safe to deploy frontend and database in any order

---

## 8. NETWORK ARCHITECTURE AT SCALE

### Single Location

```
iPad → [Business Router] → Internet → Vercel → Supabase
```

### Multiple Locations (10+)

```
Salmiya iPad → [Salmiya Router] → Internet ─┐
Shuwaikh iPad → [Shuwaikh Router] → Internet ─┤
Hawalli iPad → [Hawalli Router] → Internet ───┼──→ Vercel → Supabase
Ahmadi iPad → [Ahmadi Router] → Internet ────┘
```

No cross-location network setup needed. Each iPad just needs internet access.

### Bandwidth Per Kiosk

```
One submission: ~5 KB of data
Daily traffic (150 responses): ~750 KB
Monthly traffic: ~22 MB per kiosk

Bandwidth needed: Less than 1 Mbps per kiosk
Even on slow DSL, 10+ kiosks work fine on a single 20 Mbps connection.
```

---

## 9. RECOMMENDED FEATURES FOR PHASE 2

Based on this scaling analysis, these features add the most value per engineering effort:

### High Priority

| Feature | Effort | Value | Why |
|---------|--------|-------|-----|
| **Kiosk Heartbeat API** | 2-3 days | High | Know if kiosks are online without visiting |
| **Online/Offline indicator** | 1 day | High | Dashboard shows kiosk status |
| **Per-location kiosk count** | 0.5 day | Medium | Know how many kiosks per branch |

### Medium Priority

| Feature | Effort | Value | Why |
|---------|--------|-------|-----|
| **Kiosk analytics widget** | 2 days | Medium | Track completion rates, drop-offs |
| **Bulk survey duplication** | 1 day | Medium | Duplicate surveys across locations |
| **Bulk location creation** | 1 day | Medium | Create 10 locations at once |

### Low Priority

| Feature | Effort | Value | Why |
|---------|--------|-------|-----|
| **Remote kiosk URL push (via MDM)** | 3-5 days | Low (with MDM) | MDM already handles this |
| **Offline submission queue** | 3-5 days | Low | Kuwait internet is stable |
| **Kiosk screen capture** | 2 days | Very Low | Rarely needed for troubleshooting |

---

**End of Device Management & Scaling**
