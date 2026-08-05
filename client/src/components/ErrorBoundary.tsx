import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="h-screen flex flex-col items-center justify-center bg-[#0a0e1a] text-[#e8ecf4] p-6 text-center gap-4">
          <span className="text-4xl">💥</span>
          <h1 className="text-lg font-semibold">Došlo je do greške</h1>
          <p className="text-sm text-[#8b93a8] max-w-md">
            Aplikacija je naišla na neočekivanu grešku i morala se restartovati.
            Pokušajte ponovo ili očistite keš preglednika.
          </p>
          {this.state.error && (
            <pre className="text-[11px] text-[#5b6377] bg-[#141824] rounded-lg px-4 py-3 max-w-lg overflow-auto border border-[#202838]">
              {this.state.error.message}
            </pre>
          )}
          <button
            type="button"
            onClick={this.handleReset}
            className="mt-2 px-4 py-2 rounded-lg bg-[#ff4d2e] text-white text-sm font-medium hover:bg-[#e63f24] transition-colors"
          >
            Pokušaj ponovo
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
