import { Nav }    from '@/components/common/Nav'
import { Footer } from '@/components/common/Footer'

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
              Last updated: 1 April 2026
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
              <p>
                The International Federation of Fertility Societies ("IFFS", "we", "us", or "our") operates
                the IFFS 2026 Triennial Survey on Assisted Reproductive Technology. This Privacy Policy
                explains how we collect, use, disclose, and safeguard your information when you use our
                survey platform.
              </p>
            </section>

            <section>
              <h2
                className="font-display text-lg font-semibold mb-3"
                style={{ color: '#0d1117' }}
              >
                2. Information We Collect
              </h2>
              <p className="mb-3">We collect information you provide directly to us, including:</p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>Name and email address when you create an account</li>
                <li>Professional affiliation and country of practice</li>
                <li>Survey responses and associated clinical data</li>
                <li>Communications you send to us</li>
              </ul>
              <p className="mt-3">
                We also collect certain information automatically, such as IP address, browser type,
                and pages visited, for security and analytics purposes.
              </p>
            </section>

            <section>
              <h2
                className="font-display text-lg font-semibold mb-3"
                style={{ color: '#0d1117' }}
              >
                3. How We Use Your Information
              </h2>
              <p className="mb-3">We use the information we collect to:</p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>Operate and maintain the survey platform</li>
                <li>Compile and publish the IFFS Triennial Surveillance Report</li>
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
                4. Data Sharing and Disclosure
              </h2>
              <p className="mb-3">
                Survey response data is aggregated and anonymised before publication. We do not sell,
                trade, or otherwise transfer your personally identifiable information to third parties
                except in the following circumstances:
              </p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>With service providers who assist in operating the platform (subject to confidentiality obligations)</li>
                <li>When required by law, regulation, or legal process</li>
                <li>To protect the rights, property, or safety of IFFS, our users, or the public</li>
              </ul>
            </section>

            <section>
              <h2
                className="font-display text-lg font-semibold mb-3"
                style={{ color: '#0d1117' }}
              >
                5. Data Retention
              </h2>
              <p>
                We retain your account information for as long as your account is active or as needed to
                provide services. Survey response data may be retained indefinitely for longitudinal
                research purposes, in anonymised or aggregated form. You may request deletion of your
                account at any time by contacting us.
              </p>
            </section>

            <section>
              <h2
                className="font-display text-lg font-semibold mb-3"
                style={{ color: '#0d1117' }}
              >
                6. Security
              </h2>
              <p>
                We implement appropriate technical and organisational measures to protect your information
                against unauthorised access, alteration, disclosure, or destruction. All data is
                transmitted over encrypted connections (TLS). However, no method of transmission over the
                internet is 100% secure, and we cannot guarantee absolute security.
              </p>
            </section>

            <section>
              <h2
                className="font-display text-lg font-semibold mb-3"
                style={{ color: '#0d1117' }}
              >
                7. Your Rights
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
              </ul>
              <p className="mt-3">
                To exercise any of these rights, please contact us at{' '}
                <a
                  href="mailto:privacy@iffs.org"
                  style={{ color: '#1d7733' }}
                >
                  privacy@iffs.org
                </a>.
              </p>
            </section>

            <section>
              <h2
                className="font-display text-lg font-semibold mb-3"
                style={{ color: '#0d1117' }}
              >
                8. Cookies
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
                9. Changes to This Policy
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
                10. Contact Us
              </h2>
              <p>
                If you have questions or concerns about this Privacy Policy, please contact:{' '}
                <a
                  href="mailto:privacy@iffs.org"
                  style={{ color: '#1d7733' }}
                >
                  privacy@iffs.org
                </a>
              </p>
            </section>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  )
}
