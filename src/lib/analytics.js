
/**
 * Utility for tracking Google Analytics events
 * 
 * ⚠️  IMPORTANT: Never send real names, emails, or any PII to Google Analytics.
 *     GA's Terms of Service prohibit it and can lead to property suspension.
 *     Instead, we send the Firebase UID (an anonymous ID) and link it to user
 *     data inside Firebase/Firestore.
 */

const GA_ID = import.meta.env.VITE_GA_ID;

/**
 * Send a generic event to GA4
 */
export const trackEvent = (eventName, params = {}) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, {
      ...params,
      timestamp: new Date().toISOString()
    });
  } else {
    if (import.meta.env.DEV) {
      console.log(`[GA Event] ${eventName}:`, params);
    }
  }
};

/**
 * Set the current user's identity in GA.
 * Uses Firebase UID only — safe for GA's PII policy.
 * Also sets "account_type" (e.g., "google") as a custom dimension.
 * 
 * @param {string} uid   - Firebase User ID (e.g., "abc123xyz")
 * @param {string} provider - Auth provider e.g. "google.com", "password"
 */
export const setAnalyticsUser = (uid, provider = 'unknown') => {
  if (!uid) return;

  if (typeof window !== 'undefined' && window.gtag && GA_ID) {
    // Link this session to the user ID for cross-device tracking
    window.gtag('config', GA_ID, {
      user_id: uid,
    });

    // Set custom user properties (visible in GA > User > User Properties)
    window.gtag('set', 'user_properties', {
      account_type: provider.replace('.com', ''), // "google", "password", etc.
    });
  }

  if (import.meta.env.DEV) {
    console.log(`[GA User] uid=${uid}, provider=${provider}`);
  }
};

/**
 * Clear the user identity when they log out
 */
export const clearAnalyticsUser = () => {
  if (typeof window !== 'undefined' && window.gtag && GA_ID) {
    window.gtag('config', GA_ID, { user_id: undefined });
    window.gtag('set', 'user_properties', { account_type: null });
  }
};

export const trackToolUsage = (toolId, action, additionalData = {}) => {
  trackEvent('tool_usage', {
    tool_id: toolId,
    action: action,
    ...additionalData
  });
};

export const trackError = (errorSource, errorMessage) => {
  trackEvent('exception', {
    description: `${errorSource}: ${errorMessage}`,
    fatal: false
  });
};
