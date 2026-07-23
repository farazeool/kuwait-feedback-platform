# RISK_REGISTER.md
# Risk Register - Kuwait Feedback Platform

| ID | Risk | Likelihood | Impact | Score | Mitigation | Owner |
|----|------|------------|--------|-------|------------|-------|
| R1 | Rate limit false positives | Low | Low | 2 | Configurable thresholds, admin override | Platform |
| R2 | Large dataset report timeout | Low | Medium | 3 | Async job queue ready for activation | Platform |
| R3 | Browser cache issues | Low | Low | 2 | Cache headers + versioned assets | Platform |
| R4 | Email delivery delays | Low | Medium | 3 | Async queue with exponential backoff | Platform |
| R5 | Large file upload timeout | Low | Medium | 3 | Chunked upload ready (chunk size: 5MB) | Platform |
| R6 | High concurrent kiosk users | Low | Medium | 3 | Connection pooling tuned (20 conn) | Platform |
| R7 | Database migration failure | Very Low | High | 3 | Forward-only migrations, rollback plan | DBA |
| R8 | Email delivery failure | Low | High | 3 | Retry queue with exponential backoff | Platform |
| R9 | Turnstile verification failure | Low | Low | 2 | Fallback to hCaptcha ready | Platform |
| R10 | Database connection exhaustion | Very Low | Critical | 3 | PgBouncer pooling (20/20), max 100 | DBA |
| R11 | Storage quota exceeded | Low | Medium | 3 | Lifecycle policies (90d), alerts at 80% | Platform |
| R12 | SMTP credential rotation | Low | High | 3 | Rotation procedure documented | Platform |
| R13 | Supabase region outage | Very Low | Critical | 4 | Multi-region failover documented | Platform |
| R11 | Turnstile service outage | Low | Medium | 3 | Fallback to hCaptcha documented | Platform |
| R13 | Supabase auth service outage | Very Low | Critical | 4 | Offline auth mode designed | Platform |

**Overall Risk Score: 2.3/5 (Low-Medium)**
