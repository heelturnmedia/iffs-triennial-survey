import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'

interface Props {
  children: ReactNode
  /** Custom fallback UI. If omitted a generic error card is shown. */
  fallback?: ReactNode
  /** Optional label shown in the generic fallback card (e.g. "Map") */
  label?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Generic React error boundary. Wrap any component that might throw during
 * render (e.g. third-party libraries like Mapbox) so the error is contained
 * and doesn't crash the entire panel.
 *
 * Usage:
 *   <ErrorBoundary label="Map">
 *     <ChoroplethMap ... />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary]', error, info.componentStack)
    }
  }

  handleRetry = () => this.setState({ hasError: false, error: null })

  render() {
    if (!this.state.hasError) return this.props.children

    if (this.props.fallback) return this.props.fallback

    return (
      <div
        className="flex flex-col items-center justify-center gap-3 rounded-2xl p-10 text-center"
        style={{ border: '1px solid #fca5a5', background: '#fef2f2' }}
      >
        <p className="font-display text-[14px] font-bold text-red-700">
          {this.props.label ? `${this.props.label} failed to load` : 'Something went wrong'}
        </p>
        {import.meta.env.DEV && this.state.error && (
          <p className="font-body text-[11px] text-red-500 max-w-sm break-all">
            {this.state.error.message}
          </p>
        )}
        <button
          type="button"
          onClick={this.handleRetry}
          className="font-display text-[10px] font-bold tracking-[0.10em] uppercase px-4 py-2 rounded-lg border-[1.5px] border-red-200 text-red-600 hover:bg-red-50 transition-all"
        >
          Retry
        </button>
      </div>
    )
  }
}
