import React from "react";
import { AlertTriangle } from "lucide-react";

// Without this, an uncaught render error (e.g. calling .split() on a null field) unmounts
// the whole React tree and leaves a silent blank white page — no message, no way to recover
// short of the user guessing to hit back/refresh. This catches that and offers a way out.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Unhandled render error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-neutral p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
            <AlertTriangle className="w-7 h-7 text-danger" />
          </div>
          <h1 className="font-poppins font-semibold text-lg text-neutral-800 mb-1">Something went wrong</h1>
          <p className="text-sm text-neutral-500 max-w-sm mb-5">
            This page hit an unexpected error. Try going back to the dashboard — if it keeps happening, let us know.
          </p>
          <button
            onClick={() => { this.setState({ hasError: false }); window.location.href = "/"; }}
            className="px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
