import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  title: string
  children: ReactNode
  message?: string
}

interface ErrorBoundaryState {
  hasError: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(`Failed to render section: ${this.props.title}`, error, errorInfo)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px'
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {this.props.title}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            {this.props.message ?? '이 섹션을 렌더링하지 못했습니다. 다른 기능은 계속 사용할 수 있습니다.'}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
