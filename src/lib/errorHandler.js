export function setupGlobalErrorHandling() {
  const sendError = async (errorData) => {
    try {
      await fetch('/api/report-error', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorData),
      });
    } catch (e) {
      console.error('Failed to send error report:', e);
    }
  };

  window.addEventListener('error', (event) => {
    sendError({
      type: 'uncaught_exception',
      message: event.message,
      source: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error ? event.error.stack : null,
      url: window.location.href,
      userAgent: navigator.userAgent,
      time: new Date().toISOString()
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    let message = 'Unhandled Promise Rejection';
    let stack = null;
    
    if (event.reason instanceof Error) {
      message = event.reason.message;
      stack = event.reason.stack;
    } else {
      message = String(event.reason);
    }

    sendError({
      type: 'unhandled_rejection',
      message: message,
      stack: stack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      time: new Date().toISOString()
    });
  });
}
