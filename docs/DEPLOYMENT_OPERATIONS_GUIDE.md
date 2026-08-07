# Complete Real-World Deployment, Integration & Operations Guide

## From Source Code to Working Business System

---

**Version:** 1.0.0-beta.1  
**Date:** July 2026  
**Audience:** Business owners, IT administrators, installation technicians, employees

---

# Table of Contents

1. [From Development Project to Live Business System](#1-from-development-project-to-live-business-system)
2. [iPad Kiosk Implementation](#2-ipad-kiosk-implementation)
3. [Kiosk Mode Configuration](#3-kiosk-mode-configuration)
4. [Network Architecture](#4-network-architecture)
5. [Business Hardware Integration](#5-business-hardware-integration)
6. [Installation Checklist](#6-installation-checklist)
7. [Staff Training Guide](#7-staff-training-guide)
8. [Customer Experience Flow](#8-customer-experience-flow)
9. [Maintenance Plan](#9-maintenance-plan)
10. [Scaling to Multiple Locations](#10-scaling-to-multiple-locations)
11. [Cost Breakdown](#11-cost-breakdown)

---

# 1. From Development Project to Live Business System

## The Big Picture

Right now, you have **source code** — a set of instructions that tell a computer how to run the feedback platform. But source code on a laptop is not a working system. To make it available to real customers in real businesses, you need to:

1. **Host the application** somewhere accessible 24/7
2. **Host the database** somewhere that stores data reliably
3. **Configure everything** so they talk to each other
4. **Set up hardware** (iPads, kiosks) that customers interact with

Let's walk through each step.

---

## Step 1: Where Does the Application Live?

The application (the website that customers and managers see) must run on a **server** — a computer that stays on 24/7 and is connected to the internet.

### Option A: Cloud Hosting (Recommended)

The application runs on servers owned by a hosting company like Vercel, Netlify, Fly.io, or AWS.

| Pros | Cons |
|------|------|
| No hardware to buy or maintain | Monthly cost (varies by usage) |
| Automatic scaling when traffic grows | Requires internet setup |
| Built-in backups and security | Less direct control |
| Automatic SSL/HTTPS certificates | |
| One-click rollback to previous versions | |

**Monthly cost estimate:** $20–100/month depending on traffic

**Best for:** Most businesses — especially those just starting out.

### Option B: Virtual Private Server (VPS)

You rent a virtual computer from a provider like DigitalOcean, Linode, or Hetzner. You have full control but must manage everything yourself.

| Pros | Cons |
|------|------|
| Full control over configuration | Must manage security updates yourself |
| Predictable monthly cost | Must handle backups yourself |
| Can run other services alongside | Requires more technical skill |

**Monthly cost estimate:** $10–50/month

**Best for:** Businesses with an IT team.

### Option C: On-Premises Server (Not Recommended)

You buy a physical server and install it at your business location.

| Pros | Cons |
|------|------|
| Data never leaves your building | You buy and maintain hardware |
| No monthly hosting fee | You handle power, cooling, security |
| Full control | If power goes out, system goes down |
| | Must manage your own backups |

**Cost estimate:** 500–2,000 KWD upfront + maintenance

**Best for:** Very large enterprises with strict data requirements.

### What the Kuwait Feedback Platform uses

For the **frontend** (the website), we recommend **Vercel** — it's free for small usage and the platform was built for it. For the **backend database**, we use **Supabase** which includes both hosting and database.

**In short:** The application lives in the cloud. Your iPads connect to it over the internet.

---

## Step 2: How Is the Database Hosted?

Customer feedback data is stored in a **PostgreSQL database** — a type of database that organizes information into tables (like a spreadsheet with many sheets).

### Hosting Options

**Supabase Cloud (Recommended)**
- The database lives on Supabase's servers
- Automatically backed up every day
- Point-in-time recovery available (paid plans)
- All connections are encrypted
- You don't need to manage the database server

**Monthly cost:** Free tier (500 MB data) → $25/month (8 GB data) → Custom for enterprise

### Where exactly is the data stored?

If you use Supabase, your data is stored on **AWS servers** in the region you choose. For Kuwait businesses, we recommend the **Europe** or **Middle East** region for lowest latency.

### What data is stored?

| Data Type | Where | How Long |
|-----------|-------|----------|
| Customer feedback | Database | Indefinitely (until you delete it) |
| Survey questions | Database | Indefinitely |
| User accounts | Database (auth.users) | Until account is deleted |
| Organization settings | Database | Until organization is deleted |
| Logos and images | Storage bucket | Until deleted |
| Audit logs | Database | Indefinitely |

---

## Step 3: How Does the iPad Access the Application?

The iPad does NOT store the application. It acts like a **window** into the application that lives in the cloud.

### How it works:

```
iPad (kiosk mode)
    ↓ opens web browser
    ↓ loads https://feedback.yourcompany.com/kiosk/salmiya-survey
    ↓ page is served FROM the cloud server
    ↓ customer taps answers ON the iPad
    ↓ data is sent TO the cloud server
    ↓ stored IN the database
    ↓ manager sees it ON their computer
```

### Why this matters:

- If the iPad breaks, feedback data is **NOT lost** — it's safe in the cloud
- If you replace the iPad, just open the same URL on the new one
- Updates to the survey or branding happen instantly — no need to update each iPad
- Anyone with the URL and a browser can access the survey (phone, tablet, computer)

---

# 2. iPad Kiosk Implementation

## Hardware Requirements

### Essential Items

| Item | Purpose | Estimated Cost (KWD) |
|------|---------|---------------------|
| **iPad (9th gen or newer)** | Runs the kiosk display | 100–200 KWD |
| **iPad stand/enclosure** | Protects iPad from theft/damage | 20–60 KWD |
| **Power cable + extension** | Keeps iPad charged 24/7 | 5–10 KWD |
| **WiFi connection** | Connects to the internet | Included in business internet |

### Recommended Setup: Secure Enclosure

For a business environment, you need a **security enclosure** — a lockable box that holds the iPad. This prevents:
- Theft of the iPad
- Customers pressing physical buttons
- Damage from drops or spills
- Access to cables

**Recommended types:**
- **Counter-top stand with lock:** For counters (like at a cash register)
- **Wall-mount enclosure:** For walls or pillars near the exit
- **Table stand with tamper-proof screws:** For tables or podiums

---

## Step-by-Step iPad Setup

### Step 1: Prepare the iPad

1. Unbox the iPad and charge it to 100%
2. Turn it on and connect to your business WiFi network
3. Sign in with an Apple ID (needed for initial setup — can be a dedicated business Apple ID)
4. Update to the latest iPadOS version

### Step 2: Install a Kiosk Browser App

The iPad's built-in Safari browser can be locked down, but a dedicated kiosk app is easier to manage.

**Free option:** Use Safari with Guided Access (explained in Section 3)

**Paid option (recommended for businesses):** 
- **Moki (formerly MokiTouch):** Enterprise kiosk management — 3–5 KWD/month per device
- **Kiosk Pro:** Single kiosk management — 20 KWD one-time
- **Scalefusion:** Multi-device management — 5 KWD/month per device

### Step 3: Configure the Kiosk

If using **Safari + Guided Access** (free method):

1. Open the **Settings** app on the iPad
2. Go to **Accessibility** → **Guided Access**
3. Turn **Guided Access** ON
4. Tap **Passcode Settings** → **Set Guided Access Passcode** (choose a 4-digit code that employees know)
5. Go back to **Settings** → **Accessibility** → **Guided Access** → **Display Auto-Lock** (set to "Never" or longest period)
6. Open **Safari** and navigate to: `https://feedback.yourcompany.com/kiosk/salmiya-survey`
7. Triple-click the **Home button** (or **Side button** on newer iPads) to start Guided Access
8. Tap **Start** in the top-right corner

The iPad is now locked into the feedback survey. Customers cannot:
- Close Safari
- Open other apps
- Access settings
- Navigate to other websites

### Step 4: Place the iPad in the Enclosure

1. Place the iPad (with its case, if any) into the enclosure
2. Connect the charging cable
3. Lock the enclosure with the key
4. Mount or place the enclosure in a visible, accessible location

### Step 5: Test the Setup

1. Walk up to the kiosk as if you're a customer
2. The survey page should be visible
3. Tap through the entire survey flow (rate → submit → thank you)
4. Check the admin dashboard to confirm the response was recorded
5. Verify the kiosk resets automatically for the next customer

---

## Maintaining the iPad Kiosk

### Daily Checks

- Is the iPad still on? (Screen should be lit)
- Is the survey page still showing? (Not a blank screen or error)
- Is the charging cable still connected?
- Is the screen clean and readable?

### Weekly Checks

- Check that new responses are appearing on the dashboard
- Clean the screen and enclosure
- Verify the kiosk resets properly after a test submission

### Software Updates

When the feedback platform is updated (new features, bug fixes):
- **No action needed on the iPad** — the kiosk page loads from the server
- The iPad automatically shows the updated version

When iPadOS updates are available:
- Take the iPad out of the enclosure
- Exit Guided Access (triple-click, enter passcode, tap End)
- Install the iPadOS update
- Re-enable Guided Access
- Return the iPad to the enclosure

---

# 3. Kiosk Mode Configuration

## Apple's Guided Access (Free, Built-in)

Guided Access is a feature built into every iPad. It locks the device to a single app and prevents the user from leaving it.

### What Guided Access prevents:

| Customer Action | Prevented? |
|----------------|:----------:|
| Closing the browser | ✅ |
| Opening other apps | ✅ |
| Accessing Settings | ✅ |
| Changing WiFi | ✅ |
| Using the Home button | ✅ |
| Using the volume buttons | ✅ |
| Touching areas of the screen you've blocked off | ✅ |

### What Guided Access does NOT prevent:

| Customer Action | Prevented? | Solution |
|----------------|:----------:|----------|
| Force-restarting the iPad (holding Power + Home) | ❌ | The iPad will restart to the lock screen, not to your app | 
| Physically damaging the iPad | ❌ | Use a secure enclosure |
| Disconnecting the power cable | ❌ | Use a lockable enclosure |

### Setting up Guided Access — Detailed Steps

1. **Open Settings** on the iPad
2. Go to **Accessibility** → **Guided Access**
3. Toggle **Guided Access** ON
4. Tap **Passcode Settings** → **Set Guided Access Passcode**
5. Enter a 4-digit passcode (write this down — you'll need it to exit kiosk mode)
6. Toggle **Display Auto-Lock** — this is important! Set it to **Never** so the screen stays on
7. Go to **Settings** → **Display & Brightness** → **Auto-Lock** → Set to **Never**

**To start kiosk mode:**
1. Open Safari and navigate to your kiosk URL
2. Triple-click the **Home button** (iPad with Home button) or the **Side button** (iPad without Home button)
3. Tap **Start** in the top-right corner
4. The iPad is now locked to this page

**To exit kiosk mode:**
1. Triple-click the Home/Side button
2. Enter your Guided Access passcode
3. Tap **End** in the top-left corner

### Advanced: Disabling Touch Areas

You can prevent customers from tapping certain parts of the screen:
1. Start Guided Access
2. Before tapping Start, draw circles around areas to disable
3. Use this to prevent accidental taps on the URL bar or browser controls

---

## MDM (Mobile Device Management) — For Multiple Locations

If you have more than one iPad, managing them individually becomes time-consuming. **MDM** lets you manage all devices from one central console.

### What MDM provides:

- **Remote configuration:** Set up all iPads at once
- **App management:** Install/update apps remotely
- **Security policies:** Enforce passcodes, encryption, and restrictions
- **Remote lock/wipe:** If an iPad is stolen, you can lock or erase it
- **Kiosk mode (Single App Mode):** Lock iPad to one app without manual Guided Access setup

### Recommended MDM Providers

| Provider | Cost | Best For |
|----------|------|----------|
| **Jamf Now** | 4 KWD/month per device | 3–100 devices, Apple-focused |
| **Scalefusion** | 3 KWD/month per device | Mixed devices (iPads + Android) |
| **Microsoft Intune** | Included with Microsoft 365 | Organizations already using Microsoft |
| **Apple Business Essentials** | 4 KWD/month per user | Small businesses with Apple focus |

---

## Kiosk Mode Comparison

| Feature | Guided Access (Free) | Kiosk Browser App | Full MDM |
|---------|:-------------------:|:-----------------:|:--------:|
| Cost | Free | 10-50 KWD one-time | 3-5 KWD/month per device |
| Setup time | 5 minutes per iPad | 10 minutes per iPad | 1 hour initial + 5 min per iPad |
| Prevents app switching | ✅ | ✅ | ✅ |
| Hides browser controls | ❌ (can block touch) | ✅ | ✅ |
| Auto-reset after submit | ✅ (built into app) | ✅ | ✅ |
| Remote monitoring | ❌ | ❌ | ✅ |
| Multi-device management | ❌ (manual) | ⚠️ (some support) | ✅ |
| Remote lock/wipe | ❌ | ❌ | ✅ |
| Recommended for | Single iPad, testing | 1-5 kiosks | 5+ kiosks or enterprise |

---

# 4. Network Architecture

## Simple Data Flow Diagram

```
CUSTOMER                       INTERNET                        CLOUD
   │                               │                              │
   ▼                               ▼                              ▼
┌──────────┐               ┌──────────────┐              ┌───────────────┐
│ iPad       │─── WiFi ───▶│  Your Router  │───Internet──▶│  Vercel (App)  │
│ (Kiosk)   │               │  (Business)  │              │  Frontend      │
└──────────┘               └──────────────┘              └───────┬───────┘
                                                                  │
                                                                  ▼
┌──────────┐               ┌──────────────┐              ┌───────────────┐
│ Manager's │─── WiFi ───▶│  Your Router  │───Internet──▶│  Supabase     │
│ PC/Laptop│               │  (Business)  │              │  (Database)   │
└──────────┘               └──────────────┘              └───────┬───────┘
                                                                  │
                                                                  ▼
┌──────────┐               ┌──────────────┐              ┌───────────────┐
│ Admin's  │─── WiFi ───▶│  Internet     │───Internet──▶│  File Storage │
│ Phone    │               │  (Cellular)  │              │  (Logos, etc) │
└──────────┘               └──────────────┘              └───────────────┘
```

---

## What Happens When a Customer Submits Feedback?

Let's trace the exact path of a single feedback submission:

### Step 1: Customer Taps "Submit"

The customer has just answered the survey questions on the iPad and tapped the Submit button.

### Step 2: iPad Sends Data (0.1–1 second)

The iPad's web browser takes the customer's answers and packages them as a **secure HTTPS request** — like putting a letter in an envelope, addressing it, and sealing it.

The envelope contains:
- The survey answers
- A unique idempotency key (prevents duplicate submissions)
- The survey identifier
- The browser fingerprint

### Step 3: Data Travels to the Server (0.2–1 second)

The request travels over your business WiFi → your router → your internet connection → the public internet → the hosting provider's servers (Vercel).

This is like the envelope going through the postal system — it passes through multiple sorting points but the contents remain sealed (encrypted).

### Step 4: Server Validates the Data (0.05–0.2 second)

The server checks:
- Is the survey still active? (Not archived)
- Are all required questions answered? (Validation)
- Is this a duplicate submission? (Idempotency check)
- Is the rate limit exceeded? (Too many submissions from this device)

If any check fails, the server returns an error message to the iPad.

### Step 5: Server Stores the Data (0.05–0.2 second)

If validation passes, the server writes the data to the Supabase database:
- A new row is inserted in `survey_responses`
- New rows are inserted in `survey_answers` (one per question)
- If there were multiple-choice selections, rows are added to `survey_answer_choices`

### Step 6: Server Checks for Alerts (0.05 second)

The database checks: "Is this rating below the threshold?" If yes, it creates an alert automatically using database trigger functions.

### Step 7: Server Returns "Thank You" (0.1 second)

The server sends back a success response. The iPad displays a **thank-you message**.

### Step 8: Kiosk Resets (3–5 seconds later)

After a few seconds, the kiosk automatically returns to the starting screen, ready for the next customer.

### Step 9: Manager Sees the Response

The next time the manager logs into the dashboard and refreshes, the new response is visible. If an alert was triggered, it appears in the Alerts section.

---

## Total Time: 1–3 seconds

From the moment the customer taps Submit to the moment they see "Thank You" — all 9 steps above complete in **1 to 3 seconds** on a typical internet connection.

---

# 5. Business Hardware Integration

## Hardware A: iPad Kiosk

| Item | Detail |
|------|--------|
| **Purpose** | Allow customers to submit feedback at the business location |
| **Connection** | WiFi → Internet → Cloud |
| **Power** | Connected to wall outlet 24/7 (within enclosure) |
| **Setup** | 1. Unbox iPad 2. Connect to WiFi 3. Open kiosk URL 4. Enable Guided Access 5. Place in enclosure |
| **Daily check** | Is screen on? Is survey visible? Is cable connected? |
| **If it breaks** | Customer uses their own phone QR code instead. Replace the iPad when possible. Data is NOT lost — it's in the cloud. |
| **Troubleshoot** | "Screen is black" → Check power. Check auto-lock setting. Restart. |

## Hardware B: Router / Business WiFi

| Item | Detail |
|------|--------|
| **Purpose** | Connect all devices to the internet |
| **Connection** | ISP → Router → WiFi → iPads/computers |
| **Setup** | Standard business router setup. Ensure WiFi password is known by employees. |
| **Daily check** | Are devices connected to WiFi? |
| **If it fails** | No customer feedback can be submitted. No dashboard access. Staff should take notes manually. |
| **Troubleshoot** | Restart the router. Check ISP status. Call internet provider. |

## Hardware C: Manager's Workstation (PC/Laptop)

| Item | Detail |
|------|--------|
| **Purpose** | View feedback dashboard, manage surveys, respond to alerts |
| **Connection** | WiFi or Ethernet → Internet → Cloud |
| **Requirements** | Web browser (Chrome/Safari/Edge), internet connection |
| **Setup** | Log into the website. Bookmark the dashboard URL. |
| **Daily check** | Log in, check new responses and alerts |
| **If it breaks** | Use another computer or a phone browser. All data is in the cloud. |

## Hardware D: TV Dashboard Display (Optional)

| Item | Detail |
|------|--------|
| **Purpose** | Display real-time satisfaction data on a TV in the staff area |
| **Connection** | Connect a small computer (Raspberry Pi, Chromebox, or Fire TV Stick) to the TV → Internet → Cloud |
| **Setup** | 1. Connect a device to the TV's HDMI port 2. Open the dashboard URL 3. Set to full screen 4. Auto-refresh every 60 seconds |
| **Daily check** | Is the TV on? Is the dashboard visible? |
| **If it breaks** | Open the dashboard on any computer instead |

## Hardware E: Printer (Optional — for QR Code Cards)

| Item | Detail |
|------|--------|
| **Purpose** | Print QR code cards for tables, counters, and walls |
| **Connection** | USB or WiFi to computer |
| **Usage** | Download QR code from the platform → Print on card stock → Laminate → Place at location |
| **Recommendation** | Use a color printer. Print on thick paper (200+ gsm). Laminate for durability. |

---

# 6. Installation Checklist

## Pre-Installation (1–2 weeks before)

- [ ] **Select hosting provider** (Vercel for frontend + Supabase for database)
- [ ] **Create accounts** with hosting providers
- [ ] **Register domain name** (e.g., feedback.yourcompany.com)
- [ ] **Configure DNS** to point domain to hosting provider
- [ ] **Purchase iPad(s)** and enclosures
- [ ] **Ensure business internet** is installed and reliable
- [ ] **Test WiFi coverage** at kiosk location(s)
- [ ] **Create admin accounts** in the system
- [ ] **Configure survey questions** (bilingual — English + Arabic)
- [ ] **Generate QR codes** and have them printed professionally
- [ ] **Order lamination** for QR code cards (if not using iPad kiosks)

## Installation Day

### Cloud Setup

- [ ] **Deploy frontend** to Vercel (or chosen provider)
- [ ] **Apply database migrations** to Supabase
- [ ] **Configure environment variables** (API keys, URLs, secrets)
- [ ] **Verify domain** resolves correctly
- [ ] **Test HTTPS** (green padlock in browser)
- [ ] **Create organization** in the platform
- [ ] **Set up locations** in the platform
- [ ] **Create and publish** the first survey
- [ ] **Invite team members** (admin, managers)
- [ ] **Test submission** through public URL

### Kiosk Setup (per kiosk)

- [ ] **Unbox iPad** and charge to 100%
- [ ] **Connect to WiFi** (test speed — at least 5 Mbps)
- [ ] **Update iPadOS** to latest version
- [ ] **Open kiosk URL** in Safari: `https://feedback.yourcompany.com/kiosk/[survey-slug]`
- [ ] **Configure Guided Access** (set passcode, disable auto-lock)
- [ ] **Start Guided Access** (lock into survey page)
- [ ] **Test full submission flow** (rate → submit → thank you → auto-reset)
- [ ] **Place iPad in enclosure** and lock
- [ ] **Mount/position enclosure** at kiosk location
- [ ] **Connect power** to enclosure
- [ ] **Final test** — walk up as a customer and submit

### Manager Setup

- [ ] **Train manager** on logging in
- [ ] **Show manager** the dashboard, responses, and alerts
- [ ] **Verify manager can see** their location's data only
- [ ] **Test alert workflow** (submit low rating → alert appears → acknowledge → resolve)

## Post-Installation (Week 1)

- [ ] **Monitor daily** — are responses coming in?
- [ ] **Check for errors** in server logs
- [ ] **Verify backup** is running (Supabase does this automatically)
- [ ] **Adjust survey** if questions are confusing customers
- [ ] **Train employees** on assisting customers with the kiosk
- [ ] **Create a support contact** for when issues arise

---

# 7. Staff Training Guide

## A Simple Guide for Employees

### Your Role with the Feedback System

As an employee, your main job with the feedback system is:
1. **Keep the kiosk working** — make sure customers can use it
2. **Help customers** who are confused by the kiosk
3. **Keep an eye on feedback** — especially negative comments

---

### Starting Your Shift

```
□ 1. Walk past the kiosk
     Is the screen on? Is the survey showing?
     If yes, it's working. ✅
     If no → see "What to do if..." below.

□ 2. Log into the dashboard (managers only)
     Open Chrome/Safari on the office computer
     Go to: https://feedback.yourcompany.com
     Enter your email and password

□ 3. Check for new responses
     Look at the dashboard — any new responses since yesterday?
     Any alerts (red badges)?

□ 4. Mention the kiosk to customers
     "If you'd like to tell us about your visit, 
      please tap your rating on the screen by the exit."
```

---

### During Your Shift

- If a customer looks confused near the kiosk, offer help
- If the screen goes dark, tap it once
- If the screen is off completely, check the power cable
- Report any issues to your manager

---

### Ending Your Shift

- Take note of any issues with the kiosk
- If asked, tell the next shift what feedback came in

---

### What to Do If...

#### The iPad screen is black

1. Tap the screen gently
2. If it doesn't turn on, check if the power cable is connected
3. If it's connected but still off, press the **Top button** once
4. If still off, press and hold the **Top button** until the Apple logo appears
5. Wait 1 minute for it to restart
6. If it comes back, it should automatically show the survey again
7. If not, call the manager

#### The survey page is not showing (error screen, blank page, or Safari not running)

1. Triple-click the **Home/Side button**
2. Enter the passcode (ask your manager if you don't know it)
3. Tap **End** in the top-left
4. Open **Safari**
5. Type the kiosk URL or ask the manager for the link
6. Triple-click the Home/Side button → tap **Start**
7. Tell the manager what happened

#### The internet stops working

1. All kiosk submissions will fail
2. Place a sign on the kiosk saying "Feedback unavailable — scan this QR code on your phone"
3. Show the QR code card to customers (the one on the table or counter)
4. Ask customers to scan it with their personal phone (works on mobile data)
5. Notify the manager to check the internet router

#### A customer submitted feedback but you want to flag it to your manager

- Tell your manager directly
- The manager can find the specific response in the Responses section
- No need to write anything down — it's already in the system

#### A customer is having trouble with the kiosk

1. Walk over and ask if they need help
2. Show them: "Just tap the stars to rate, then tap Submit"
3. If they're Arabic-speaking, show them how to switch to Arabic (usually a button at the top)
4. If the screen is not responding, try wiping it clean (grease can block touch)
5. If the customer prefers, hand them a QR code card so they can use their own phone

---

# 8. Customer Experience Flow

## What the Customer Sees and Experiences

Let's walk through a customer's complete journey from entering the business to submitting feedback.

### Step 1: Customer Enters the Business

The customer walks in. They may or may not notice the kiosk. They have their meal/interaction.

**The kiosk's job:** Be visible but not intrusive. A clean, well-lit iPad in a nice enclosure near the exit.

### Step 2: Customer Notices the Kiosk

As the customer is leaving, they see the iPad with an inviting screen. The screen shows:

- **Your logo** at the top (brand recognition)
- **A friendly message** like "How was your experience?"
- **The location name** (so they know they're rating the right place)

**Why this screen exists:** The first impression matters. A branded, welcoming screen makes customers more likely to participate.

### Step 3: Customer Selects a Rating

The customer sees large, touchable buttons:
- ⭐⭐⭐⭐⭐ (5 stars = Excellent)
- ⭐⭐⭐⭐ (4 stars = Good)
- ⭐⭐⭐ (3 stars = Average)
- ⭐⭐ (2 stars = Poor)
- ⭐ (1 star = Very Poor)

**Why tap targets are large:** The kiosk is designed for quick interaction. Large buttons work even if the customer is in a hurry, has poor eyesight, or has shaky hands.

### Step 4: (Optional) Customer Selects What They Liked

If the rating was positive (4 or 5 stars), they might see a follow-up question:
- "What did you enjoy most?"
- Options: Friendly staff, Food quality, Cleanliness, Speed of service, Atmosphere

This helps the business know what they're doing well.

If the rating was low (1-3 stars), they might see:
- "What went wrong?"
- "Any suggestions for improvement?"

### Step 5: Customer Sees "Thank You"

After submitting, the screen shows:
- ✅ A checkmark or smile
- "Thank you for your feedback!"
- (Optional) "Show this screen to receive a discount on your next visit"

**Why this screen exists:** The customer should feel heard. A thank-you message completes the positive experience and makes them more likely to give feedback again in the future.

### Step 6: Kiosk Resets Automatically

After 3-5 seconds, the screen returns to Step 1, ready for the next customer. The iPad doesn't need anyone to press a button.

### What the Customer DOESN'T See

Behind the scenes, in the 2 seconds between submitting and seeing "Thank You":
- The system validates the data
- The database stores the response
- The alert system checks the rating
- If it's a negative rating, an alert is created

The customer doesn't need to know any of this. Their experience is simple: tap → done.

---

## Common Customer Questions

| Customer says | Response |
|--------------|----------|
| "What is this?" | "It's a quick way to tell us about your visit. Just tap a rating!" |
| "Is it anonymous?" | "Yes, completely. We don't ask for your name." |
| "Do I have to do this?" | "No, it's completely optional. But we'd love your feedback!" |
| "How do I use it?" | "Just tap the stars and follow the prompts. It takes 10 seconds." |
| "I don't have an email" | "No email needed. Just tap and submit." |
| "Is it in Arabic?" | "Tap the Arabic button at the top and it switches right over." |

---

# 9. Maintenance Plan

## Daily Maintenance (2 minutes)

**Who:** Front-line staff or shift manager

- [ ] Check the kiosk screen is on and showing the survey
- [ ] Wipe the screen with a soft cloth (fingerprints build up)
- [ ] Verify the power cable is connected
- [ ] Check the dashboard for any new alerts

## Weekly Maintenance (10 minutes)

**Who:** Location manager

- [ ] Review all feedback from the past week
- [ ] Acknowledge or resolve any open alerts
- [ ] Check that response count seems reasonable (expected for location traffic)
- [ ] Clean the kiosk enclosure thoroughly
- [ ] Test a submission from the kiosk yourself
- [ ] Check QR code cards are still in place and not damaged

## Monthly Maintenance (30 minutes)

**Who:** Organization admin or IT support

- [ ] **Review surveys:** Are existing surveys still relevant? Need new questions?
- [ ] **Review team access:** Any employees who left? Remove their accounts.
- [ ] **Check storage:** Is the database getting full? (Supabase shows usage)
- [ ] **Test backups:** Verify data can be exported (CSV export)
- [ ] **Update software:** Check if the hosting provider deployed updates
- [ ] **Review analytics:** Compare this month to last month
- [ ] **Clean QR codes:** Replace any worn or damaged QR code cards

## Quarterly Maintenance (1 hour)

**Who:** Organization admin or IT support

- [ ] **Full audit:** Review all users, locations, and surveys
- [ ] **Performance check:** Is the system responding quickly enough?
- [ ] **Security review:** Check for any unusual login attempts (Supabase logs)
- [ ] **Verify SSL certificate** is still valid (auto-renewed by Vercel)
- [ ] **Check iPad battery health** (Settings → Battery → Battery Health)
- [ ] **Update iPadOS** if a major version is available
- [ ] **Review hosting bill:** Is the current plan still appropriate?

## Yearly Maintenance (2 hours)

**Who:** Organization admin or IT support

- [ ] **Evaluate hardware:** Are the iPads still in good condition? Battery still holds charge?
- [ ] **Plan upgrades:** Any new features from the platform that should be rolled out?
- [ ] **Full data review:** Archive or export old data if needed
- [ ] **Contract review:** Review hosting and MDM contracts
- [ ] **Training refresh:** Retrain staff on any new features

---

## Software Update Procedures

### When the platform receives an update

The hosting provider (Vercel) manages updates automatically. When new code is deployed:
1. The new version is deployed to the server
2. The database migrations are applied (if any)
3. The next time anyone opens the platform, they see the new version
4. **No action needed on iPads** — the kiosk automatically loads the new version

### Who deploys updates

Updates should be deployed by the **technical team** or **system administrator** who has access to the hosting account. This is NOT a task for front-line staff.

---

# 10. Scaling to Multiple Locations

## From 1 Kiosk to 100 Branches

As the business grows, the system grows with it without needing major changes. Here's how each aspect scales:

### Database Scaling

| Stage | Data Volume | Strategy |
|-------|-------------|----------|
| **1 kiosk (starting)** | ~150 responses/month | Supabase free tier (500 MB) |
| **10 branches** | ~1,500 responses/month | Supabase Pro ($25/month) |
| **50 branches** | ~7,500 responses/month | Supabase Pro + connection pooling |
| **100 branches** | ~15,000+ responses/month | Supabase Team plan + read replicas |

**The database can handle all this without code changes** — the system was built from the start to support multi-tenant, multi-location organizations.

### User Management Scaling

| Stage | Users | Management Strategy |
|-------|-------|--------------------|
| **1 location** | 1 admin + 1 manager + staff | Manual invitation |
| **10 locations** | 10 managers + 1 admin | Manual invitation, manager per location |
| **100 locations** | 100+ managers + regional admins | Consider batch invitation, regional admins |

**Key principle:** Each manager sees only their location's data. Regional admins can be given access to multiple locations. Organization admins see everything.

### Device Management Scaling

| Stage | Devices | Management Strategy |
|-------|---------|--------------------|
| **1 kiosk** | 1 iPad | Guided Access (free, manual) |
| **10 branches** | 10 iPads | MDM (e.g., Jamf or Scalefusion) |
| **100 branches** | 100+ iPads | MDM + enterprise deployment |

**MDM becomes essential** at 5+ devices. Without it, each iPad must be configured manually for every update.

### Security Scaling

| Stage | Security Approach |
|-------|-------------------|
| **1-10 branches** | Simple passwords, single admin |
| **10-50 branches** | Strong passwords required, role-based access |
| **50+ branches** | Audit logging, regular security reviews, 2FA |

The platform already supports all of this — you just start enforcing stricter policies as you grow.

### Monitoring Scaling

| Stage | Monitoring |
|-------|------------|
| **1 kiosk** | Manual check daily |
| **10 branches** | Daily checks + basic uptime monitoring |
| **100 branches** | Automated monitoring, alerting, dashboard |

### What DOESN'T Change When You Scale

- The feedback survey is the same (customers don't see any difference)
- The admin dashboard layout is the same (just more data)
- The QR codes work the same way
- The iPad setup process is the same (but you do it once via MDM instead of 100 times manually)

---

# 11. Cost Breakdown

## One-Time Setup Costs

| Item | Cost (KWD) | Notes |
|------|:----------:|-------|
| **iPad (9th gen or newer)** | 100–200 | Buy new or refurbished |
| **iPad security enclosure** | 20–60 | Counter-top or wall-mount |
| **QR code printing + lamination** | 5–10 | Professional print shop |
| **iPad stand/arm** | 15–30 | Optional, for counter-top use |
| **Domain name registration** | 3–5/year | e.g., feedback.yourcompany.com |
| **Installation labor** | 50–100 | If using a technician |
| **Total one-time** | **193–405** | Per kiosk |

## Monthly Recurring Costs

| Item | Cost (KWD/month) | Notes |
|------|:----------------:|-------|
| **Vercel hosting (frontend)** | 0–20 | Free tier covers small usage |
| **Supabase (database)** | 0–25 | Free tier covers small usage |
| **Domain DNS** | 0 | Free with most registrars |
| **MDM (per device, optional)** | 3–5 | Only needed for 5+ devices |
| **Business internet** | Already paid | Existing business expense |
| **Total monthly** | **3–50** | Full stack |

## Annual Recurring Costs

| Item | Cost (KWD/year) |
|------|:---------------:|
| **Hosting + database** | 0–540 |
| **iPad replacement (every 3-4 years)** | 100–200 per device |
| **Domain renewal** | 3–5 |
| **Total annual** | **103–745** |

## Full Cost Example: 1 Kiosk + 1 Branch

### Year 1

| Item | Cost |
|------|:----:|
| iPad (9th gen, 64 GB, WiFi) | 120 KWD |
| Security enclosure (table stand with lock) | 35 KWD |
| QR code printing + lamination | 8 KWD |
| Domain registration (1 year) | 4 KWD |
| Vercel hosting (12 months) | 0 KWD (free tier) |
| Supabase database (12 months) | 0 KWD (free tier) |
| Installation labor | 75 KWD |
| **Year 1 total** | **242 KWD** |

### Year 2+

| Item | Cost |
|------|:----:|
| Vercel hosting (12 months) | 0–240 KWD |
| Supabase database (12 months) | 0–300 KWD |
| Domain renewal | 4 KWD |
| **Year 2+ total** | **4–544 KWD** |

---

## Total Cost of Ownership (3 Years)

| Scenario | 1 Kiosk | 3 Kiosks | 10 Kiosks |
|----------|:-------:|:---------:|:---------:|
| Hardware (one-time) | 120 KWD | 360 KWD | 1,200 KWD |
| Enclosures (one-time) | 35 KWD | 105 KWD | 350 KWD |
| Hosting (3 years) | 0 KWD | 0 KWD | 600 KWD |
| MDM (3 years) | 0 KWD | 0 KWD | 540 KWD |
| Total | 155 KWD | 465 KWD | 2,690 KWD |
| **Per kiosk per month** | **~4.3 KWD** | **~12.9 KWD** | **~7.5 KWD** |

**Bottom line:** A single kiosk costs about **4 KWD per month** over 3 years. That's less than one meal per month — for continuous customer feedback that can transform your business.

---

# Final Checklist: Go-Live Readiness

Before going live, verify everything:

- [ ] Frontend deployed to Vercel (or chosen host)
- [ ] Database migrations applied to Supabase
- [ ] Domain configured (feedback.yourcompany.com)
- [ ] HTTPS working (green padlock)
- [ ] Organization created in the platform
- [ ] Locations created in the platform
- [ ] Surveys created and published
- [ ] QR codes generated and printed
- [ ] iPad kiosk configured and tested
- [ ] Manager accounts created and logged in
- [ ] Team members invited
- [ ] Test submission completed (verifies full flow)
- [ ] Alert system confirmed (submitted a low rating → alert was created)
- [ ] Staff trained on basic operation
- [ ] Contact established for technical support
- [ ] Backups confirmed active (Supabase does this automatically)
- [ ] This guide is accessible to all staff

---

**End of Deployment, Integration & Operations Guide**
