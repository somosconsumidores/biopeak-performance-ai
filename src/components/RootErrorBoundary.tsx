import React from "react";

interface Props { children: React.ReactNode }
interface State { hasError: boolean; error?: unknown }

export default class RootErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error("ROOT ERROR BOUNDARY:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
          <div className="max-w-md text-center">
            <h1 className="text-2xl font-semibold mb-2">Ocorreu um erro</h1>
            <p className="text-muted-foreground mb-4">Tente fechar e reabrir o app. Se persistir, reinstale.</p>
            <pre className="text-xs opacity-70 text-left overflow-auto max-h-40">
              {String(this.state.error)}
            </pre>
          </div>
        </div>
      );
    }

    return this.props.children as React.ReactElement;
  }
}
