import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
          <div className="max-w-md p-6 rounded-xl bg-red-950/50 border border-red-800 text-red-200">
            <h2 className="text-lg font-bold mb-2">Uygulama hatası</h2>
            <p className="text-sm font-mono break-all">{this.state.error.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white text-sm"
            >
              Sayfayı yenile
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
