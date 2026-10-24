import { Component, type ErrorInfo, type ReactNode } from 'react'

/** A screen that fails to draw shows this instead of a blank page; what was saved stays saved. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Screen failed to draw', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ink-50 px-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-card ring-1 ring-ink-200">
          <h1 className="text-lg font-bold text-ink-900">Something went wrong</h1>
          <p className="mt-1 text-[13px] text-ink-500">This screen could not be shown. Your saved work is safe; reloading usually fixes it.</p>
          <p className="mt-3 truncate rounded-lg bg-ink-50 px-3 py-2 font-mono text-xs text-ink-500">{this.state.error.message}</p>
          <div className="mt-5 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="h-9 rounded-lg bg-brand-600 px-3.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
            >
              Reload
            </button>
            <button
              type="button"
              onClick={() => window.location.assign('/')}
              className="h-9 rounded-lg bg-white px-3.5 text-sm font-semibold text-ink-700 shadow-sm ring-1 ring-ink-200 ring-inset hover:bg-ink-50"
            >
              Go to the dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }
}
