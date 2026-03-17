// ─────────────────────────────────────────────────────────────────────────────
// 404 Not Found page
// ─────────────────────────────────────────────────────────────────────────────
import { Link } from 'react-router-dom'
import { Nav }  from '@/components/common/Nav'
import { Footer } from '@/components/common/Footer'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-s1 flex flex-col" style={{ paddingTop: '68px' }}>
      <Nav />

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        {/* Logo mark */}
        <img src="/iffs-logo.png" alt="IFFS" className="w-16 h-16 object-contain mb-8" />

        {/* Error code */}
        <p className="text-8xl font-display font-bold text-g1 leading-none mb-4">404</p>

        {/* Message */}
        <h1 className="text-2xl font-display font-semibold text-f1 mb-2">
          Page not found
        </h1>
        <p className="text-f3 font-body max-w-sm mb-10">
          The page you're looking for doesn't exist or has been moved.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            to="/"
            className="px-6 py-3 rounded-full bg-g1 text-white font-body font-semibold text-sm hover:bg-g2 transition-colors"
          >
            Go to home
          </Link>
          <Link
            to="/dashboard"
            className="px-6 py-3 rounded-full border border-s3 text-f2 font-body font-semibold text-sm hover:border-g1 hover:text-g1 transition-colors"
          >
            Go to dashboard
          </Link>
        </div>
      </div>

      <Footer />
    </div>
  )
}
