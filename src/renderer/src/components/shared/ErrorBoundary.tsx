import { Component } from 'react'
import { i18n } from '../../lib/i18n'
import Button from '../ui/Button'

interface Props {
  children: React.ReactNode
}

interface State {
  error: Error | null
  detailsOpen: boolean
}

// Class component: react-i18next's useTranslation hook isn't usable here, so
// this reads the i18n singleton directly (per its own re-render-on-language-change).
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, detailsOpen: false }

  static getDerivedStateFromError(error: Error): State {
    return { error, detailsOpen: false }
  }

  render(): React.ReactNode {
    const { error, detailsOpen } = this.state
    if (error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="font-semibold text-destructive text-lg">{i18n.t('error.title')}</p>
          {detailsOpen && (
            <pre className="max-w-xl overflow-auto rounded-md bg-muted p-4 text-left text-sm text-muted-foreground">
              {error.message}
              {'\n'}
              {error.stack}
            </pre>
          )}
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => this.setState({ detailsOpen: !detailsOpen })}
            >
              {detailsOpen ? i18n.t('error.hideDetails') : i18n.t('error.showDetails')}
            </Button>
            <Button
              variant="primary"
              onClick={() => this.setState({ error: null, detailsOpen: false })}
            >
              {i18n.t('error.dismiss')}
            </Button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
