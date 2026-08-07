import type { Metadata } from "next";

import { LegalPage, LegalSection } from "@/components/marketing/legal-page";
import { getMarketingUrl } from "@/lib/config/domains";

/**
 * Baseline Privacy Policy.
 *
 * TODO(legal): must be reviewed by the company's legal advisor before it can
 * be treated as a binding policy. Required additions:
 *   - registered legal entity name and jurisdiction;
 *   - contact route for privacy and data-subject requests;
 *   - concrete data-retention period for feedback responses;
 *   - list of sub-processors to disclose;
 *   - any statutory regime being claimed.
 * No compliance framework (GDPR, HIPAA or similar) is asserted here.
 */
export const metadata: Metadata = {
  title: "Privacy Policy | Review & More",
  description: "How the Review & More platform handles customer feedback data, personal information and organisational records.",
  alternates: { canonical: `${getMarketingUrl()}/privacy` },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="This policy explains what information the Review & More platform processes, why it is processed, and the controls available to the organisations that use it."
    >
      <LegalSection heading="Who this policy covers">
        <p>
          Review &amp; More is a business-to-business platform. Organisations use it to collect customer
          feedback; those organisations decide what to ask, which channels to run and how long to keep a
          survey in service. Each organisation remains responsible for the notices it presents to its own
          customers at the point of collection.
        </p>
      </LegalSection>

      <LegalSection heading="Information processed">
        <p>The platform processes three broad categories of information:</p>
        <ul className="list-disc space-y-2 ps-5">
          <li>
            <strong>Feedback responses.</strong> Ratings and any free-text comments a customer chooses to
            submit, together with the survey, location, channel and—where applicable—the employee the
            response relates to, and the time of submission.
          </li>
          <li>
            <strong>Organisational records.</strong> Account details for the staff who sign in to the
            InstaView workspace, along with the employee, location and survey records an organisation
            creates.
          </li>
          <li>
            <strong>Operational data.</strong> Kiosk device records, activation state, heartbeat
            timestamps and similar technical information needed to keep devices running.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="Why it is processed">
        <p>
          Feedback responses are processed to provide the reporting, analytics and corrective-action
          features the platform is built around. Organisational records are processed to authenticate
          users, enforce tenant isolation and attribute responses correctly. Operational data is processed
          to manage device state and detect connectivity issues.
        </p>
      </LegalSection>

      <LegalSection heading="Data isolation">
        <p>
          Each organisation&apos;s data is isolated at the database level. Row-level security policies
          prevent one organisation from reading or writing another&apos;s records. Administrative
          operations that cross tenant boundaries are restricted to privileged server-side functions and
          are not callable by ordinary authenticated users.
        </p>
      </LegalSection>

      <LegalSection heading="Public feedback links">
        <p>
          When a customer submits feedback through a kiosk, QR code or email-signature link, the
          submission is handled server-side. Public links use opaque tokens that do not expose employee
          email addresses or internal database identifiers. A thank-you confirmation is shown only after
          the response has been successfully stored.
        </p>
      </LegalSection>

      <LegalSection heading="Sub-processors">
        <p>
          The platform relies on third-party infrastructure providers for hosting, database services and
          transactional email. These providers process data on our behalf in order to deliver the service.
        </p>
      </LegalSection>

      <LegalSection heading="Requests about your data">
        <p>
          If you gave feedback to an organisation and want to ask about it, contact that organisation
          directly: it controls the survey and holds the relationship with you. If you are an organisation
          using the platform and need to raise a data request, use the contact route established in your
          service agreement.
        </p>
      </LegalSection>

      <LegalSection heading="Changes">
        <p>
          This policy may be updated as the platform develops. Material changes affecting organisations
          using the platform will be communicated through the account contact on record.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
