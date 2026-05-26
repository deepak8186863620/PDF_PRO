import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X } from 'lucide-react';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Check if user already dismissed it recently
    const isDismissed = localStorage.getItem('pwa_prompt_dismissed');
    
    const handleBeforeInstallPrompt = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      
      // Show the prompt if not previously dismissed
      if (isDismissed !== 'true') {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    // Optionally, send analytics event with outcome of user choice
    console.log(`User response to the install prompt: ${outcome}`);
    
    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Remember the choice so we don't spam them
    localStorage.setItem('pwa_prompt_dismissed', 'true');
  };

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 p-4 rounded-2xl bg-[#161616] border border-[#2a2a2a] shadow-2xl flex items-start gap-4"
        >
          <div className="bg-white/10 p-3 rounded-xl flex-shrink-0">
            <Download className="text-white" size={24} />
          </div>
          <div className="flex-1">
            <h3 className="text-white font-bold text-sm mb-1">Install PDF Master Pro AI App</h3>
            <p className="text-zinc-400 text-xs mb-3">Install our app for quick access and offline features.</p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleInstallClick}
                className="bg-white text-black text-xs font-bold px-4 py-2 rounded-full hover:bg-zinc-200 transition-colors"
              >
                Install App
              </button>
              <button
                onClick={handleDismiss}
                className="text-zinc-400 text-xs font-medium px-4 py-2 rounded-full hover:bg-white/10 hover:text-white transition-colors"
              >
                Not now
              </button>
            </div>
          </div>
          <button 
            onClick={handleDismiss}
            className="absolute top-3 right-3 text-zinc-500 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
