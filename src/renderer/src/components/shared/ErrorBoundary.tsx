import { Component } from 'react'

interface Props {
  children: React.ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="font-semibold text-destructive text-lg">Something went wrong</p>
          <pre className="max-w-xl overflow-auto rounded-md bg-muted p-4 text-left text-sm text-muted-foreground">
            {this.state.error.message}
            {'\n'}
            {this.state.error.stack}
          </pre>
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground text-sm"
            onClick={() => this.setState({ error: null })}
          >
            Dismiss
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
