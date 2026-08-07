# Pilot Acceptance Test — v1.0.0-beta

Run each test against the staging deployment. Mark **PASS** or **FAIL**.

---

## 1. Login and Authorization

| # | Test | Expected | Result | Notes |
|---|---|---|---|---|
| 1.1 | Navigate to `/login` | Login form renders | ☐ PASS ☐ FAIL | |
| 1.2 | Sign in as admin (`admin@pilot.kuwait-feedback.test`) | Redirect to `/dashboard` | ☐ PASS ☐ FAIL | |
| 1.3 | Sign in as manager (`manager@pilot.kuwait-feedback.test`) | Redirect to `/dashboard` | ☐ PASS ☐ FAIL | |
| 1.4 | Sign in with invalid credentials | Error message shown, stays on login | ☐ PASS ☐ FAIL | |
| 1.5 | Sign out | Redirect to `/login`, session cleared | ☐ PASS ☐ FAIL | |
| 1.6 | Access `/dashboard` unauthenticated | Redirect to `/login` | ☐ PASS ☐ FAIL | |
| 1.7 | Access `/onboarding` as admin with membership | Redirect to `/dashboard` | ☐ PASS ☐ FAIL | |
| 1.8 | Switch locale to Arabic | UI language changes, RTL layout | ☐ PASS ☐ FAIL | |

## 2. Public Survey Submission (Anonymous)

| # | Test | Expected | Result | Notes |
|---|---|---|---|---|
| 2.1 | Navigate to `/feedback/boulevard-salmiya-feedback` | Survey form renders | ☐ PASS ☐ FAIL | |
| 2.2 | Submit rating-only (no required text) | Response recorded, thank-you shown | ☐ PASS ☐ FAIL | |
| 2.3 | Submit full survey (rating + choices + text) | Response recorded, all fields stored | ☐ PASS ☐ FAIL | |
| 2.4 | Submit duplicate idempotency key | Same response returned (no duplicate) | ☐ PASS ☐ FAIL | |
| 2.5 | Submit with invalid rating (>5) | Validation error returned | ☐ PASS ☐ FAIL | |
| 2.6 | Submit to unknown survey slug | 404 or error page | ☐ PASS ☐ FAIL | |
| 2.7 | Submit with Arabic locale | Labels in Arabic | ☐ PASS ☐ FAIL | |
| 2.8 | View kiosk version at `/kiosk/boulevard-salmiya-feedback` | Full-screen kiosk renders | ☐ PASS ☐ FAIL | |

## 3. Protected Survey Submission (Touchpoint)

| # | Test | Expected | Result | Notes |
|---|---|---|---|---|
| 3.1 | Submit via `/feedback/l/<token>` with valid token | Response attributed to employee/location | ☐ PASS ☐ FAIL | |
| 3.2 | Submit with expired/invalid token | Error page | ☐ PASS ☐ FAIL | |
| 3.3 | Verify response recorded with correct `assigned_employee_id` | Employee attribution accurate | ☐ PASS ☐ FAIL | |
| 3.4 | Verify response recorded with correct `location_id` | Location attribution accurate | ☐ PASS ☐ FAIL | |

## 4. Employee Attribution

| # | Test | Expected | Result | Notes |
|---|---|---|---|---|
| 4.1 | Submit via employee1's distribution link | Response attributed to employee1 | ☐ PASS ☐ FAIL | |
| 4.2 | Submit via employee2's distribution link | Response attributed to employee2 | ☐ PASS ☐ FAIL | |
| 4.3 | Submit via employee3's distribution link | Response attributed to employee3 | ☐ PASS ☐ FAIL | |
| 4.4 | Distribution analytics show per-employee counts | Employee breakdown in analytics | ☐ PASS ☐ FAIL | |

## 5. Location Attribution

| # | Test | Expected | Result | Notes |
|---|---|---|---|---|
| 5.1 | Submit for Salmiya survey | Response location = Salmiya | ☐ PASS ☐ FAIL | |
| 5.2 | Submit for Sharq survey | Response location = Sharq | ☐ PASS ☐ FAIL | |
| 5.3 | Dashboard filter by Salmiya | Only Salmiya responses shown | ☐ PASS ☐ FAIL | |
| 5.4 | Dashboard filter by Sharq | Only Sharq responses shown | ☐ PASS ☐ FAIL | |
| 5.5 | Location comparison chart shows both locations | Two bars in location comparison | ☐ PASS ☐ FAIL | |

## 6. Distribution Conversion

| # | Test | Expected | Result | Notes |
|---|---|---|---|---|
| 6.1 | Click a distribution link | `distribution_link_events` records a click | ☐ PASS ☐ FAIL | |
| 6.2 | Submit response via distribution link | `response_count` incremented on assignment | ☐ PASS ☐ FAIL | |
| 6.3 | Expired/token distribution link returns 404 | Graceful error | ☐ PASS ☐ FAIL | |

## 7. Alerts

| # | Test | Expected | Result | Notes |
|---|---|---|---|---|
| 7.1 | Dashboard shows open alert count | Open alert count > 0 | ☐ PASS ☐ FAIL | |
| 7.2 | Acknowledge an alert (admin) | Alert status changes to "acknowledged" | ☐ PASS ☐ FAIL | |
| 7.3 | Resolve an alert | Alert status changes to "resolved" | ☐ PASS ☐ FAIL | |
| 7.4 | Manager cannot modify alerts outside their location | Permission denied | ☐ PASS ☐ FAIL | |

## 8. Workflow Updates

| # | Test | Expected | Result | Notes |
|---|---|---|---|---|
| 8.1 | View response detail page | Response detail renders | ☐ PASS ☐ FAIL | |
| 8.2 | Update workflow to `branch_followup` | Workflow status updated | ☐ PASS ☐ FAIL | |
| 8.3 | Assign a response to a user | `assigned_to` set | ☐ PASS ☐ FAIL | |
| 8.4 | Add internal note | Note stored, not exposed to public | ☐ PASS ☐ FAIL | |
| 8.5 | Manager can only update assigned-location responses | Permission enforced | ☐ PASS ☐ FAIL | |

## 9. Dashboard Analytics

| # | Test | Expected | Result | Notes |
|---|---|---|---|---|
| 9.1 | Dashboard loads for admin | Page renders without errors | ☐ PASS ☐ FAIL | |
| 9.2 | "All-time responses" card shows 25 | Correct count | ☐ PASS ☐ FAIL | |
| 9.3 | "Responses in range" shows correct count | Filter-respecting count | ☐ PASS ☐ FAIL | |
| 9.4 | "Average rating" card shows data | Normalized percentage shown | ☐ PASS ☐ FAIL | |
| 9.5 | "Low-score responses" card shows count | > 0 | ☐ PASS ☐ FAIL | |
| 9.6 | "Open alerts" card shows 1 (open only) | Correct count | ☐ PASS ☐ FAIL | |
| 9.7 | Response trend chart renders | Bars visible | ☐ PASS ☐ FAIL | |
| 9.8 | Rating distribution chart renders | Distribution bands visible | ☐ PASS ☐ FAIL | |
| 9.9 | Survey comparison chart renders | Survey bars visible | ☐ PASS ☐ FAIL | |
| 9.10 | Location comparison chart renders | Location bars visible | ☐ PASS ☐ FAIL | |
| 9.11 | Recent responses table renders | Rows visible | ☐ PASS ☐ FAIL | |
| 9.12 | Dashboard loads for manager (location-scoped) | Only assigned location data | ☐ PASS ☐ FAIL | |

## 10. KPI Dashboard

| # | Test | Expected | Result | Notes |
|---|---|---|---|---|
| 10.1 | Navigate to KPI dashboard | Page renders | ☐ PASS ☐ FAIL | |
| 10.2 | Total responses KPI matches analytics count | Count consistent | ☐ PASS ☐ FAIL | |
| 10.3 | Satisfaction percentage shown | Reasonable value | ☐ PASS ☐ FAIL | |
| 10.4 | Location breakdown shows per-location KPIs | Two locations listed | ☐ PASS ☐ FAIL | |
| 10.5 | Top concerns / categories shown | Categories visible | ☐ PASS ☐ FAIL | |

## 11. Filters

| # | Test | Expected | Result | Notes |
|---|---|---|---|---|
| 11.1 | Date range filter (30d) | Responses filtered by date | ☐ PASS ☐ FAIL | |
| 11.2 | Location filter | Only selected location data | ☐ PASS ☐ FAIL | |
| 11.3 | Survey filter | Only selected survey data | ☐ PASS ☐ FAIL | |
| 11.4 | Rating range filter | Ratings within range | ☐ PASS ☐ FAIL | |
| 11.5 | Alert status filter | Only matching alerts | ☐ PASS ☐ FAIL | |
| 11.6 | Multiple filters combined | All filters apply simultaneously | ☐ PASS ☐ FAIL | |
| 11.7 | Empty filter results handled gracefully | "No data" state shown | ☐ PASS ☐ FAIL | |

## 12. Exports

| # | Test | Expected | Result | Notes |
|---|---|---|---|---|
| 12.1 | Click "Export responses CSV" | CSV file downloads | ☐ PASS ☐ FAIL | |
| 12.2 | CSV contains correct column headers | Headers match schema | ☐ PASS ☐ FAIL | |
| 12.3 | CSV respects current filters | Only filtered data exported | ☐ PASS ☐ FAIL | |

## 13. Tenant Isolation

| # | Test | Expected | Result | Notes |
|---|---|---|---|---|
| 13.1 | Admin sees only their organization's data | No cross-tenant leakage | ☐ PASS ☐ FAIL | |
| 13.2 | Different-tenant slug returns 404 or error | Access denied | ☐ PASS ☐ FAIL | |
| 13.3 | Direct API call with different org ID in URL | Permission denied | ☐ PASS ☐ FAIL | |
| 13.4 | Manager sees only their location's data | Location-scoped | ☐ PASS ☐ FAIL | |

## 14. Mobile Usability

| # | Test | Expected | Result | Notes |
|---|---|---|---|---|
| 14.1 | Dashboard renders on mobile (375px width) | Responsive layout | ☐ PASS ☐ FAIL | |
| 14.2 | Survey renders on mobile | Touch-friendly inputs | ☐ PASS ☐ FAIL | |
| 14.3 | Login page renders on mobile | Form fits viewport | ☐ PASS ☐ FAIL | |
| 14.4 | Charts are scrollable/horizontal on small screens | No overflow cutoff | ☐ PASS ☐ FAIL | |
| 14.5 | Navigation works on mobile (hamburger menu) | Menu opens/closes | ☐ PASS ☐ FAIL | |

---

## Summary

| Section | Total Tests | Pass | Fail |
|---|---|---|---|
| 1. Login & Authorization | 8 | ☐ | ☐ |
| 2. Public Survey Submission | 8 | ☐ | ☐ |
| 3. Protected Survey Submission | 4 | ☐ | ☐ |
| 4. Employee Attribution | 4 | ☐ | ☐ |
| 5. Location Attribution | 5 | ☐ | ☐ |
| 6. Distribution Conversion | 3 | ☐ | ☐ |
| 7. Alerts | 4 | ☐ | ☐ |
| 8. Workflow Updates | 5 | ☐ | ☐ |
| 9. Dashboard Analytics | 12 | ☐ | ☐ |
| 10. KPI Dashboard | 5 | ☐ | ☐ |
| 11. Filters | 7 | ☐ | ☐ |
| 12. Exports | 3 | ☐ | ☐ |
| 13. Tenant Isolation | 4 | ☐ | ☐ |
| 14. Mobile Usability | 5 | ☐ | ☐ |
| **Total** | **77** | **☐** | **☐** |

**Pilot verdict:** ☐ PASS (all critical tests pass) / ☐ BLOCKED (critical failures exist)
