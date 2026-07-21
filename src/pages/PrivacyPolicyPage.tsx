import { Nav }    from '@/components/common/Nav'
import { Footer } from '@/components/common/Footer'

// Privacy contact — kept in one place so the address never drifts between sections.
const PRIVACY_EMAIL = 'info@iffssurvey.com'

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ paddingTop: '68px' }}>
      <Nav />

      <main className="flex-1 py-20 px-6">
        <div className="max-w-3xl mx-auto">

          <div className="mb-10">
            <span
              className="inline-block font-display text-[11px] font-bold tracking-[0.22em] uppercase mb-4 px-4 py-2 rounded-full"
              style={{ color: '#1d7733', backgroundColor: '#e8f5ec' }}
            >
              Legal
            </span>
            <h1
              className="font-display font-light leading-tight mb-3"
              style={{ fontSize: 'clamp(28px, 4vw, 42px)', color: '#0d1117' }}
            >
              Privacy Policy
            </h1>
            <p className="font-body text-sm" style={{ color: '#7a8a96' }}>
              Last updated: 16 July 2026
            </p>
          </div>

          <div
            className="font-body text-base leading-relaxed space-y-8"
            style={{ color: '#3d4a52' }}
          >
            <section>
              <h2
                className="font-display text-lg font-semibold mb-3"
                style={{ color: '#0d1117' }}
              >
                1. Introduction
              </h2>
              <p className="mb-3">
                The International Federation of Fertility Societies ("IFFS", "we", "us", or "our") operates
                the IFFS 2027 Biennial Survey on Assisted Reproductive Technology. This Privacy Policy
                explains how we collect, use, disclose, and safeguard your information when you use our
                survey platform.
              </p>
              <p>
                This policy applies to all users worldwide. It is written to meet the requirements of the
                EU and UK General Data Protection Regulation (GDPR), the California Consumer Privacy Act as
                amended by the CPRA (CCPA/CPRA), and comparable data-protection laws, and we apply these
                protections to every participant regardless of location.
              </p>
            </section>

            <section>
              <h2
                className="font-display text-lg font-semibold mb-3"
                style={{ color: '#0d1117' }}
              >
                2. Data Controller
              </h2>
              <p>
                IFFS is the data controller responsible for the personal data processed through this
                platform. You can contact us about this policy or any data-protection matter at{' '}
                <a href={`mailto:${PRIVACY_EMAIL}`} style={{ color: '#1d7733' }}>{PRIVACY_EMAIL}</a>.
                {/* TODO(IFFS): insert the registered office postal address and, if one is appointed,
                    the Data Protection Officer / EU–UK Article 27 representative contact here. */}
              </p>
            </section>

            <section>
              <h2
                className="font-display text-lg font-semibold mb-3"
                style={{ color: '#0d1117' }}
              >
                3. Information We Collect
              </h2>
              <p className="mb-3">We collect information you provide directly to us, including:</p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>Name and email address when you create an account</li>
                <li>Professional affiliation, role, and country of practice</li>
                <li>Survey responses and associated clinical and regulatory data</li>
                <li>Communications you send to us</li>
              </ul>
              <p className="mt-3">
                We also collect certain information automatically, such as IP address, browser type,
                and pages visited, for security and analytics purposes. Administrative actions taken by
                IFFS staff on the platform (for example, exporting or resetting a response) are recorded
                in an internal audit log.
              </p>
            </section>

            <section>
              <h2
                className="font-display text-lg font-semibold mb-3"
                style={{ color: '#0d1117' }}
              >
                4. How We Use Your Information
              </h2>
              <p className="mb-3">We use the information we collect to:</p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>Operate and maintain the survey platform</li>
                <li>Compile and publish the IFFS Biennial Surveillance Report</li>
                <li>Verify your identity and professional credentials</li>
                <li>Send administrative communications related to the survey</li>
                <li>Improve the platform and ensure its security</li>
              </ul>
            </section>

            <section>
              <h2
                className="font-display text-lg font-semibold mb-3"
                style={{ color: '#0d1117' }}
              >
                5. Legal Basis for Processing (EU/UK GDPR)
              </h2>
              <p className="mb-3">
                Where the GDPR applies, we rely on the following legal bases under Article 6:
              </p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>
                  <strong>Consent</strong> — for creating your account and submitting survey responses.
                  You may withdraw consent at any time (see "Your Rights"); withdrawal does not affect
                  processing carried out before withdrawal.
                </li>
                <li>
                  <strong>Legitimate interests</strong> — to compile and publish anonymised, aggregated
                  research on assisted reproductive technology, to secure the platform, and to prevent
                  misuse. We balance these interests against your rights and freedoms.
                </li>
                <li>
                  <strong>Legal obligation</strong> — where we must process data to comply with applicable
                  law or respond to lawful requests.
                </li>
              </ul>
              <p className="mt-3">
                The published survey results are statistical and do not identify individual participants.
              </p>
            </section>

            <section>
              <h2
                className="font-display text-lg font-semibold mb-3"
                style={{ color: '#0d1117' }}
              >
                6. Data Sharing and Disclosure
              </h2>
              <p className="mb-3">
                Survey response data is aggregated and anonymised before publication. We do not sell,
                trade, or rent your personally identifiable information. We disclose personal data only
                in the following circumstances:
              </p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>
                  With service providers who host and operate the platform on our behalf (our database and
                  authentication provider, Supabase, and our application hosting provider), under
                  contractual confidentiality and data-processing obligations
                </li>
                <li>When required by law, regulation, or valid legal process</li>
                <li>To protect the rights, property, or safety of IFFS, our users, or the public</li>
              </ul>
            </section>

            <section>
              <h2
                className="font-display text-lg font-semibold mb-3"
                style={{ color: '#0d1117' }}
              >
                7. International Data Transfers
              </h2>
              <p>
                The platform database is hosted with Supabase on Amazon Web Services infrastructure in the
                Asia Pacific (Mumbai, India) region. If you access the platform from the European Economic
                Area, the United Kingdom, or another region with data-transfer restrictions, your personal
                data will be transferred to and processed in India and other countries that may not provide
                the same level of protection as your home jurisdiction. Where required, such transfers are
                protected by appropriate safeguards, including Standard Contractual Clauses and our
                providers' data-processing terms. You may request a copy of the relevant safeguards by
                contacting us.
              </p>
            </section>

            <section>
              <h2
                className="font-display text-lg font-semibold mb-3"
                style={{ color: '#0d1117' }}
              >
                8. Data Retention
              </h2>
              <p>
                We retain account information (such as your name and email address) only for as long as
                your account is active and it is needed to operate the survey. After each biennial survey
                report is published, we remove or irreversibly anonymise the direct identifiers associated
                with survey responses. Anonymised and aggregated response data — which can no longer be
                linked to an individual — may be retained indefinitely for longitudinal research and
                historical comparison. You may request deletion of your account and identifiable data at
                any time by contacting us, and we will delete it unless we are required to retain it by law.
              </p>
            </section>

            <section>
              <h2
                className="font-display text-lg font-semibold mb-3"
                style={{ color: '#0d1117' }}
              >
                9. Security
              </h2>
              <p>
                We implement appropriate technical and organisational measures to protect your information
                against unauthorised access, alteration, disclosure, or destruction. These include
                encrypted connections (TLS), row-level access controls that restrict each user to their own
                data, restricted administrative access, and audit logging of sensitive administrative
                actions. However, no method of transmission over the internet is completely secure, and we
                cannot guarantee absolute security.
              </p>
            </section>

            <section>
              <h2
                className="font-display text-lg font-semibold mb-3"
                style={{ color: '#0d1117' }}
              >
                10. Your Rights
              </h2>
              <p className="mb-3">
                Depending on your jurisdiction, you may have the right to:
              </p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>Access the personal data we hold about you</li>
                <li>Correct inaccurate or incomplete data</li>
                <li>Request deletion of your personal data</li>
                <li>Object to or restrict processing of your data</li>
                <li>Receive a portable copy of your data</li>
                <li>Withdraw consent at any time, where processing is based on consent</li>
              </ul>
              <p className="mt-3">
                To exercise any of these rights, please contact us at{' '}
                <a href={`mailto:${PRIVACY_EMAIL}`} style={{ color: '#1d7733' }}>{PRIVACY_EMAIL}</a>.
                We will respond within the timeframe required by applicable law. If you are in the EEA or
                UK and believe we have not handled your data lawfully, you also have the right to lodge a
                complaint with your local data-protection supervisory authority.
              </p>
            </section>

            <section>
              <h2
                className="font-display text-lg font-semibold mb-3"
                style={{ color: '#0d1117' }}
              >
                11. US State Privacy Rights (CCPA/CPRA and similar laws)
              </h2>
              <p className="mb-3">
                If you are a resident of California or another US state with a comprehensive privacy law,
                you have the right to know what personal information we collect, to access and delete it,
                to correct inaccuracies, and to not be discriminated against for exercising these rights.
              </p>
              <p className="mb-3">
                In the preceding 12 months we have collected the categories of personal information
                described in Section 3 (identifiers, professional information, and internet/network
                activity). We use this information for the business purposes described in Section 4 and
                disclose it only to the service providers described in Section 6.
              </p>
              <p>
                <strong>We do not sell or share your personal information</strong> as those terms are
                defined under the CCPA/CPRA, and we do not use it for cross-context behavioural
                advertising. To exercise your rights, contact us at{' '}
                <a href={`mailto:${PRIVACY_EMAIL}`} style={{ color: '#1d7733' }}>{PRIVACY_EMAIL}</a>.
                You may use an authorised agent to submit a request on your behalf.
              </p>
            </section>

            <section>
              <h2
                className="font-display text-lg font-semibold mb-3"
                style={{ color: '#0d1117' }}
              >
                12. Automated Decision-Making
              </h2>
              <p>
                We do not use your personal data for automated decision-making or profiling that produces
                legal or similarly significant effects concerning you.
              </p>
            </section>

            <section>
              <h2
                className="font-display text-lg font-semibold mb-3"
                style={{ color: '#0d1117' }}
              >
                13. Cookies
              </h2>
              <p>
                We use essential cookies to maintain your session and ensure the platform functions
                correctly. We do not use tracking or advertising cookies. You can disable cookies in
                your browser settings, though this may affect platform functionality.
              </p>
            </section>

            <section>
              <h2
                className="font-display text-lg font-semibold mb-3"
                style={{ color: '#0d1117' }}
              >
                14. Children's Privacy
              </h2>
              <p>
                The platform is intended for healthcare professionals and researchers and is not directed
                to children. We do not knowingly collect personal data from anyone under the age of 16. If
                you believe a child has provided us with personal data, please contact us and we will
                delete it.
              </p>
            </section>

            <section>
              <h2
                className="font-display text-lg font-semibold mb-3"
                style={{ color: '#0d1117' }}
              >
                15. Changes to This Policy
              </h2>
              <p>
                We may update this Privacy Policy from time to time. We will notify registered users
                of material changes by email. Continued use of the platform after changes take effect
                constitutes acceptance of the revised policy.
              </p>
            </section>

            <section>
              <h2
                className="font-display text-lg font-semibold mb-3"
                style={{ color: '#0d1117' }}
              >
                16. Contact Us
              </h2>
              <p>
                If you have questions or concerns about this Privacy Policy or how we handle your data,
                please contact:{' '}
                <a href={`mailto:${PRIVACY_EMAIL}`} style={{ color: '#1d7733' }}>{PRIVACY_EMAIL}</a>
              </p>
            </section>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  )
}
