import { useState } from "react";
import { motion } from "motion/react";
import {
  Crown, Check, Sparkles, Zap, Shield, ArrowRight,
  Star, Users, Lock, MessageSquare, FileSignature,
  FileSearch, FileCheck, X, Loader2, CheckCircle2
} from "lucide-react";
import { auth, db, doc, setDoc, Timestamp } from "../firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { usePremium, FREE_LIMITS, PLANS } from "../lib/usePremium";


const TOOL_LABELS = {
  "summarize-pdf": "AI Summarize",
  "chat-pdf": "Chat with PDF",
  "ocr-pdf": "OCR Extraction",
  "esign-pdf": "E-Sign PDF",
  "smartsign-pro": "SmartSign Pro",
};

export default function PricingPage({ onBack, onAboutClick, onToolClick, onContactClick, onTermsClick, onPrivacyClick, onBlogClick }) {
  const [user] = useAuthState(auth);
  const { isPro, subscription, getUsageSummary, loading } = usePremium();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleUpgrade = async (plan) => {
    if (!user) {
      alert("Please sign in to upgrade.");
      return;
    }

    setIsProcessing(true);
    try {
      // Create order on backend
      const res = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
          userId: user.uid,
          email: user.email,
          name: user.displayName || "User",
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create payment order");
      }

      const orderData = await res.json();

      // Open Razorpay checkout
      const options = {
        key: orderData.razorpayKeyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "PDF Master Pro AI",
        description: `${plan.name} Plan — ${plan.interval}`,
        order_id: orderData.orderId,
        prefill: {
          name: user.displayName || "",
          email: user.email || "",
        },
        theme: {
          color: "#7c3aed",
          backdrop_color: "rgba(0,0,0,0.8)",
        },
        handler: async function (response) {
          // Verify payment
          try {
            const verifyRes = await fetch("/api/payment/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                userId: user.uid,
                planId: plan.id,
              }),
            });

            if (!verifyRes.ok) throw new Error("Verification failed");

            const verifyData = await verifyRes.json();
            if (verifyData.success) {
              // Update local state
              window.location.reload();
            }
          } catch (verifyErr) {
            console.error("Payment verification failed:", verifyErr);
            alert("Payment was processed but verification failed. Please contact support.");
          }
        },
        modal: {
          ondismiss: function () {
            setIsProcessing(false);
          },
        },
      };

      // Load Razorpay script if not loaded
      if (!window.Razorpay) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (err) {
      console.error("Payment Error:", err);
      alert("Payment failed: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const usageSummary = !loading ? getUsageSummary() : [];

  const freeFeatures = [
    { icon: Check, text: "All basic PDF tools — unlimited" },
    { icon: Check, text: "5 AI Summarizations / month" },
    { icon: Check, text: "10 Chat with PDF sessions / month" },
    { icon: Check, text: "5 OCR text extractions / month" },
    { icon: Check, text: "3 E-Sign documents / month" },
    { icon: Check, text: "1 SmartSign Pro document / month" },
    { icon: Check, text: "Community support" },
  ];

  const proFeatures = [
    { icon: Check, text: "Everything in Free, plus:" },
    { icon: Sparkles, text: "Unlimited AI Summarizations", highlight: true },
    { icon: MessageSquare, text: "Unlimited Chat with PDF", highlight: true },
    { icon: FileSearch, text: "Unlimited OCR extractions", highlight: true },
    { icon: FileSignature, text: "Unlimited E-Signatures", highlight: true },
    { icon: FileCheck, text: "Unlimited SmartSign Pro", highlight: true },
    { icon: Zap, text: "Priority processing speed", highlight: true },
    { icon: Shield, text: "Priority email support" },
  ];

  return (
    <div className="w-full min-h-[100dvh] text-white" style={{ background: "var(--bg-primary)" }}>
      <div className="pt-28 sm:pt-36 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 mb-6">
              <Crown size={16} className="text-purple-400" />
              <span className="text-xs font-bold uppercase tracking-widest text-purple-300">Pricing</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-900 text-white mb-6 tracking-tight">
              Simple,{" "}
              <span className="text-transparent bg-clip-text" style={{ backgroundImage: "linear-gradient(135deg, #a855f7, #ec4899)" }}>
                transparent
              </span>{" "}
              pricing
            </h1>

            <p className="text-zinc-400 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed mb-10">
              Start free with generous limits. Upgrade to Pro when you need unlimited power.
            </p>

          </motion.div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto mb-20 items-stretch">

            {/* Free Plan */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={`relative rounded-3xl p-8 lg:p-10 border transition-all duration-300 ${
                !isPro
                  ? "bg-[#111] border-white/20 ring-1 ring-white/10"
                  : "bg-[#111] border-white/5 opacity-80"
              } flex flex-col`}
            >
              {!isPro && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-zinc-700 text-white text-xs font-bold uppercase tracking-widest border border-zinc-600 shadow-lg whitespace-nowrap">
                  Current Plan
                </div>
              )}

              <div className="mb-8 mt-2">
                <h3 className="text-2xl font-800 text-white mb-2">Free</h3>
                <div className="flex items-baseline gap-1 mb-3">
                  <span className="text-5xl font-900 text-white">₹0</span>
                  <span className="text-zinc-500 text-sm font-600">/forever</span>
                </div>
                <p className="text-zinc-400 text-sm leading-relaxed mt-2">
                  Perfect for casual use. All basic PDF tools with generous AI limits.
                </p>
              </div>

              <div className="space-y-3.5 mb-8 flex-grow">
                {freeFeatures.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0">
                      <feature.icon size={12} className="text-zinc-400" />
                    </div>
                    <span className="text-sm text-zinc-300">{feature.text}</span>
                  </div>
                ))}
              </div>

              <div className="mt-auto relative">
                <button
                  disabled
                  className="w-full py-4 rounded-xl text-base font-700 bg-zinc-800 text-zinc-400 border border-zinc-700 cursor-not-allowed"
                >
                  {!isPro ? "Current Plan" : "Free Plan"}
                </button>
              </div>
            </motion.div>

            {/* Pro Monthly Plan */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={`relative rounded-3xl p-8 lg:p-10 border transition-all duration-300 ${
                isPro && subscription?.planId === "pro_monthly"
                  ? "bg-[#111] border-purple-500/30 ring-2 ring-purple-500/20 shadow-2xl shadow-purple-600/10"
                  : "bg-gradient-to-br from-[#1a1025] to-[#111] border-purple-500/20 shadow-2xl shadow-purple-600/10 hover:border-purple-500/40"
              } flex flex-col`}
            >
              {(isPro && subscription?.planId === "pro_monthly") && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold uppercase tracking-widest shadow-lg shadow-purple-500/30 whitespace-nowrap">
                  ✓ Active Plan
                </div>
              )}

              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-purple-600/5 to-pink-600/5 pointer-events-none" />

              <div className="relative mb-8 mt-2">
                <h3 className="text-2xl font-800 text-white mb-2 flex items-center gap-2">
                  Monthly <Crown size={20} className="text-amber-400" />
                </h3>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-5xl font-900 text-white">₹{PLANS.pro_monthly.price}</span>
                  <span className="text-zinc-500 text-sm font-600">/month</span>
                </div>
                <p className="text-zinc-400 text-sm leading-relaxed mt-4">
                  Unlimited everything. Billed monthly for maximum flexibility.
                </p>
              </div>

              <div className="relative space-y-3.5 mb-8 flex-grow">
                {proFeatures.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                      feature.highlight ? "bg-purple-500/20" : "bg-zinc-800"
                    }`}>
                      <feature.icon size={12} className={feature.highlight ? "text-purple-400" : "text-zinc-400"} />
                    </div>
                    <span className={`text-sm ${feature.highlight ? "text-white font-600" : "text-zinc-300"}`}>
                      {feature.text}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-auto relative">
                {isPro && subscription?.planId === "pro_monthly" ? (
                  <button
                    disabled
                    className="w-full py-4 rounded-xl text-base font-700 bg-purple-600/20 text-purple-300 border border-purple-500/30 cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={18} />
                    Active Until {subscription?.expiresAt?.toDate?.()?.toLocaleDateString() || "—"}
                  </button>
                ) : (
                  <button
                    onClick={() => handleUpgrade(PLANS.pro_monthly)}
                    disabled={isProcessing}
                    className="w-full py-4 rounded-xl text-base font-800 bg-purple-500/10 hover:bg-purple-500/20 text-white transition-all duration-300 shadow-xl shadow-purple-500/10 hover:shadow-purple-500/20 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed border border-purple-500/30"
                  >
                    {isProcessing ? (
                      <><Loader2 size={18} className="animate-spin" /> Processing...</>
                    ) : (
                      <>
                        Choose Monthly
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                )}
              </div>
            </motion.div>

            {/* Pro Yearly Plan */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className={`relative rounded-3xl p-8 lg:p-10 border transition-all duration-300 ${
                isPro && subscription?.planId === "pro_yearly"
                  ? "bg-[#111] border-emerald-500/30 ring-2 ring-emerald-500/20 shadow-2xl shadow-emerald-600/10"
                  : "bg-gradient-to-br from-[#022c22] to-[#111] border-emerald-500/30 shadow-2xl shadow-emerald-600/10 hover:border-emerald-500/50"
              } flex flex-col ring-1 ring-emerald-500/20 scale-[1.03] z-10`}
            >
              {/* Popular badge */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-5 py-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold uppercase tracking-widest shadow-lg shadow-emerald-500/30 flex items-center gap-1.5 whitespace-nowrap border border-emerald-400/30">
                <Sparkles size={14} />
                {isPro && subscription?.planId === "pro_yearly" ? "Active Plan" : "Best Value"}
              </div>

              {/* Glow */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-emerald-500/10 to-teal-500/5 pointer-events-none" />

              <div className="relative mb-8 mt-2">
                <h3 className="text-2xl font-800 text-white mb-2 flex items-center gap-2">
                  Yearly <Crown size={20} className="text-emerald-400" />
                </h3>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-5xl font-900 text-white">₹{PLANS.pro_yearly.price}</span>
                  <span className="text-zinc-400 text-sm font-600">/year</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-zinc-500 line-through">₹{PLANS.pro_monthly.price * 12}/yr</span>
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                    Save ₹{(PLANS.pro_monthly.price * 12) - PLANS.pro_yearly.price}
                  </span>
                </div>
                <p className="text-emerald-100/70 text-sm leading-relaxed mt-3">
                  Unlimited everything. Get maximum savings with our annual plan.
                </p>
              </div>

              <div className="relative space-y-3.5 mb-8 flex-grow">
                {proFeatures.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                      feature.highlight ? "bg-emerald-500/20" : "bg-zinc-800/80"
                    }`}>
                      <feature.icon size={12} className={feature.highlight ? "text-emerald-400" : "text-zinc-400"} />
                    </div>
                    <span className={`text-sm ${feature.highlight ? "text-white font-600" : "text-zinc-300"}`}>
                      {feature.text}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-auto relative">
                {isPro && subscription?.planId === "pro_yearly" ? (
                  <button
                    disabled
                    className="w-full py-4 rounded-xl text-base font-700 bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={18} />
                    Active Until {subscription?.expiresAt?.toDate?.()?.toLocaleDateString() || "—"}
                  </button>
                ) : (
                  <button
                    onClick={() => handleUpgrade(PLANS.pro_yearly)}
                    disabled={isProcessing}
                    className="w-full py-4 rounded-xl text-base font-800 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white transition-all duration-300 shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed border border-emerald-400/50"
                  >
                    {isProcessing ? (
                      <><Loader2 size={18} className="animate-spin" /> Processing...</>
                    ) : (
                      <>
                        <Crown size={18} />
                        Choose Yearly
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          </div>

          {/* Usage Section (for logged-in users) */}
          {user && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="max-w-3xl mx-auto mb-20"
            >
              <h2 className="text-2xl font-800 text-white text-center mb-2">Your Usage This Month</h2>
              <p className="text-zinc-500 text-sm text-center mb-8">
                {isPro ? "You have unlimited access to all tools." : "Track your free-tier usage below. Resets on the 1st of each month."}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {usageSummary.map(({ toolId, used, limit, remaining }) => {
                  const percent = isPro ? 0 : Math.min(100, Math.round((used / limit) * 100));
                  const isExhausted = !isPro && remaining <= 0;
                  const isLow = !isPro && remaining > 0 && remaining <= Math.ceil(limit * 0.2);

                  return (
                    <div
                      key={toolId}
                      className={`p-5 rounded-2xl border transition-all ${
                        isExhausted
                          ? "bg-red-500/5 border-red-500/20"
                          : isLow
                          ? "bg-amber-500/5 border-amber-500/20"
                          : "bg-[#111] border-white/5"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-700 uppercase tracking-wider text-zinc-300">
                          {TOOL_LABELS[toolId]}
                        </span>
                        {isPro ? (
                          <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full uppercase">
                            Unlimited
                          </span>
                        ) : (
                          <span className={`text-xs font-bold ${
                            isExhausted ? "text-red-400" : isLow ? "text-amber-400" : "text-zinc-500"
                          }`}>
                            {used}/{limit}
                          </span>
                        )}
                      </div>
                      {!isPro && (
                        <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isExhausted
                                ? "bg-red-500"
                                : isLow
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* FAQ */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="max-w-3xl mx-auto"
          >
            <h2 className="text-2xl font-800 text-white text-center mb-10">Frequently Asked Questions</h2>

            <div className="space-y-4">
              {[
                {
                  q: "Can I use basic PDF tools for free?",
                  a: "Absolutely! All basic tools like Merge, Split, Compress, Rotate, Watermark, Page Numbers, Convert Image, and more are 100% free with no limits. Only AI-powered features and E-Sign have monthly free quotas."
                },
                {
                  q: "What happens when I reach my free limit?",
                  a: "You'll see a friendly upgrade prompt. Your work is never lost. You can wait for the next month to reset, or upgrade to Pro for instant unlimited access."
                },
                {
                  q: "When do free limits reset?",
                  a: "Free usage limits reset automatically on the 1st of every month at midnight UTC."
                },
                {
                  q: "Is my payment secure?",
                  a: "Yes! We use Razorpay, India's leading payment gateway. Your card details are never stored on our servers. All transactions are encrypted with bank-grade security."
                },
                {
                  q: "Can I cancel anytime?",
                  a: "Yes, you can cancel your subscription at any time. You'll continue to have Pro access until the end of your billing period."
                },
              ].map((faq, idx) => (
                <div key={idx} className="bg-[#111] border border-white/5 rounded-2xl p-6">
                  <h3 className="text-white font-700 text-base mb-2">{faq.q}</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </motion.div>

        </div>
      </div>

      {/* Footer is handled by App.jsx globally */}
    </div>
  );
}
