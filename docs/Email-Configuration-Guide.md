# Email Configuration Guide — Production Setup

**Purpose:** Configure Supabase Auth email settings for production deployment  
**Critical for:** User signups, password resets, invitation emails, security  

---

## 1. SUPABASE AUTH SETTINGS (Cloud Dashboard)

After creating your Supabase project, navigate to:

```
Authentication → Settings
```

### Required Changes from Default

| Setting | Default (local) | Production Value | Why |
|---------|:---------------:|:----------------:|-----|
| **Site URL** | `http://127.0.0.1:3000` | `https://feedback.yourcompany.com` | Required for redirect URLs |
| **Enable email confirmations** | `false` | **`true`** | **Prevents unauthorized signups** |
| **Minimum password length** | `10` | `10` | Already secure |
| **SMTP sender name** | Not set | `Kuwait Feedback Platform` | Professional appearance |

### Step-by-Step

```
1. Go to Authentication → Settings → General

2. Under "Site URL":
   → Set: https://feedback.yourcompany.com

3. Under "Redirect URLs":
   → Add: https://feedback.yourcompany.com/*
   → Add: https://feedback.yourcompany.com/auth/callback

4. Under "Security":
   → Toggle "Enable email confirmations" → ON
   → This prevents:
     - Bot signups
     - Users creating accounts with fake emails
     - Unauthorized dashboard access
   
5. Under "SMTP Settings":
   → Toggle "Custom SMTP" → ON
   → Fill in your email provider credentials
   → See section 2 below
```

---

## 2. SMTP PROVIDER SETUP

Supabase requires a custom SMTP provider for production. Built-in emails will NOT be delivered without this.

### Option A: Resend (Recommended)

```
1. Sign up at https://resend.com
2. Verify a domain (e.g., feedback.yourcompany.com)
3. Create an API key
4. In Supabase Auth Settings:
   SMTP Host: smtp.resend.com
   SMTP Port: 587
   SMTP Username: resend
   SMTP Password: <your-resend-api-key>
   Sender Email: noreply@feedback.yourcompany.com
   Sender Name: Kuwait Feedback Platform
```

**Cost:** Free tier (100 emails/day) → $20/month (50,000 emails)

### Option B: SendGrid (Alternative)

```
1. Sign up at https://sendgrid.com
2. Verify a domain
3. Create an API key
4. In Supabase Auth Settings:
   SMTP Host: smtp.sendgrid.net
   SMTP Port: 587
   SMTP Username: apikey
   SMTP Password: <your-sendgrid-api-key>
   Sender Email: noreply@feedback.yourcompany.com
   Sender Name: Kuwait Feedback Platform
```

**Cost:** Free tier (100 emails/day) → $20/month (50,000 emails)

### Option C: Mailgun

```
1. Sign up at https://mailgun.com
2. Verify a domain
3. Find SMTP credentials
4. In Supabase Auth Settings:
   SMTP Host: smtp.mailgun.org
   SMTP Port: 587
   SMTP Username: <your-mailgun-username>
   SMTP Password: <your-mailgun-password>
```

---

## 3. VERIFICATION

### Test Email Sending

After configuring SMTP:

```bash
# From the project root:
npm run email:send-test

# This sends a test email to verify SMTP configuration.
# Check the recipient inbox for "Kuwait Feedback Platform — Test Email"
```

### Test User Signup

```
1. Open an incognito/private browser window
2. Go to https://feedback.yourcompany.com/signup
3. Create a new account
4. Check the email inbox
   → You should receive a confirmation email within 30 seconds
   → Click the confirmation link
   → You should be redirected to the login page with a "Email confirmed" message
   → Sign in with your new credentials
```

### Troubleshooting

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| Confirmation email not received | SMTP not configured | Go to Auth Settings → enable Custom SMTP |
| Email sent but marked as spam | Sender domain not verified | Verify your domain in the email provider |
| "Email rate limit exceeded" error | Supabase rate limit (2/hour) | Wait 1 hour, or increase in config |
| Password reset link broken | Site URL wrong | Update Site URL to production URL |
| Invitation link fails | Redirect URL not whitelisted | Add URL to Redirect URLs list |

---

## 4. EMAIL TEMPLATES

Supabase allows customizing email templates:

```
Authentication → Email Templates
```

### Customize the Confirmation Email

Change the subject and content to match your brand:

```html
<!-- Default template (can be customized) -->
<h2>Confirm your email</h2>
<p>Click the link below to confirm your email address:</p>
<a href="{{ .ConfirmationURL }}">Confirm</a>
```

### Customize the Invitation Email

```html
<h2>You've been invited</h2>
<p>Click to accept your invitation:</p>
<a href="{{ .ConfirmationURL }}">Accept invitation</a>
```

---

## 5. PRODUCTION CHECKLIST

```
Pre-deployment:
  ☐ SMTP provider account created (Resend/SendGrid/Mailgun)
  ☐ Domain verified with email provider
  ☐ SPF and DKIM DNS records added (prevents spam marking)
  ☐ Supabase Auth → email confirmations → ON
  ☐ Supabase Auth → Site URL set to production
  ☐ Supabase Auth → Redirect URLs include production domain
  ☐ Supabase Auth → SMTP configured with real credentials
  ☐ Environment variables set in Vercel:
    - SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD
    - SMTP_FROM_EMAIL, SMTP_FROM_NAME
    - EMAIL_DELIVERY_MODE=smtp

Post-deployment:
  ☐ Test email sent successfully (npm run email:send-test)
  ☐ User signup → confirmation email received
  ☐ User can confirm email → login works
  ☐ Password reset flow works
  ☐ Invitation emails sent (Team → Invite user)
```

---

## 6. PRODUCTION ENV FILE REFERENCE

Add these to your `.env.production`:

```env
# Email configuration (production)
EMAIL_DELIVERY_MODE=smtp
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USERNAME=resend
SMTP_PASSWORD=re_xxxxxxxxxxxx
SMTP_FROM_EMAIL=noreply@feedback.yourcompany.com
SMTP_FROM_NAME="Kuwait Feedback Platform"
```

---

## 7. IMPORTANT SECURITY NOTES

- **Enable email confirmations in production.** Without confirmation, anyone who discovers your signup URL can create an account. Even with rate limiting, this is a vulnerability.
- **Do NOT use disposable email providers** — users should use real email addresses for account recovery.
- **Monitor bounced emails** — repeated bounces may indicate phishing attempts on accounts.
- **Keep SMTP credentials secret** — they are stored in your hosting provider's environment variables.
