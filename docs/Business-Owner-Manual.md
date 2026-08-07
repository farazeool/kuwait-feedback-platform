# Kuwait Feedback Platform — Business Owner Manual

**Version:** 1.0  
**For:** Business owners, general managers, operations directors

---

## 1. WHAT THIS SYSTEM DOES FOR YOUR BUSINESS

The Kuwait Feedback Platform is a **customer feedback system designed for Kuwait businesses**. It lets you:

- **Collect feedback** from customers at your locations using iPad kiosks
- **Compare branches** to see which locations perform best
- **Get alerted** immediately when a customer gives a negative rating
- **Track trends** over days, weeks, and months
- **Generate reports** for management meetings
- **Manage corrective actions** when issues are identified

### Who uses it?

| Person | What they do |
|--------|-------------|
| **Customer** | Taps ratings on an iPad kiosk at your business |
| **Staff** | Keeps the iPad working and helps confused customers |
| **Location manager** | Reviews feedback, responds to alerts |
| **Business owner** | Views analytics, compares branches, makes decisions |

---

## 2. YOUR DASHBOARD

When you log in at `https://feedback.yourcompany.com`, you see:

### Overview Page
The main dashboard shows:
- **Total responses** — how many customers submitted feedback (all time and selected period)
- **Average rating** — normalized to 0-100%
- **Low-score responses** — how many customers gave poor ratings
- **Open alerts** — issues that need attention
- **Response trend** — chart showing feedback volume over time
- **Rating distribution** — breakdown of all ratings
- **Location comparison** — which branches are doing best
- **Recent responses** — latest customer feedback

### Alerts
When a customer gives a low rating (or when your configured thresholds are met), an alert is created. **Alerts are your first warning that something needs attention.**

**Alert statuses:**
- **Open** — New, needs review
- **Acknowledged** — You've seen it and are looking into it
- **Resolved** — Issue has been addressed

### Responses
Every single feedback submission is stored here. You can:
- Search by date, location, or survey
- View the full details of each response
- Mark responses for follow-up
- Assign responses for investigation
- Track corrective actions

### Analytics
Charts and graphs showing:
- **Response trends** — daily/weekly feedback volume
- **Rating distribution** — how many 1s, 2s, 3s, 4s, 5s
- **Survey comparison** — how different surveys perform
- **Location comparison** — branch-to-branch performance
- **Low-score trend** — negative feedback over time

### KPI Dashboard
For deeper analysis:
- **Satisfaction %** — what percentage of customers rate you positively
- **Negative feedback %** — what percentage is negative
- **Top concerns** — most common complaints or issues
- **Location KPIs** — per-branch performance
- **Department KPIs** — per-department breakdown
- **Channel breakdown** — kiosk vs QR vs web

### Reports
Generate monthly reports:
- Response summary
- Corrective action status
- Alert summaries
- Review outcomes
- Full exportable reports

### Team Management
Add and manage users:
- **Organization owner** — full access, can transfer ownership
- **Organization admin** — can manage everything
- **Quality manager** — can manage quality workflows
- **Location manager** — can see only their location
- **Analyst** — can view reports only

### Settings
Configure your organization:
- **Organization** — name, slug, timezone
- **Branding** — your logo, colors, footer text
- **Departments** — organize your business units
- **Touchpoints** — define feedback collection points
- **Rating scales** — configure your own scale (e.g., 1-5, 1-10, emojis)
- **Alert configurations** — set thresholds for when alerts trigger

---

## 3. UNDERSTANDING YOUR DATA

### What the numbers mean

| Metric | What it tells you |
|--------|------------------|
| **Response count** | How many customers gave feedback — higher is better |
| **Average rating** | Overall satisfaction level (normalized to 0-100%) |
| **Satisfaction %** | Percentage of ratings that are positive (above your threshold) |
| **Negative feedback %** | Percentage that are negative |
| **Open alerts** | Issues not yet addressed |
| **Response trend** | Are you getting more or less feedback over time? |

### What good looks like

| Metric | Excellent | Good | Needs Work |
|--------|-----------|------|------------|
| **Average rating** | 80%+ | 60-80% | Below 60% |
| **Satisfaction %** | 90%+ | 70-90% | Below 70% |
| **Negative feedback %** | Under 5% | 5-15% | Above 15% |
| **Open alerts** | 0 | 1-3 | 4+ |

### What to do with the data

**If satisfaction is high:**
1. Identify what you're doing well
2. Share best practices with other locations
3. Reinforce with your team

**If satisfaction is low:**
1. Check the low-score responses — what specifically are customers unhappy about?
2. Create a corrective action if needed
3. Follow up with the location manager
4. Check next month if it improved

**If you have open alerts:**
1. Review each alert
2. Acknowledge it (you've seen it)
3. Assign someone to investigate
4. Take corrective action if needed
5. Mark as resolved

---

## 4. CREATING AND MANAGING SURVEYS

### Creating a survey
1. Go to **Surveys** → **New survey**
2. Give it a title in English AND Arabic
3. Add questions:
   - **Rating questions** — customer taps a number (e.g., 1-5 stars)
   - **Multiple choice** — customer selects from options
   - **Text** — customer types a comment (free text)
4. Mark required questions (customer must answer before submitting)
5. Save as draft → then **Publish** when ready

### Publishing tips
- Start with **3-5 questions** — too many questions reduce completion rates
- Keep it under **30 seconds** to complete
- Make the first question a rating (most engaging)
- Make text questions optional (most people won't type on a kiosk)
- Test on the kiosk before going live

### Kiosk URL
After publishing a survey, you get a kiosk URL:
`https://feedback.yourcompany.com/kiosk/{survey-slug}`

This is the URL you open on the iPad. It shows the welcome screen automatically.

### QR Code
Each survey also has a QR code. Print it and place it:
- On tables (for dine-in customers)
- At the counter
- On receipts
- On marketing materials

Customers scan with their phone camera and submit feedback on their own device.

---

## 5. BRANDING YOUR KIOSK

Go to **Settings** → **Branding** to customize:

| Option | What it does |
|--------|-------------|
| **Logo** | Upload your company logo (PNG, max 2MB) |
| **Primary color** | Main brand color (used for buttons, headers) |
| **Accent color** | Secondary brand color |
| **Thank-you message** | What customers see after submitting |
| **Footer text** | Small text at bottom of kiosk |

**File requirements:**
- Logo: PNG or JPEG, max 2MB, max 500×500px
- Accepts: `.png`, `.jpg`, `.jpeg`, `.webp`

---

## 6. HANDLING COMPLAINTS (CORRECTIVE ACTIONS)

When a customer submits a negative rating, you can:

1. **Acknowledge the alert**
2. **Assign the response** to a manager for follow-up
3. **Create a corrective action** (if the issue requires systematic fixing)

### Corrective Action Workflow

```
Issue identified
    ↓
Create corrective action
    ├─ What is the problem?
    ├─ What is the root cause?
    ├─ What action will fix it?
    ├─ Who is responsible?
    └─ When must it be done by?
    ↓
Action is taken
    ↓
Verification (someone checks the fix worked)
    ↓
Effectiveness review (was the fix sustainable?)
    ↓
Closure (issue resolved)
```

---

## 7. HOW TO GET STARTED

### Day 1
1. Log in for the first time
2. Complete onboarding (create your organization)
3. Add your first location
4. Create your first survey
5. Get the kiosk URL

### Day 2
1. Set up your iPad (see kiosk installation guide)
2. Test submitting feedback
3. Invite your team members

### Week 1
1. Review feedback daily
2. Respond to any alerts
3. Adjust survey questions if needed

### Month 1
1. Review monthly report
2. Compare locations
3. Set improvement targets

---

## 8. COMMON QUESTIONS

**Q: Is it anonymous?**
A: Yes. We do not ask for customer names, emails, or phone numbers.

**Q: Can customers submit in Arabic?**
A: Yes. The kiosk has an Arabic/English toggle button.

**Q: What if the internet goes down?**
A: Customers see an error message with a "Try Again" button. You can also use QR code cards as backup (customers scan with their phone on mobile data).

**Q: How much does it cost?**
A: See the pricing breakdown in the Deployment Guide:
- Hosting: ~4-45 KWD/month
- Per iPad: 0-5 KWD/month (if using MDM)
- Total for 1 kiosk: Approximately 4 KWD/month

**Q: Can I see data from all my branches?**
A: Yes. Organization admins see all locations.

**Q: Can a location manager see other locations?**
A: No. Each manager sees only their assigned location.

**Q: How long is data stored?**
A: Indefinitely. You can export and delete data at any time.

---

## 9. SUPPORT AND ESCALATION

```yaml
First contact:
  Your system administrator: ____________________
  Phone/Email: __________________________________

Technical support:
  Vercel: https://vercel.com/support
  Supabase: https://supabase.com/support

Emergency:
  Contact your deployment team
```

---

## 10. GLOSSARY

| Term | Meaning |
|------|---------|
| **Kiosk** | The iPad in a secure stand that customers use to submit feedback |
| **Kiosk URL** | The web address that shows the feedback survey on the iPad |
| **Survey** | A set of questions for customers to answer |
| **Response** | One submission of feedback from one customer |
| **Rating** | A numerical score (e.g., 1-5) given by a customer |
| **Alert** | A notification triggered by low ratings or configured thresholds |
| **Corrective Action** | A formal process to investigate and fix a problem |
| **Location** | A specific branch or store (e.g., "Salmiya branch") |
| **Organization** | Your company or business entity |
| **SLUG** | A short, unique identifier used in URLs |
| **Guided Access** | iPad feature that locks the device to one app |

---

**End of Business Owner Manual**
