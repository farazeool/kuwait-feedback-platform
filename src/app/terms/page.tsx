import type { Metadata } from "next";

import { LegalPage, LegalSection } from "@/components/marketing/legal-page";
import { getMarketingUrl } from "@/lib/config/domains";

/**
 * Baseline Terms of Use.
 *
 * TODO(legal): requires review and completion by the company's legal advisor:
 *   - registered legal entity name and jurisdiction;
 *   - governing law and dispute-resolution venue;
 *   - commercial terms (fees, billing cycle, termination notice);
 *   - any service-level commitment, if one is to be offered;
 *   - limitation-of-liability figures appropriate to the contract value.
 * No uptime guarantee, warranty or certification is asserted here.
 */
export const metadata: Metadata = {
  title: "Terms of Use | Review & More",
  description: "The terms that apply to use of the Review & More platform and the InstaView workspace.",
  alternates: { canonical: `${getMarketingUrl()}/terms` },
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Use"
      intro="These terms apply to use of the Review & More platform, including the InstaView workspace and the public feedback channels an organisation chooses to run."
    >
      <LegalSection heading="Agreement">
        <p>
          These terms govern access to the platform. Where a separate signed service agreement exists
          between us and an organisation, that agreement takes precedence over anything stated here that
          conflicts with it.
        </p>
      </LegalSection>

      <LegalSection heading="Accounts and access">
        <p>
          Access to the InstaView workspace is granted per user. Organisations are responsible for keeping
          sign-in credentials confidential, for the accuracy of the employee, location and survey records
          they create, and for removing access when a member of staff leaves. Sharing a single account
          between multiple people is not supported and undermines the attribution the platform provides.
        </p>
      </LegalSection>

      <LegalSection heading="Acceptable use">
        <p>You agree not to:</p>
        <ul className="list-disc space-y-2 ps-5">
          <li>attempt to access data belonging to another organisation;</li>
          <li>probe, scan or test the security of the platform without written permission;</li>
          <li>submit automated or fabricated feedback in order to distort results;</li>
          <li>use the platform to collect information unlawfully, or in breach of the rights of the customers being surveyed;</li>
          <li>redistribute or resell access without agreement.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="Your data">
        <p>
          Feedback responses, employee records, location records and surveys created by an organisation
          remain that organisation&apos;s data. We process them in order to provide the platform, as
          described in the Privacy Policy.
        </p>
      </LegalSection>

      <LegalSection heading="Feedback attribution">
        <p>
          The platform attributes responses to employees, locations, surveys and channels. Organisations
          are responsible for how they use that information internally, including any obligations they
          have towards their own staff under applicable employment law or internal policy. The platform is
          designed to support coaching and service improvement.
        </p>
      </LegalSection>

      <LegalSection heading="Devices">
        <p>
          Kiosk devices must be activated before they can collect feedback, and each device holds its own
          credential. Organisations are responsible for the physical security of their devices and should
          revoke a device credential through the workspace if a device is lost, replaced or taken out of
          service.
        </p>
      </LegalSection>

      <LegalSection heading="Availability and changes">
        <p>
          The platform is provided on an ongoing basis and is periodically updated. Features may be added,
          changed or withdrawn as the product develops. No specific uptime figure is committed to in these
          terms; where a service level is required, it must be agreed separately in writing.
        </p>
      </LegalSection>

      <LegalSection heading="Suspension and termination">
        <p>
          Access may be suspended where use of the platform threatens its security or integrity, or where
          required by law. Either party may end the arrangement in accordance with the applicable service
          agreement.
        </p>
      </LegalSection>

      <LegalSection heading="Intellectual property">
        <p>
          The platform, including the Review &amp; More and InstaView names, its software and its design,
          remains our property. Nothing in these terms transfers ownership of it.
        </p>
      </LegalSection>

      <LegalSection heading="Changes to these terms">
        <p>
          These terms may be revised as the platform develops. Where a revision materially affects an
          organisation using the platform, it will be communicated through the account contact on record.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
