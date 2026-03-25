import { Component, type ErrorInfo, type ReactNode } from 'react'
import { translateLiteral } from '@shared/i18n'
import { useSettingsStore } from '../stores/useSettingsStore'

interface ErrorBoundaryProps {
  title: string
  children: ReactNode
  message?: string
  resetKey?: string
}

interface ErrorBoundaryState {
  hasError: boolean
}

function tr(text: string): string {
  return translateLiteral(useSettingsStore.getState().locale, text)
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    try {
      void window.systemScope.logRendererError(
        'error-boundary',
        `Section render failed: ${this.props.title}`,
        {
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack
          },
          componentStack: errorInfo.componentStack
        }
      ).catch(() => undefined)
    } catch {
      // 재귀적 렌더러 오류를 방지하기 위해 로깅 실패를 무시합니다.
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false })
    }
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
            {this.props.message ?? tr('Unable to render this section. Other features remain available.')}
          </div>
          <button
            onClick={() => this.setState({ hasError: false })}
            style={{
              marginTop: '8px',
              padding: '4px 12px',
              fontSize: '12px',
              cursor: 'pointer',
              background: 'var(--bg-card)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)'
            }}
          >
            {tr('Retry')}
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
