/**
 * analytics.js — GA4 tracking utility
 *
 * Architecture:
 *  - gtag.js is loaded in index.html with the real GA measurement ID (injected server-side by Vite)
 *  - We NEVER call `gtag('config', ...)` after init — that resets the client_id
 *    and causes all users to appear as 1 user in GA.
 *  - Instead we use `gtag('set', 'user_properties', {...})` and `gtag('set', {user_id: ...})`
 *    to attach the Firebase UID to every subsequent event without resetting the session.
 *
 * ⚠️  GA ToS: Never send real names, emails, or any PII. Firebase UIDs only.
 */

const GA_ID = import.meta.env.VITE_GA_ID;
const IS_DEV = import.meta.env.DEV;

/** Internal — safe console debug logger */
const gaLog = (...args) => {
  if (IS_DEV) console.log('[Analytics]', ...args);
};

/** Check gtag is available */
const hasGtag = () => typeof window !== 'undefined' && typeof window.gtag === 'function';

// ─── Core ────────────────────────────────────────────────────────────────────

/**
 * Send any GA4 event.
 * Automatically adds debug_mode in dev so events appear in GA DebugView.
 */
export const trackEvent = (eventName, params = {}) => {
  const payload = {
    ...params,
    // Include debug_mode only in dev so DebugView shows events live
    ...(IS_DEV ? { debug_mode: true } : {}),
  };

  if (hasGtag()) {
    window.gtag('event', eventName, payload);
    gaLog(`event "${eventName}"`, payload);
  } else {
    gaLog(`[NO GTAG] event "${eventName}"`, payload);
  }
};

// ─── User Identity ────────────────────────────────────────────────────────────

/**
 * Attach Firebase UID to GA4 — called once per session after auth.
 *
 * KEY: We use `gtag('set', ...)` NOT `gtag('config', ...)`.
 * Calling `gtag('config', ...)` again after init resets the client_id and
 * merges all users into one because GA assigns a fresh anonymous client.
 *
 * @param {string} uid      Firebase UID
 * @param {string} provider Auth provider e.g. "google.com"
 */
export const setAnalyticsUser = (uid, provider = 'unknown') => {
  if (!uid) return;

  if (hasGtag()) {
    // Set user_id globally — attaches to all subsequent events
    window.gtag('set', { user_id: uid });

    // Set custom user properties (visible in GA → Explore → User)
    window.gtag('set', 'user_properties', {
      account_type: provider.replace('.com', ''), // "google", "password", etc.
    });
  }

  gaLog(`user identified uid=${uid} provider=${provider}`);
};

/**
 * Clear identity on logout — resets user_id so the next session is anonymous.
 */
export const clearAnalyticsUser = () => {
  if (hasGtag()) {
    window.gtag('set', { user_id: null });
    window.gtag('set', 'user_properties', { account_type: null });
  }
  gaLog('user identity cleared (logout)');
};

// ─── Auth Events ──────────────────────────────────────────────────────────────

/**
 * Track a new user sign-up.
 * Fire ONCE right after Firestore confirms the user doc didn't exist.
 *
 * @param {string} uid      Firebase UID
 * @param {string} method   e.g. "Google"
 */
export const trackSignUp = (uid, method = 'Google') => {
  // GA4 reserved event name for new registrations
  trackEvent('sign_up', { method, uid });
  gaLog(`sign_up uid=${uid} method=${method}`);
};

/**
 * Track a returning user login.
 * Fire ONCE right after successful signInWithPopup.
 *
 * @param {string} uid      Firebase UID
 * @param {string} method   e.g. "Google"
 */
export const trackLogin = (uid, method = 'Google') => {
  // GA4 reserved event name for logins
  trackEvent('login', { method, uid });
  gaLog(`login uid=${uid} method=${method}`);
};

// ─── Page Views ───────────────────────────────────────────────────────────────

/**
 * Manually send a GA4 page_view event for SPA navigation.
 * Call this every time the view/route changes in React.
 *
 * We set send_page_view: false in index.html to prevent the automatic
 * page_view from firing (it only fires once on hard load anyway in SPAs).
 *
 * @param {string} pageName   e.g. "home", "tool_merge-pdf", "dashboard"
 */
export const trackPageView = (pageName) => {
  trackEvent('page_view', {
    page_title: pageName,
    page_location: window.location.href,
    page_path: `/${pageName}`,
  });
};

// ─── Tool Events ──────────────────────────────────────────────────────────────

export const trackToolUsage = (toolId, action, additionalData = {}) => {
  trackEvent('tool_usage', {
    tool_id: toolId,
    action,
    ...additionalData,
  });
};

export const trackError = (errorSource, errorMessage) => {
  trackEvent('exception', {
    description: `${errorSource}: ${errorMessage}`,
    fatal: false,
  });
};
