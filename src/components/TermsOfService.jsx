import { motion } from "motion/react";
import { ShieldAlert, FileText, CheckCircle2 } from "lucide-react";

export default function TermsOfService() {
  return (
    <div className="pt-32 pb-20 px-6 min-h-screen text-zinc-400">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full text-sm font-bold text-white mb-6 uppercase tracking-widest"
          >
            <FileText size={16} />
            <span>Legal</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-black tracking-tighter text-white mb-6"
          >
            Terms of Service
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
          className="space-y-12"
        >
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">1. Acceptance of Terms</h2>
            <p className="leading-relaxed">
              By accessing and using PDF Master ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service. We reserve the right to modify these terms at any time without prior notice.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. Description of Service</h2>
            <p className="leading-relaxed mb-4">
              PDF Master provides web-based tools for document processing, including but not limited to PDF conversion, compression, merging, splitting, and image processing.
            </p>
            <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
              <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-400" />
                Service Availability
              </h3>
              <p className="text-sm leading-relaxed">
                While we strive to provide uninterrupted service, we do not guarantee that the Service will be available at all times. We reserve the right to modify, suspend, or discontinue any part of the Service without notice.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. User Data and Privacy</h2>
            <p className="leading-relaxed">
              Your privacy is important to us. All documents processed through our servers are automatically deleted after processing is complete. We do not store, share, or analyze the content of your documents unless explicitly requested (e.g., AI chat features). For more details, please review our Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4. Acceptable Use</h2>
            <p className="leading-relaxed mb-4">
              You agree not to use the Service for any unlawful or prohibited purpose. You may not:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Upload files containing malware, viruses, or malicious code.</li>
              <li>Use the Service to process illegal, explicit, or unauthorized copyrighted materials.</li>
              <li>Attempt to bypass or exploit any security measures or limitations of the Service.</li>
              <li>Use the Service in a way that places an unreasonable load on our infrastructure.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5. Limitation of Liability</h2>
            <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-2xl flex gap-4">
              <ShieldAlert size={24} className="text-red-400 shrink-0" />
              <p className="text-sm leading-relaxed text-red-200">
                In no event shall PDF Master, its developers, or affiliates be liable for any direct, indirect, incidental, special, or consequential damages resulting from the use or inability to use the Service, including but not limited to loss of data, loss of profits, or business interruption.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">6. Intellectual Property</h2>
            <p className="leading-relaxed">
              All content, features, and functionality of the Service are owned by PDF Master and are protected by international copyright, trademark, and other intellectual property laws. You retain full ownership of any documents you process using the Service.
            </p>
          </section>
        </motion.div>
      </div>
    </div>
  );
}
