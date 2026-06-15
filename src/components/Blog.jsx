import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { BookOpen, Calendar, Clock, ArrowLeft, Share2, Sparkles, Shield, PenTool, CheckCircle, FileText, Globe } from "lucide-react";

const ARTICLES = [
  {
    id: "how-to-sign-pdf-online",
    title: "How to Sign PDFs Online: A Step-by-Step E-Signature Guide",
    description: "Learn how to draw, type, or upload secure electronic signatures to sign contracts and forms in seconds.",
    category: "Guides",
    readTime: "4 min read",
    date: "May 25, 2026",
    icon: PenTool,
    color: "from-blue-500 to-indigo-500",
    keywords: ["Sign PDF Online", "Online E Signature", "Electronic Signature Platform"],
    content: (
      <div className="space-y-6 text-zinc-300">
        <p className="text-lg leading-relaxed text-zinc-200">
          Gone are the days of printing, signing with a pen, scanning, and emailing back a document. Today, secure digital tools allow you to sign contracts, agreements, and forms in a matter of seconds.
        </p>

        <h3 className="text-2xl font-bold text-white mt-8">Are Electronic Signatures Legally Binding?</h3>
        <p>
          Yes! Under the <strong>ESIGN Act of 2000</strong> in the United States and the <strong>eIDAS Regulation</strong> in the European Union, electronic signatures have the same legal standing as traditional ink signatures, provided they meet certain criteria:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Intent to Sign:</strong> The signer must show clear intent to sign (e.g., clicking a button or drawing a signature).</li>
          <li><strong>Consent:</strong> The parties must agree to conduct business electronically.</li>
          <li><strong>Association:</strong> The signature must be logically associated with the document.</li>
          <li><strong>Record Retention:</strong> The signed document must be stored and reproducible.</li>
        </ul>

        <h3 className="text-2xl font-bold text-white mt-8">Step-by-Step: How to Sign on PageDocx</h3>
        <p>
          PageDocx makes signing simple and secure. Here is how it works:
        </p>
        <ol className="list-decimal pl-6 space-y-3">
          <li>
            <strong>Upload your document:</strong> Choose any PDF file. It will load locally in your browser, keeping your data private.
          </li>
          <li>
            <strong>Select Signature Style:</strong>
            <ul className="list-disc pl-6 mt-1 space-y-1">
              <li><em>Draw:</em> Use your touch screen, trackpad, or mouse to draw a natural signature.</li>
              <li><em>Type:</em> Type your name and select a beautiful handwritten script font.</li>
              <li><em>Upload:</em> Upload an image of your physical signature on white paper.</li>
            </ul>
          </li>
          <li>
            <strong>Position the signature:</strong> Drag and drop the signature block anywhere on the page, and resize it to fit perfectly.
          </li>
          <li>
            <strong>Apply and Save:</strong> Click "Apply" to burn the signature securely into the document layers. Download your signed PDF instantly.
          </li>
        </ol>

        <div className="p-5 bg-zinc-900/60 border border-zinc-800 rounded-2xl flex gap-4 mt-8">
          <Shield className="text-emerald-400 shrink-0" size={24} />
          <div>
            <h4 className="font-bold text-white mb-1">Privacy Guarantee</h4>
            <p className="text-sm">
              PageDocx processes document edits and e-signatures directly inside your browser sandbox. Your signature is never uploaded to external servers unless you choose to share a document link.
            </p>
          </div>
        </div>
      </div>
    )
  },
  {
    id: "best-free-ai-pdf-editor",
    title: "Why AI-Powered PDF Editors are Redefining Document Workflows",
    description: "Discover how artificial intelligence like Gemini 2.5 Flash helps extract tables, summarize texts, and OCR scanned pages.",
    category: "AI Technology",
    readTime: "5 min read",
    date: "May 24, 2026",
    icon: Sparkles,
    color: "from-purple-500 to-pink-500",
    keywords: ["AI PDF Editor", "Free PDF Editor", "AI Document Tool"],
    content: (
      <div className="space-y-6 text-zinc-300">
        <p className="text-lg leading-relaxed text-zinc-200">
          Traditional PDF viewers only show you static pixels. AI-powered editors like PageDocx treat documents as living, interactive databases. By integrating advanced machine learning, you can now interact with text like never before.
        </p>

        <h3 className="text-2xl font-bold text-white mt-8">What Can an AI PDF Editor Do?</h3>
        <p>
          AI features are built to eliminate tedious reading and manual data extraction:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
          <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <h4 className="font-bold text-white flex items-center gap-2 mb-2">
              <Sparkles size={16} className="text-purple-400" />
              Document Chat
            </h4>
            <p className="text-sm">Ask questions, extract lists, or translate paragraphs directly from the sidebar. No need to scroll through 100 pages.</p>
          </div>
          <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <h4 className="font-bold text-white flex items-center gap-2 mb-2">
              <FileText size={16} className="text-blue-400" />
              Instant Summaries
            </h4>
            <p className="text-sm">Generate structured key takeaways, executive summaries, and action items in one click using Gemini 2.5 Flash.</p>
          </div>
          <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <h4 className="font-bold text-white flex items-center gap-2 mb-2">
              <Globe size={16} className="text-green-400" />
              Intelligent OCR
            </h4>
            <p className="text-sm">Convert photographed receipts or scanned contracts into fully searchable, editable, and copyable text layer using AI Vision.</p>
          </div>
          <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <h4 className="font-bold text-white flex items-center gap-2 mb-2">
              <Shield size={16} className="text-yellow-400" />
              Auto-Classification
            </h4>
            <p className="text-sm">Recognize form fields, tax lines, and signature regions automatically, saving hours of manual setup.</p>
          </div>
        </div>

        <h3 className="text-2xl font-bold text-white mt-8">How to Choose the Best Free PDF Editor</h3>
        <p>
          When choosing an online tool, consider these three metrics:
        </p>
        <ol className="list-decimal pl-6 space-y-3">
          <li><strong>No Limits:</strong> Avoid apps that lock core features (like large uploads or AI credits) behind paid plans. PageDocx offers free unlimited processing.</li>
          <li><strong>Speed:</strong> A fast loading, client-side editor ensures you do not waste time waiting for uploads.</li>
          <li><strong>Mobile Compatibility:</strong> Look for web tools that work seamlessly on phones, so you can sign or edit on the go.</li>
        </ol>
      </div>
    )
  },
  {
    id: "how-e-signatures-work",
    title: "Behind the Tech: How E-Signatures Work Under the Hood",
    description: "Understand the cryptography, integrity checks, and hashes that secure your documents from tampering.",
    category: "Security",
    readTime: "6 min read",
    date: "May 22, 2026",
    icon: Shield,
    color: "from-green-500 to-teal-500",
    keywords: ["Online E Signature", "Electronic Signature Platform"],
    content: (
      <div className="space-y-6 text-zinc-300">
        <p className="text-lg leading-relaxed text-zinc-200">
          An e-signature is not just an image of handwriting pasted onto a document. Under the hood, professional electronic signatures use advanced cryptography to bind the signer's identity to the exact state of the document.
        </p>

        <h3 className="text-2xl font-bold text-white mt-8">The Role of Cryptographic Hashing</h3>
        <p>
          When you click "Apply Signature" in a compliance-oriented platform:
        </p>
        <ol className="list-decimal pl-6 space-y-3">
          <li>
            <strong>Hashing the Document:</strong> The platform runs the entire PDF content through a mathematical hashing algorithm (e.g., SHA-256) to create a unique digital fingerprint. If even a single comma is changed later, the hash will change completely.
          </li>
          <li>
            <strong>Encryption:</strong> The hash is encrypted using the private key generated specifically for your signing session.
          </li>
          <li>
            <strong>Embedding:</strong> The signature metadata, including timestamp, IP address, email, and the encrypted hash, is embedded into the PDF structure.
          </li>
        </ol>

        <h3 className="text-2xl font-bold text-white mt-8">How Verification Works</h3>
        <p>
          When someone opens the signed PDF in Adobe Acrobat Reader, the software automatically recalculates the document's SHA-256 hash and decrypts the embedded signature hash. If they match, a green checkmark appears saying "Document has not been modified since signature was applied."
        </p>

        <div className="my-8 p-6 bg-zinc-950 border border-zinc-800 rounded-2xl">
          <h4 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
            <CheckCircle className="text-emerald-400" size={20} />
            Security Checklist for Business Owners
          </h4>
          <p className="text-sm mb-4">Make sure your signature platform provides:</p>
          <ul className="list-disc pl-5 text-sm space-y-2 text-zinc-400">
            <li>Tamper-evident seals on downloaded PDFs.</li>
            <li>Detailed audit trails with timestamps, emails, and IP logs.</li>
            <li>Multi-factor authentication (MFA) to verify signers.</li>
            <li>AES-256 bit encryption for secure storage.</li>
          </ul>
        </div>
      </div>
    )
  },
  {
    id: "secure-pdf-signing-guide",
    title: "The Secure PDF Signing Guide: Privacy Tips for Remote Workers",
    description: "Keep your files confidential. Read our best practices for processing financial, legal, and medical documents.",
    category: "Guides",
    readTime: "3 min read",
    date: "May 20, 2026",
    icon: FileText,
    color: "from-amber-500 to-orange-500",
    keywords: ["PDF Management Tool", "Sign PDF Online"],
    content: (
      <div className="space-y-6 text-zinc-300">
        <p className="text-lg leading-relaxed text-zinc-200">
          Remote work has accelerated the transition to digital document workflows. However, sharing contracts, tax forms, and medical records online introduces security risks. Protecting your sensitive records requires standard security practices.
        </p>

        <h3 className="text-2xl font-bold text-white mt-8">1. Beware of Cloud Uploads</h3>
        <p>
          Many free online PDF utilities upload your documents to their servers where they might sit indefinitely. Always use platforms like <strong>PageDocx</strong> that employ client-side processing, which processes pages locally in the browser memory, or guarantee auto-deletion within 30 minutes.
        </p>

        <h3 className="text-2xl font-bold text-white mt-8">2. password Protect Sensitive Files</h3>
        <p>
          Before emailing a signed contract or a financial sheet, add owner-level encryption with a strong password. This prevents unauthorized people from opening the document if the email is forwarded or compromised.
        </p>

        <h3 className="text-2xl font-bold text-white mt-8">3. Remove Metadata Before Sharing</h3>
        <p>
          PDFs store hidden metadata—author names, creation dates, device paths, and edit history. Use a PDF management tool to strip this metadata before publishing documents to public portals.
        </p>

        <h3 className="text-2xl font-bold text-white mt-8">4. Use Two-Factor E-Signatures</h3>
        <p>
          If you are requesting signatures from clients, require email or SMS verification codes. This confirms the identity of the person signing, shielding you from signature disputes later.
        </p>
      </div>
    )
  }
];

export default function Blog({ onNavigateHome }) {
  const [selectedArticle, setSelectedArticle] = useState(null);

  const handleShare = (article) => {
    const shareUrl = `${window.location.origin}/blog?article=${article.id}`;
    if (navigator.share) {
      navigator.share({
        title: article.title,
        text: article.description,
        url: shareUrl,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(shareUrl);
      alert("Article link copied to clipboard!");
    }
  };

  return (
    <div className="w-full min-h-screen text-white pt-24 pb-24 px-4 sm:px-6 lg:px-8 selection:bg-purple-500/30">
      <div className="max-w-5xl mx-auto">
        <AnimatePresence mode="wait">
          {!selectedArticle ? (
            <motion.div
              key="blog-list"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {/* Header */}
              <div className="text-center mb-16">
                <button
                  onClick={onNavigateHome}
                  className="mb-6 inline-flex items-center gap-2 text-xs uppercase tracking-widest text-zinc-400 hover:text-white transition-colors"
                >
                  <ArrowLeft size={14} /> Back to Home
                </button>
                <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 px-4 py-2 rounded-full text-xs font-bold text-purple-300 mb-6 uppercase tracking-wider">
                  <BookOpen size={14} />
                  <span>Resources & Guides</span>
                </div>
                <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white mb-4">
                  THE DOCUMENT KNOWLEDGE HUB
                </h1>
                <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
                  Master e-signatures, optimize PDF workflows, and understand AI document tools with insights from our product experts.
                </p>
              </div>

              {/* Grid of Articles */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
                {ARTICLES.map((article) => {
                  const Icon = article.icon;
                  return (
                    <div
                      key={article.id}
                      className="group bg-[#111111] hover:bg-[#161616] border border-white/10 rounded-[28px] overflow-hidden p-6 flex flex-col justify-between transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-purple-500/5 cursor-pointer"
                      onClick={() => setSelectedArticle(article)}
                    >
                      <div>
                        {/* Icon & Category */}
                        <div className="flex items-center justify-between mb-6">
                          <span className="text-xs font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-full bg-white/5 text-zinc-300 border border-white/5">
                            {article.category}
                          </span>
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br ${article.color} text-white`}>
                            <Icon size={22} />
                          </div>
                        </div>

                        <h2 className="text-xl font-bold text-white leading-snug group-hover:text-purple-300 transition-colors mb-3">
                          {article.title}
                        </h2>
                        <p className="text-zinc-400 text-[14px] leading-relaxed mb-6">
                          {article.description}
                        </p>
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-4 border-t border-white/5 text-xs text-zinc-500 font-medium">
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1">
                            <Calendar size={12} /> {article.date}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={12} /> {article.readTime}
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShare(article);
                          }}
                          className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                        >
                          <Share2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="blog-reader"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="bg-[#0A0D14] border border-white/10 rounded-[32px] overflow-hidden p-6 sm:p-10 md:p-14"
            >
              {/* Back Button */}
              <button
                onClick={() => setSelectedArticle(null)}
                className="mb-8 flex items-center gap-2 text-xs uppercase tracking-widest text-zinc-400 hover:text-white transition-colors border border-white/10 bg-white/5 px-4 py-2 rounded-full font-bold transition-all duration-300 hover:scale-105 active:scale-95 w-fit"
              >
                <ArrowLeft size={14} /> Back to Library
              </button>

              {/* Title & Metadata */}
              <div className="border-b border-white/10 pb-8 mb-8">
                <span className="text-xs font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-full bg-white/5 text-zinc-300 border border-white/5 mb-4 inline-block">
                  {selectedArticle.category}
                </span>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight mb-6">
                  {selectedArticle.title}
                </h1>
                
                <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-zinc-500 font-medium">
                  <div className="flex items-center gap-6">
                    <span className="flex items-center gap-1.5">
                      <Calendar size={14} /> {selectedArticle.date}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock size={14} /> {selectedArticle.readTime}
                    </span>
                  </div>
                  <button
                    onClick={() => handleShare(selectedArticle)}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95"
                  >
                    <Share2 size={12} /> Share Article
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="prose prose-invert max-w-none">
                {selectedArticle.content}
              </div>

              {/* Keywords Tag Cloud */}
              <div className="mt-12 pt-8 border-t border-white/10 flex flex-wrap gap-2 items-center">
                <span className="text-xs text-zinc-500 uppercase tracking-widest mr-2 font-bold">Target Keywords:</span>
                {selectedArticle.keywords.map((kw, i) => (
                  <span key={i} className="text-xs bg-purple-500/10 text-purple-300 border border-purple-500/20 px-3 py-1 rounded-full">
                    {kw}
                  </span>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
