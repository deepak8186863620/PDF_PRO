import { motion } from "motion/react";
import { Shield, EyeOff, Lock, Server } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div className="pt-32 pb-20 px-6 min-h-screen text-zinc-400">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full text-sm font-bold text-white mb-6 uppercase tracking-widest"
          >
            <Shield size={16} />
            <span>Privacy & Security</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-black tracking-tighter text-white mb-6"
          >
            Privacy Policy
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg"
          >
            Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-16"
        >
          {/* Core Principles */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white/5 border border-white/10 p-6 rounded-3xl">
              <EyeOff size={28} className="text-blue-400 mb-4" />
              <h3 className="text-white font-bold mb-2">Zero Logging</h3>
              <p className="text-sm leading-relaxed">We do not log, inspect, or analyze the contents of your documents.</p>
            </div>
            <div className="bg-white/5 border border-white/10 p-6 rounded-3xl">
              <Server size={28} className="text-emerald-400 mb-4" />
              <h3 className="text-white font-bold mb-2">Auto-Deletion</h3>
              <p className="text-sm leading-relaxed">All files are automatically permanently deleted from our servers.</p>
            </div>
            <div className="bg-white/5 border border-white/10 p-6 rounded-3xl">
              <Lock size={28} className="text-purple-400 mb-4" />
              <h3 className="text-white font-bold mb-2">Encrypted Transfers</h3>
              <p className="text-sm leading-relaxed">All uploads and downloads are secured via enterprise-grade SSL/TLS.</p>
            </div>
          </div>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">1. Information We Collect</h2>
            <p className="leading-relaxed mb-4">
              We collect minimal information necessary to provide and improve our services:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Account Information:</strong> If you choose to log in using Google Authentication, we store your basic profile information (Name, Email, Profile Picture).</li>
              <li><strong>Usage Data:</strong> We use aggregated, anonymized analytics (Google Analytics) to understand how features are used and to improve the application.</li>
              <li><strong>Files:</strong> We temporarily process files you upload strictly for the duration of the requested operation.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. File Processing and Storage</h2>
            <p className="leading-relaxed">
              When you use our tools to convert, compress, or edit documents, the files are uploaded to our secure servers or processed locally in your browser. Files uploaded to our servers are kept in memory or temporary storage solely for processing and are automatically wiped immediately upon completion or failure of the task. We do not keep backups of your files.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. AI Features</h2>
            <p className="leading-relaxed">
              Certain features, such as "Chat with PDF", "Summarize PDF", and "Extract Text (OCR)", require sending file contents to third-party AI providers (e.g., Google Vision API, Hugging Face). These API calls are made securely. We do not use your data to train our own models, and we configure our third-party integrations to prohibit them from using your data for model training wherever possible.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4. Third-Party Services</h2>
            <p className="leading-relaxed mb-4">
              We use the following trusted third-party services:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Firebase:</strong> For authentication and secure database storage of user accounts and feedback.</li>
              <li><strong>Google Analytics:</strong> For tracking app performance and usage trends.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5. Your Rights</h2>
            <p className="leading-relaxed">
              If you have created an account, you have the right to request the deletion of your account and all associated data at any time. Please contact us via the feedback form to initiate a data deletion request.
            </p>
          </section>

        </motion.div>
      </div>
    </div>
  );
}
