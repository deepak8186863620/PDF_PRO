/**
 * usePremium — Freemium usage tracking hook
 *
 * Tracks per-tool usage per month in Firestore.
 * Free users get limited uses; Pro subscribers get unlimited.
 *
 * Firestore document: users/{uid}/subscription/current
 * Firestore document: users/{uid}/usage/{YYYY-MM}
 */
import { useState, useEffect, useCallback } from "react";
import { auth, db, doc, getDoc, setDoc, Timestamp } from "../firebase";
import { useAuthState } from "react-firebase-hooks/auth";

/* ───────── Free-tier monthly limits ───────── */
export const FREE_LIMITS = {
  "summarize-pdf": 5,
  "chat-pdf": 10,      // 10 chat sessions (not messages)
  "ocr-pdf": 5,
  "esign-pdf": 3,
  "smartsign-pro": 1,
};

/* ───────── Which tools are "premium" ───────── */
export const PREMIUM_TOOL_IDS = Object.keys(FREE_LIMITS);

export function isPremiumTool(toolId) {
  return PREMIUM_TOOL_IDS.includes(toolId);
}

/* ───────── Plan config ───────── */
export const PLANS = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    interval: null,
    features: [
      "All basic PDF tools — unlimited",
      "5 AI Summarizations / month",
      "10 Chat with PDF sessions / month",
      "5 OCR extractions / month",
      "3 E-Sign documents / month",
      "1 SmartSign Pro document / month",
    ],
  },
  pro_monthly: {
    id: "pro_monthly",
    name: "Pro",
    price: 199,
    currency: "INR",
    interval: "monthly",
    razorpayPlanId: null, // set after creating in Razorpay dashboard
    features: [
      "Everything in Free",
      "Unlimited AI Summarizations",
      "Unlimited Chat with PDF",
      "Unlimited OCR extractions",
      "Unlimited E-Signatures",
      "Unlimited SmartSign Pro",
      "Priority processing speed",
      "Priority email support",
    ],
  },
  pro_yearly: {
    id: "pro_yearly",
    name: "Pro",
    price: 599,
    currency: "INR",
    interval: "yearly",
    razorpayPlanId: null,
    features: [
      "Everything in Pro Monthly",
      "Save ₹1789 per year (75% off)",
      "Priority email support",
    ],
  },
};

/* ───────── Current month key (e.g. "2026-06") ───────── */
function getMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/* ───────── Hook ───────── */
export function usePremium() {
  const [user] = useAuthState(auth);
  const [subscription, setSubscription] = useState(null); // null = loading
  const [usage, setUsage] = useState({});
  const [loading, setLoading] = useState(true);

  const isPro = subscription?.status === "active";
  const monthKey = getMonthKey();

  /* ── Load subscription + usage from Firestore ── */
  useEffect(() => {
    if (!user) {
      setSubscription({ status: "free" });
      setUsage({});
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        // Load subscription
        const subRef = doc(db, "users", user.uid, "subscription", "current");
        const subSnap = await getDoc(subRef);
        if (subSnap.exists()) {
          const subData = subSnap.data();
          // Check if subscription is expired
          if (subData.expiresAt && subData.expiresAt.toDate() < new Date()) {
            setSubscription({ status: "expired", ...subData });
          } else {
            setSubscription(subData);
          }
        } else {
          setSubscription({ status: "free" });
        }

        // Load this month's usage
        const usageRef = doc(db, "users", user.uid, "usage", monthKey);
        const usageSnap = await getDoc(usageRef);
        if (usageSnap.exists()) {
          setUsage(usageSnap.data());
        } else {
          setUsage({});
        }
      } catch (err) {
        console.error("Failed to load premium data:", err);
        setSubscription({ status: "free" });
        setUsage({});
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user, monthKey]);

  /* ── Check if user can use a premium tool ── */
  const checkCanUse = useCallback(
    (toolId) => {
      if (!isPremiumTool(toolId)) return { allowed: true, remaining: Infinity };
      if (isPro) return { allowed: true, remaining: Infinity };

      const limit = FREE_LIMITS[toolId] || 0;
      const used = usage[toolId] || 0;
      const remaining = Math.max(0, limit - used);

      return {
        allowed: remaining > 0,
        remaining,
        limit,
        used,
      };
    },
    [isPro, usage]
  );

  /* ── Track a tool usage in Firestore ── */
  const trackUsage = useCallback(
    async (toolId) => {
      if (!user || !isPremiumTool(toolId) || isPro) return;

      const newUsage = { ...usage, [toolId]: (usage[toolId] || 0) + 1 };
      setUsage(newUsage);

      try {
        const usageRef = doc(db, "users", user.uid, "usage", monthKey);
        await setDoc(usageRef, { ...newUsage, updatedAt: Timestamp.now() }, { merge: true });
      } catch (err) {
        console.error("Failed to track usage:", err);
      }
    },
    [user, isPro, usage, monthKey]
  );

  /* ── Get usage summary for all premium tools ── */
  const getUsageSummary = useCallback(() => {
    return PREMIUM_TOOL_IDS.map((toolId) => {
      const limit = FREE_LIMITS[toolId];
      const used = usage[toolId] || 0;
      return {
        toolId,
        limit,
        used,
        remaining: isPro ? Infinity : Math.max(0, limit - used),
        isPro,
      };
    });
  }, [usage, isPro]);

  return {
    user,
    subscription,
    isPro,
    loading,
    usage,
    checkCanUse,
    trackUsage,
    getUsageSummary,
    monthKey,
    PLANS,
    FREE_LIMITS,
  };
}
