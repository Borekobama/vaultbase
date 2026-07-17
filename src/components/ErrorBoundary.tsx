import { Component, type ErrorInfo, type ReactNode } from 'react'

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Vaultbase render failure', error, info.componentStack) }
  render() {
    if (this.state.failed) return <main className="fatal-error"><div><h1>Vaultbase couldn&apos;t start</h1><p>Reload the page. If the problem continues, clear this site&apos;s local storage.</p><button className="primary" type="button" onClick={() => window.location.reload()}>Reload</button></div></main>
    return this.props.children
  }
}
