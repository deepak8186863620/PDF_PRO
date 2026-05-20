import React, { Component } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { motion } from "motion/react";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      let errorMessage = "An unexpected error occurred.";
      let isFirestoreError = false;

      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.error && parsed.operationType) {
            errorMessage = `Firestore Error: ${parsed.error} during ${parsed.operationType} on ${parsed.path}`;
            isFirestoreError = true;
          }
        }
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-[100dvh] flex items-center justify-center bg-black p-4 selection:bg-red-500 selection:text-white">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md w-full bg-zinc-900 rounded-[32px] shadow-2xl p-8 text-center border border-zinc-800"
          >
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-8">
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            <h1 className="text-3xl font-black text-white mb-3 tracking-tight uppercase">Something went wrong</h1>
            <p className="text-zinc-400 mb-10 leading-relaxed font-medium">
              {isFirestoreError ? (
                <span className="font-mono text-xs block bg-black/50 p-4 rounded-2xl text-left overflow-auto max-h-40 border border-zinc-800 text-red-400">
                  {errorMessage}
                </span>
              ) : (
                errorMessage
              )}
            </p>
            <button
              onClick={this.handleReset}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-zinc-200 text-black font-black py-4 px-8 rounded-2xl transition-all duration-200 shadow-xl uppercase tracking-widest text-sm active:scale-95"
            >
              <RefreshCw className="w-5 h-5" />
              Try Again
            </button>
            <p className="mt-8 text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em]">
              If the problem persists, please contact support.
            </p>
          </motion.div>
        </div>
      );
    }

    return this.props.children;
  }
}
