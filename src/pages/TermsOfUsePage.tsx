import { Nav }    from '@/components/common/Nav'
import { Footer } from '@/components/common/Footer'

export default function TermsOfUsePage() {
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
              Terms of Use
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
                1. Acceptance of Terms
              </h2>
              <p>
                By accessing or using the IFFS 2026 Triennial Survey platform ("the Platform"), you
                agree to be bound by these Terms of Use. If you do not agree to these terms, you may
                not access or use the Platform. These terms apply to all users, including registered
                survey participants, administrators, and visitors.
              </p>
            </section>

            <section>
              <h2
                className="font-display text-lg font-semibold mb-3"
                style={{ color: '#0d1117' }}
              >
                2. Eligibility
              </h2>
              <p>
                Access to the survey is restricted to verified representatives of national fertility
                societies and medical professionals authorised by the International Federation of
                Fertility Societies ("IFFS"). One submission per country is permitted. You must
                provide accurate information when registering and maintain the security of your
                account credentials.
              </p>
            </section>

            <section>
              <h2
                className="font-display text-lg font-semibold mb-3"
                style={{ color: '#0d1117' }}
              >
                3. Permitted Use
              </h2>
              <p className="mb-3">You agree to use the Platform solely for its intended purpose of completing the IFFS 2026 Triennial Survey. You must not:</p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>Submit false, misleading, or fabricated data</li>
                <li>Attempt to access accounts or data belonging to other users</li>
                <li>Interfere with the operation or security of the Platform</li>
                <li>Use automated tools to access or submit survey responses</li>
                <li>Reproduce or distribute Platform content without written permission from IFFS</li>
                <li>Use the Platform for any unlawful purpose</li>
              </ul>
            </section>

            <section>
              <h2
                className="font-display text-lg font-semibold mb-3"
                style={{ color: '#0d1117' }}
              >
                4. Data Accuracy
              </h2>
              <p>
                You are responsible for the accuracy and completeness of the data you submit. IFFS
                relies on the integrity of survey responses for its global Surveillance Report. By
                submitting data, you warrant that it accurately reflects clinical practice and
                statistical records within your country to the best of your knowledge.
              </p>
            </section>

            <section>
              <h2
                className="font-display text-lg font-semibold mb-3"
                style={{ color: '#0d1117' }}
              >
                5. Intellectual Property
              </h2>
              <p>
                All content, design, and software comprising the Platform are the property of IFFS
                or its licensors and are protected by applicable intellectual property laws. The
                compiled Surveillance Report and associated publications are owned by IFFS. Survey
                data you submit is licensed to IFFS for use in research, publication, and global
                health reporting purposes.
              </p>
            </section>

            <section>
              <h2
                className="font-display text-lg font-semibold mb-3"
                style={{ color: '#0d1117' }}
              >
                6. Account Security
              </h2>
              <p>
                You are responsible for maintaining the confidentiality of your account credentials
                and for all activity that occurs under your account. You must notify IFFS immediately
                at{' '}
                <a href="mailto:support@iffs.org" style={{ color: '#1d7733' }}>
                  support@iffs.org
                </a>{' '}
                if you suspect any unauthorised access or security breach.
              </p>
            </section>

            <section>
              <h2
                className="font-display text-lg font-semibold mb-3"
                style={{ color: '#0d1117' }}
              >
                7. Disclaimers
              </h2>
              <p>
                The Platform is provided "as is" without warranties of any kind, express or implied.
                IFFS does not warrant that the Platform will be uninterrupted, error-free, or free
                of viruses or other harmful components. IFFS makes no representations regarding the
                suitability of the Platform for any particular purpose.
              </p>
            </section>

            <section>
              <h2
                className="font-display text-lg font-semibold mb-3"
                style={{ color: '#0d1117' }}
              >
                8. Limitation of Liability
              </h2>
              <p>
                To the maximum extent permitted by applicable law, IFFS shall not be liable for any
                indirect, incidental, special, consequential, or punitive damages arising from your
                use of or inability to use the Platform, including but not limited to loss of data
                or loss of goodwill. IFFS's total liability for any claim shall not exceed the
                amount you paid, if any, to access the Platform.
              </p>
            </section>

            <section>
              <h2
                className="font-display text-lg font-semibold mb-3"
                style={{ color: '#0d1117' }}
              >
                9. Termination
              </h2>
              <p>
                IFFS reserves the right to suspend or terminate your access to the Platform at any
                time, without notice, if you violate these Terms of Use or for any other reason at
                IFFS's sole discretion. Upon termination, your right to use the Platform ceases
                immediately.
              </p>
            </section>

            <section>
              <h2
                className="font-display text-lg font-semibold mb-3"
                style={{ color: '#0d1117' }}
              >
                10. Governing Law
              </h2>
              <p>
                These Terms of Use are governed by and construed in accordance with applicable
                international law and the laws of the jurisdiction in which IFFS is registered.
                Any disputes shall be resolved through good-faith negotiation and, if necessary,
                binding arbitration.
              </p>
            </section>

            <section>
              <h2
                className="font-display text-lg font-semibold mb-3"
                style={{ color: '#0d1117' }}
              >
                11. Changes to These Terms
              </h2>
              <p>
                IFFS may modify these Terms of Use at any time. Material changes will be
                communicated to registered users by email. Continued use of the Platform following
                notification of changes constitutes acceptance of the revised terms.
              </p>
            </section>

            <section>
              <h2
                className="font-display text-lg font-semibold mb-3"
                style={{ color: '#0d1117' }}
              >
                12. Contact
              </h2>
              <p>
                For questions regarding these Terms of Use, please contact{' '}
                <a href="mailto:legal@iffs.org" style={{ color: '#1d7733' }}>
                  legal@iffs.org
                </a>.
              </p>
            </section>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  )
}
