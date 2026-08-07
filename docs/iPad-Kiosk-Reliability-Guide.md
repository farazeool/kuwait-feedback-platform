# iPad Kiosk Reliability & Recovery Guide

**For:** Installation technicians, IT support, shift managers  
**Purpose:** Ensure the kiosk stays running even after power loss, restart, or network issues

---

## 1. GUIDED ACCESS SETUP (Every iPad)

Guided Access locks the iPad to a single app. This is the **most important** configuration step.

### Step-by-Step (5 minutes)

```
Settings → Accessibility → Guided Access:
  ✅ Toggle ON
  ✅ Passcode Settings → Set Passcode → 7799
  ✅ (Store this in your password manager or safe)
  ✅ Timeout → Default (or "Never" if available)

Settings → Display & Brightness:
  ✅ Auto-Lock → Never
  ✅ Brightness → 80%

Settings → Accessibility → Display & Text Size:
  ✅ Auto-Brightness → OFF (prevents dimming in low light)
```

### Starting Kiosk Mode

```
1. Open Safari → navigate to kiosk URL
   https://feedback.yourcompany.com/kiosk/{survey-slug}

2. Wait for the welcome screen to fully load
   (You should see the logo + "Start Feedback" button)

3. Triple-click the Home button (or Side button on newer iPads)
   → Tap "Start" in the top-right corner

4. Verify: The screen should not show Safari controls
   → The kiosk is now locked
```

### Exiting Kiosk Mode

```
1. Triple-click Home/Side button
2. Enter passcode: 7799
3. Tap "End" in the top-left corner
4. You can now use Safari normally
```

---

## 2. WHAT HAPPENS AFTER RESTART (Critical Issue)

### Problem

When an iPad restarts (power outage, update, crash), **Guided Access is NOT preserved**. The iPad boots to the lock screen. After unlocking, it shows the home screen — not the kiosk.

### Step-by-Step Recovery (30 seconds)

```
iPad restarts → shows Apple logo → boots to lock screen

Step 1: Swipe up (or press Home) to unlock
        → Enter iPad passcode

Step 2: Find Safari (blue compass icon)
        → It may have the kiosk page cached!
        → Tap Safari icon

Step 3: If the kiosk page is cached → Great, it loads
        If NOT cached → Type the kiosk URL again
        (URL is in the Staff Quick Reference Card)

Step 4: Wait for welcome screen to load

Step 5: Triple-click Home/Side button → Tap "Start"
        → Kiosk mode is active again

Total time: ~30 seconds
```

### Prevention (Recommended for Production)

For a fully resilient setup, use **Apple Configurator 2** to configure the iPad:

```
What you need:
  - A Mac (any model)
  - Apple Configurator 2 (free from Mac App Store)
  - USB cable to connect iPad to Mac
  - iPad must be "supervised" (Configurator sets this up)

Setup steps:
  1. Connect iPad to Mac via USB
  2. Open Apple Configurator 2
  3. Select the iPad → Prepare → Manual Configuration
  4. Under "Supervision": check the box
  5. Under "Profiles": add a profile with:
     - Single App Mode: Safari (com.apple.mobilesafari)
     - Auto-launch URL: https://feedback.yourcompany.com/kiosk/{slug}
  6. Apply the profile

After this:
  - iPad ALWAYS boots directly into Safari at the kiosk URL
  - Even after restart, the kiosk comes back automatically
  - No staff action needed
```

Alternative (for 5+ iPads): Use MDM (Jamf, Scalefusion) to push the same configuration remotely.

---

## 3. OFFLINE / RECONNECT BEHAVIOR

### What happens when WiFi disconnects

```
Customer on welcome screen:
  → The page is loaded and cached
  → Welcome screen still shows
  → "Start Feedback" button still works
  → Survey questions still load (they were fetched earlier)

Customer fills out survey:
  → Answers are stored in memory (React state)
  → All pages work normally
  → No indication of offline status

Customer taps Submit:
  → Fetch API call tries to reach server
  → After 30 seconds: timeout (AbortController fires)
  → Error message appears:
    "Feedback could not be submitted. Please try again shortly."
  → "Try Again" button appears
  → ⚠️ Problem: The button currently sets state to "idle"
     which re-renders the form — answers are PRESERVED
     in React state. Customer can tap "Try Again" when
     WiFi returns.

IMPORTANT: Answers ARE preserved across the retry.
The form state is not lost when showing the error.

Customer taps "Try Again":
  → Submit is re-attempted
  → If WiFi is back → succeeds
  → If WiFi is still down → error again
```

### What about the 45-second idle timeout?

```
While waiting for WiFi:
  - The idle timer ticks from the LAST user interaction
  - If the customer tapped "Try Again", timer resets
  - If customer walks away after 45s idle → kiosk resets
  - The form component is DESTROYED (via surveyKey increment)
  - All unsaved answers are LOST
  - ⚠️ This is acceptable: the customer left
```

### What customers see during different scenarios

| Scenario | What customer sees | Acceptable? |
|----------|-------------------|:-----------:|
| WiFi down before survey | Welcome screen (cached) | ✅ Yes |
| WiFi down mid-survey | Survey questions (cached) | ✅ Yes |
| WiFi down on submit | Error + "Try Again" button | ✅ Yes |
| WiFi very slow | "Submitting…" spinner for up to 30s | ✅ Yes |
| WiFi returns before retry | Submit succeeds | ✅ Yes |
| Customer walks away in error | Kiosk auto-resets after 45s | ✅ Yes |

### Staff Recovery After Outage

```
WiFi outage ends:
  1. The kiosk reconnects automatically (iPad handles WiFi)
  2. No staff action needed
  3. Next customer can submit normally
  4. Test by: submit one response, check dashboard

WiFi does NOT come back:
  1. Place QR code card on the counter
  2. "Please scan with your phone to leave feedback"
  3. Customers use their mobile data
  4. Notify IT to check router
```

---

## 4. STAFF RECOVERY QUICK CARD (Print this)

```
=== KIOSK RECOVERY ===

POWER OUTAGE / RESTART:
  1. Unlock iPad (swipe + passcode)
  2. Tap Safari icon
  3. If kiosk page not showing:
     Type URL: feedback.yourcompany.com/kiosk/{slug}
  4. Wait for welcome screen
  5. Triple-click → Start

NO INTERNET:
  - Kiosk still shows welcome screen
  - Tap "Start Feedback" → survey works
  - Submit → "Try Again" if it fails
  - Use QR code cards as backup

SCREEN BLACK:
  - Tap screen once
  - Press Top button
  - Check power cable

GUIDED ACCESS LOST:
  - Triple-click → Enter 7799 → End
  - Reload kiosk URL in Safari
  - Triple-click → Start

PASSCODE (GUIDED ACCESS): 7799
IT SUPPORT: ____________________

=== RECOVERY TIME: 30 SECONDS ===
```

---

## 5. PREVENTIVE MAINTENANCE

### Daily (Staff)

```
□ Screen visible and bright
□ Power cable connected
□ Welcome screen showing
□ No error messages
```

### Weekly (Manager)

```
□ Wipe screen and enclosure
□ Test one submission
□ Check dashboard for daily responses
□ Verify charging cable is secure
```

### Monthly (IT)

```
□ Check iPadOS version → Update if major version behind
□ Check battery health (Settings → Battery → Battery Health)
□ Verify Guided Access still working (exit and re-enter)
□ Test recovery procedure (restart iPad, time recovery time)
□ Clean the enclosure's ventilation
```

---

## 6. ESCALATION PROCEDURE

```
Problem not solved by Staff Recovery Quick Card?

→ Call IT Support
  Name: ____________________
  Phone: ____________________

→ If IT cannot resolve remotely:
  iPad may need to be picked up and reconfigured
  Replacement iPad can be deployed immediately
  (Keep one configured iPad as cold spare)

→ If system-wide problem:
  Check status pages:
  - Vercel: https://www.vercel-status.com
  - Supabase: https://status.supabase.com

→ Emergency contact:
  System administrator: ____________________
```
