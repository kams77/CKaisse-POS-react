import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2, Copy, Check } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('CRITICAL UNHANDLED ERROR IN APPLICATION:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    // Les données sont sur le serveur : on ne vide que les préférences d'affichage,
    // jamais la file des scans hors-ligne non encore synchronisés.
    try {
      Object.keys(localStorage)
        .filter(k => !k.startsWith('kolapass_offline_'))
        .forEach(k => localStorage.removeItem(k));
      sessionStorage.clear();
    } catch {
      // ignore
    }
    window.location.reload();
  };

  handleReload = () => {
    window.location.reload();
  };

  handleCopy = () => {
    const details = `Error: ${this.state.error?.message || 'Unknown error'}\nStack:\n${this.state.error?.stack || ''}\nComponentStack:\n${this.state.errorInfo?.componentStack || ''}`;
    navigator.clipboard?.writeText(details);
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2000);
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-2xl bg-slate-800 border-2 border-red-500/50 p-6 md:p-8 shadow-2xl space-y-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-500/20 text-red-400">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Une erreur inattendue est survenue</h1>
                <p className="text-sm text-slate-400">
                  L&apos;application a rencontré une anomalie d&apos;exécution.
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-slate-950 p-4 border border-slate-700/60 font-mono text-xs text-red-300 overflow-x-auto max-h-48">
              {this.state.error?.toString() || 'Erreur inconnue'}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-500 transition-colors shadow-sm"
              >
                <RefreshCw className="h-4 w-4" />
                Recharger la page
              </button>

              <button
                type="button"
                onClick={this.handleReset}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-600 transition-colors"
                title="Vide le cache local pour éliminer toute donnée corrompue"
              >
                <Trash2 className="h-4 w-4" />
                Réinitialiser les données
              </button>

              <button
                type="button"
                onClick={this.handleCopy}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors"
              >
                {this.state.copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                {this.state.copied ? 'Copié' : 'Copier'}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
