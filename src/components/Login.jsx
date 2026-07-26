import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, CheckCircle2, Shield, Zap, Globe, FileText, Lock, Brain, ChevronDown, Sparkles, Loader2, Crown, Check, MessageSquare, FileSearch, FileSignature, FileCheck, ArrowRight } from "lucide-react";
import { auth, googleProvider, microsoftProvider, signInWithPopup, signInWithRedirect, getRedirectResult, db, doc, setDoc, getDoc, Timestamp } from "../firebase";
import { setAnalyticsUser, trackLogin, trackSignUp } from "../lib/analytics";
import loginPromo from "../assets/login-promo.webp";
import { PLANS } from "../lib/usePremium";

import Footer from "./Footer";

export default function Login({ onBack, onLoginSuccess, onAboutClick, onToolClick, onContactClick, onTermsClick, onPrivacyClick }) {
  const [isRedirecting, setIsRedirecting]   = useState(false);
  const [msLoading, setMsLoading]           = useState(false);
  const [googleLoading, setGoogleLoading]   = useState(false);

  useEffect(() => {
    const handleRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          const u = result.user;
          const userDocRef = doc(db, "users", u.uid);
          const userDoc = await getDoc(userDocRef);
          const isNewUser = !userDoc.exists();
          
          const userData = {
            uid: u.uid,
            email: u.email,
            displayName: u.displayName,
            photoURL: u.photoURL,
            lastLogin: Timestamp.now(),
          };
          
          if (isNewUser) {
            userData.createdAt = Timestamp.now();
            userData.role = "user";
          }
          
          await setDoc(userDocRef, userData, { merge: true });
          setAnalyticsUser(u.uid, 'google.com');
          if (isNewUser) {
            trackSignUp(u.uid, 'Google');
            // Send thank-you welcome email for redirect-based new sign-ups
            fetch("/api/send-welcome-email", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: u.email, displayName: u.displayName }),
            }).catch(() => {});
          } else {
            trackLogin(u.uid, 'Google');
          }
          if (onLoginSuccess) onLoginSuccess();
        }
      } catch (error) {
        console.error("Redirect login failed:", error);
        alert(`Login failed: ${error.message}`);
      }
    };
    handleRedirectResult();
  }, [onLoginSuccess]);

  // Sends the thank-you welcome email for brand-new registrations (fire-and-forget)
  const sendWelcomeEmail = async (email, displayName) => {
    try {
      await fetch("/api/send-welcome-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, displayName }),
      });
    } catch {
      // Silently ignore — email failure must not block login
    }
  };

  const saveUserToFirestore = async (u, providerName) => {
    const userDocRef = doc(db, "users", u.uid);
    const userDoc    = await getDoc(userDocRef);
    const isNewUser  = !userDoc.exists();
    const userData   = {
      uid: u.uid, email: u.email,
      displayName: u.displayName, photoURL: u.photoURL,
      lastLogin: Timestamp.now(),
    };
    if (isNewUser) { userData.createdAt = Timestamp.now(); userData.role = "user"; }
    await setDoc(userDocRef, userData, { merge: true });
    setAnalyticsUser(u.uid, providerName);
    if (isNewUser) {
      trackSignUp(u.uid, providerName);
      sendWelcomeEmail(u.email, u.displayName); // fire-and-forget
    } else {
      trackLogin(u.uid, providerName);
    }
    return isNewUser;
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await saveUserToFirestore(result.user, 'google.com');
      if (onLoginSuccess) onLoginSuccess();
    } catch (error) {
      console.error("Google login failed:", error);
      if (['auth/popup-blocked','auth/popup-closed-by-user','auth/cross-origin-isolated','auth/web-storage-unsupported'].includes(error.code)) {
        setIsRedirecting(true);
        await signInWithRedirect(auth, googleProvider);
      } else {
        alert(`Login failed: ${error.message}`);
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleMicrosoftSignIn = async () => {
    setMsLoading(true);
    try {
      const result = await signInWithPopup(auth, microsoftProvider);
      await saveUserToFirestore(result.user, 'microsoft.com');
      if (onLoginSuccess) onLoginSuccess();
    } catch (error) {
      console.error("Microsoft login failed:", error);
      if (['auth/popup-blocked','auth/popup-closed-by-user','auth/cross-origin-isolated','auth/web-storage-unsupported'].includes(error.code)) {
        setIsRedirecting(true);
        await signInWithRedirect(auth, microsoftProvider);
      } else if (error.code !== 'auth/popup-closed-by-user') {
        alert(`Microsoft login failed: ${error.message}\n\nMake sure Microsoft is enabled in your Firebase project console under Authentication > Sign-in method.`);
      }
    } finally {
      setMsLoading(false);
    }
  };

  const features = [
    "Unlimited PDF processing",
    "High-end AI document tools",
    "Secure & private conversions",
    "Cross-platform synchronization"
  ];

  const [activeShowcaseTab, setActiveShowcaseTab] = useState("ai");

  return (
    <div className="w-full min-h-[100dvh] bg-black text-white selection:bg-red-500/30">
      {/* ── Top Section: Login Card ── */}
      <div className="min-h-[100dvh] flex flex-col items-center justify-center relative py-12 px-4">
        
        {/* Floating Back Button */}
        <button
          onClick={onBack}
          className="absolute top-6 left-6 md:top-8 md:left-8 z-50 flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2.5 rounded-full text-white font-bold text-xs uppercase tracking-widest backdrop-blur-md transition-all duration-300 hover:scale-105 active:scale-95 group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          Back to Home
        </button>

        {/* Background glow for the login section */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-white/5 rounded-full blur-[120px] pointer-events-none opacity-50" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-5xl rounded-[24px] md:rounded-[32px] overflow-hidden flex flex-col-reverse md:flex-row shadow-2xl relative z-10 bg-black/60 border border-white/10 backdrop-blur-3xl"
        >
          {/* Left Side: Form */}
          <div className="w-full md:w-1/2 p-8 sm:p-10 md:p-14 flex flex-col justify-center relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/10 rounded-full blur-[100px] pointer-events-none" />
            
            <div className="mb-10">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg bg-white">
                  <FileText size={20} className="text-black" />
                </div>
                <span className="text-xl font-800 text-white tracking-tight">PageDocx</span>
              </div>
              
              <h1 className="text-4xl font-800 text-white mb-3 tracking-tight">Welcome back</h1>
              <p className="text-zinc-400 text-[15px] leading-relaxed">
                Sign in to access your tools, view history, and process documents securely.
              </p>
            </div>

            {/* ── Google ── */}
            <button
              onClick={handleGoogleSignIn}
              disabled={isRedirecting || googleLoading || msLoading}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-zinc-100 text-black px-6 py-4 rounded-2xl font-bold text-[15px] transition-all duration-200 shadow-xl hover:shadow-white/10 mb-3 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {googleLoading || isRedirecting ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> {isRedirecting ? "Redirecting…" : "Signing in…"}</>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </>
              )}
            </button>

            {/* ── Microsoft ── */}
            <button
              onClick={handleMicrosoftSignIn}
              disabled={isRedirecting || googleLoading || msLoading}
              className="w-full flex items-center justify-center gap-3 bg-[#2f2f2f] hover:bg-[#3c3c3c] text-[#fff] px-6 py-4 rounded-2xl font-bold text-[15px] transition-all duration-200 shadow-xl hover:shadow-white/5 mb-8 disabled:opacity-60 disabled:cursor-not-allowed border border-white/10"
            >
              {msLoading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Signing in…</>
              ) : (
                <>
                  {/* Official Microsoft logo SVG */}
                  <svg viewBox="0 0 21 21" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
                    <rect x="1"  y="1"  width="9" height="9" fill="#f25022"/>
                    <rect x="11" y="1"  width="9" height="9" fill="#7fba00"/>
                    <rect x="1"  y="11" width="9" height="9" fill="#00a4ef"/>
                    <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
                  </svg>
                  Continue with Microsoft
                </>
              )}
            </button>

            <div className="relative mb-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-800"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#111111] px-4 text-zinc-500 font-600 tracking-widest rounded-full">Secure Login</span>
              </div>
            </div>

            <div className="space-y-4 text-sm text-zinc-400">
              <div className="flex items-center gap-3">
                <Shield size={16} className="text-zinc-500" />
                <p>End-to-end encryption for your documents</p>
              </div>
              <div className="flex items-center gap-3">
                <Lock size={16} className="text-zinc-500" />
                <p>We never store your passwords</p>
              </div>
            </div>
          </div>

          {/* Right Side: Promotion Image */}
          <div className="w-full md:w-1/2 relative min-h-[250px] sm:min-h-[350px] md:min-h-[600px] overflow-hidden bg-[#0A0D14]">
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent z-10" />
            <img 
              src={loginPromo} 
              alt="PageDocx Premium" 
              decoding="sync"
              fetchpriority="high"
              loading="eager"
              className="absolute inset-0 w-full h-full object-cover object-center transform scale-105 hover:scale-100 transition-transform duration-1000 ease-out"
            />
            
            <div className="absolute inset-0 z-20 flex flex-col justify-end p-8 md:p-14">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-md mb-4 md:mb-6 w-fit">
                <Zap size={14} className="text-yellow-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-white">Supercharge Workflow</span>
              </div>
              
              <h2 className="text-2xl md:text-3xl font-800 text-white mb-4 md:mb-6 leading-tight">
                Unlock the full potential of your documents.
              </h2>
              
              <div className="hidden sm:grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                {features.map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-2.5">
                    <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-zinc-300 font-500">{feature}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 cursor-pointer opacity-60 hover:opacity-100 transition-opacity"
          onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })}
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">Discover More</span>
          <ChevronDown size={20} className="text-zinc-400 animate-bounce" />
        </motion.div>
      </div>

      {/* ── Additional Promotions Section ── */}
      <div className="py-24 md:py-32 px-4 relative z-10 bg-[#0A0D14] border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          
          <div className="text-center mb-16 md:mb-24">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-6">
              <Sparkles size={16} className="text-zinc-300" />
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-300">Enterprise Grade Features</span>
            </div>
            <h2 className="text-3xl md:text-5xl lg:text-6xl font-800 text-white mb-6 tracking-tight">More than just a PDF tool.</h2>
            <p className="text-zinc-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
              Experience the next generation of document management with powerful features designed for modern professionals.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {/* Feature 1 */}
            <motion.div whileHover={{ y: -8 }} className="bg-[#111111] border border-white/10 p-8 lg:p-10 rounded-[32px] hover:bg-[#161616] transition-colors duration-300 group">
              <div className="w-14 h-14 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-300">
                <Brain size={24} />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">AI-Powered Analysis</h3>
              <p className="text-zinc-400 text-[15px] leading-relaxed">
                Chat with your PDFs, extract structured data, and generate instant summaries using advanced AI models built directly into your workflow.
              </p>
            </motion.div>
            
            {/* Feature 2 */}
            <motion.div whileHover={{ y: -8 }} className="bg-[#111111] border border-white/10 p-8 lg:p-10 rounded-[32px] hover:bg-[#161616] transition-colors duration-300 group">
              <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-300">
                <Lock size={24} />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Bank-Grade Security</h3>
              <p className="text-zinc-400 text-[15px] leading-relaxed">
                Your files are processed securely and deleted automatically. We prioritize your privacy with enterprise-level, end-to-end encryption protocols.
              </p>
            </motion.div>
            
            {/* Feature 3 */}
            <motion.div whileHover={{ y: -8 }} className="bg-[#111111] border border-white/10 p-8 lg:p-10 rounded-[32px] hover:bg-[#161616] transition-colors duration-300 group">
              <div className="w-14 h-14 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-300">
                <Zap size={24} />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Lightning Fast</h3>
              <p className="text-zinc-400 text-[15px] leading-relaxed">
                Built on a highly optimized edge architecture. Convert, compress, rotate, and edit massive documents in milliseconds without breaking a sweat.
              </p>
            </motion.div>
          </div>
          
        </div>
      </div>

      {/* ── Interactive Features Showcase & Live Statistics Hub ── */}
      <div className="py-24 md:py-32 px-4 relative z-10 bg-black border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 mb-6">
              <Sparkles size={14} className="text-purple-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Interactive Workspace</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-800 text-white tracking-tight mb-4">Experience the suite in action</h2>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto leading-relaxed">
              Explore how our suite of tools works together to streamline your workflow before you even log in.
            </p>
          </div>

          {/* Interactive tabs */}
          <div className="flex flex-wrap justify-center gap-3 mb-12">
            {[
              { id: "ai", label: "AI Copilot", icon: Brain, color: "text-blue-400", bg: "bg-blue-500/10" },
              { id: "editor", label: "Visual Canvas", icon: FileText, color: "text-purple-400", bg: "bg-purple-500/10" },
              { id: "sign", label: "Secure Signatures", icon: Shield, color: "text-emerald-400", bg: "bg-emerald-500/10" }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeShowcaseTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveShowcaseTab(tab.id)}
                  className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all duration-300 cursor-pointer ${
                    isActive 
                      ? "bg-white text-black shadow-xl scale-105" 
                      : "bg-[#111] text-zinc-400 hover:text-white border border-white/5 hover:border-white/10"
                  }`}
                >
                  <Icon size={16} className={isActive ? "text-black" : tab.color} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Showcase Screen Simulator */}
          <div className="relative max-w-4xl mx-auto rounded-[32px] border border-white/10 bg-[#0c0e14] p-2 shadow-2xl shadow-purple-900/5 mb-24 overflow-hidden">
            {/* Screen Header mock */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#090b10] rounded-t-[26px]">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/40" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/40" />
                <div className="w-3 h-3 rounded-full bg-green-500/40" />
              </div>
              <span className="text-[10px] font-mono tracking-widest text-zinc-600 uppercase">workspace_simulation_v2.0</span>
              <div className="w-12 h-1 bg-white/5 rounded-full" />
            </div>

            {/* Content preview changes based on selected tab */}
            <div className="p-6 md:p-8 min-h-[300px] flex items-center justify-center relative">
              {activeShowcaseTab === "ai" && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="w-full max-w-lg space-y-4 font-sans text-left"
                >
                  <div className="flex items-end gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0 border border-white/5">
                      <span className="text-xs font-bold text-zinc-400">USR</span>
                    </div>
                    <div className="bg-[#181a20] border border-white/5 rounded-2xl rounded-bl-none p-4 text-sm text-zinc-300 max-w-[85%] shadow-lg">
                      Summarize the key clauses in this 15-page lease agreement.
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center shrink-0 shadow-lg shadow-purple-500/20 border border-purple-500/20">
                      <Brain size={14} className="text-white" />
                    </div>
                    <div className="bg-gradient-to-br from-[#1b1c2b] to-[#12131f] border border-purple-500/20 rounded-2xl rounded-tl-none p-5 text-sm text-zinc-200 max-w-[85%] shadow-xl space-y-3">
                      <div className="flex items-center gap-2 text-xs text-purple-400 font-bold uppercase tracking-wider">
                        <Sparkles size={12} className="animate-pulse" />
                        AI Agent Analysis Complete
                      </div>
                      <ul className="space-y-2 list-disc list-inside text-zinc-300 font-medium">
                        <li><strong className="text-white">Term:</strong> 24 months, starting Oct 1st, 2026.</li>
                        <li><strong className="text-white">Rent Escalation:</strong> 3.5% increase annually at month 12.</li>
                        <li><strong className="text-white">Early Termination:</strong> Requires 90 days prior written notice.</li>
                      </ul>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }} 
                          animate={{ width: "100%" }} 
                          transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1 }}
                          className="h-full bg-gradient-to-r from-blue-500 to-purple-500" 
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeShowcaseTab === "editor" && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full max-w-xl bg-white text-black p-6 md:p-8 rounded-2xl shadow-2xl relative overflow-hidden flex flex-col gap-4"
                >
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">PDF Document Preview</span>
                    <span className="text-[10px] bg-zinc-100 px-2 py-0.5 rounded font-mono text-zinc-600">Page 1 of 4</span>
                  </div>

                  <div className="space-y-2 text-left">
                    <h3 className="font-extrabold text-lg text-zinc-900">Employment Contract</h3>
                    <p className="text-xs text-zinc-600 leading-relaxed">
                      This Agreement is made on this day, between PageDocx Inc. and the Employee. The employee shall perform the duties of the role under the supervision of the Chief Operating Officer.
                    </p>
                  </div>

                  <div className="relative border border-dashed border-purple-500/50 bg-purple-50/40 p-4 rounded-xl flex items-center justify-between text-left">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-[9px] font-black text-purple-600 uppercase tracking-widest">
                        <Sparkles size={10} /> Active Visual Edit
                      </div>
                      <div className="text-sm font-extrabold text-zinc-800">
                        Title: <span className="bg-purple-100/80 px-1.5 py-0.5 rounded border border-purple-200">Senior Staff Engineer</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="px-3 py-1 bg-purple-600 text-white rounded-lg text-xs font-bold shadow-md hover:bg-purple-700 transition-colors">
                        Apply
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeShowcaseTab === "sign" && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="w-full max-w-sm bg-[#11131a] border border-white/5 p-6 rounded-3xl text-center shadow-xl space-y-6"
                >
                  <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Shield size={28} className="animate-pulse" />
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-extrabold text-white">SmartSign Verification</h4>
                    <p className="text-xs text-zinc-500">Document cryptographically sealed & verified</p>
                  </div>

                  <div className="bg-[#181a22] border border-white/5 p-4 rounded-2xl flex items-center justify-between text-left">
                    <div className="space-y-0.5">
                      <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">Signer Identity</span>
                      <p className="text-xs font-bold text-white">Deepak Prajapati</p>
                      <p className="text-[9px] font-mono text-zinc-500">SHA256: d48d0a7...7075dc9</p>
                    </div>
                    <div className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                      <Check size={10} /> Certified
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {/* Statistics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto border-t border-white/5 pt-16">
            {[
              { value: "1.4M+", label: "Documents Handled", desc: "Across all PDF conversions" },
              { value: "99.9%", label: "System Uptime", desc: "Highly optimized architecture" },
              { value: "4.8/5.0", label: "User Rating", desc: "From thousands of reviews" },
              { value: "35 min", label: "Avg. Time Saved", desc: "Per user daily workflow" }
            ].map((stat, idx) => (
              <div key={idx} className="text-center md:text-left space-y-2">
                <span className="text-4xl md:text-5xl font-black text-white tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent">
                  {stat.value}
                </span>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-zinc-300">{stat.label}</h4>
                  <p className="text-xs text-zinc-600">{stat.desc}</p>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
      
      {/* Universal Footer */}
      <Footer onAboutClick={onAboutClick} onToolClick={onToolClick} onContactClick={onContactClick} onTermsClick={onTermsClick} onPrivacyClick={onPrivacyClick} />
    </div>
  );
}
