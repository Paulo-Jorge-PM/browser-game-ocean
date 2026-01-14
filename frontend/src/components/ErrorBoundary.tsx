import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Game error caught by boundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="fixed inset-0 bg-[#0a1628] flex items-center justify-center z-[100]">
          <div className="bg-gray-900 border border-red-900 rounded-lg p-8 max-w-md text-center">
            <div className="text-6xl mb-4">🌊</div>
            <h1 className="text-2xl font-bold text-red-400 mb-2">
              Something went wrong
            </h1>
            <p className="text-gray-400 mb-4">
              The game encountered an unexpected error. This has been logged.
            </p>
            {this.state.error && (
              <div className="bg-gray-800 rounded p-3 mb-4 text-left">
                <p className="text-xs text-red-300 font-mono break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-medium transition-colors"
              >
                Reload Game
              </button>
              <button
                onClick={() => this.setState({ hasError: false })}
                className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded font-medium transition-colors"
              >
                Try to Continue
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
