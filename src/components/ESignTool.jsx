import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import FileUpload from "./FileUpload";
import ESignCreator from "./ESignCreator";
import ESignEditor from "./ESignEditor";
import ESignWorkflowEditor from "./ESignWorkflowEditor";
import ProcessingOverlay from "./ProcessingOverlay";
import { 
  Download, FileSignature, User, Briefcase, Building2, 
  PenLine, Share2, CheckCircle2, Clipboard, Clock, ListFilter,
  Plus, Settings, Link, FileText, Check, ExternalLink, ShieldCheck, HelpCircle
} from "lucide-react";
import { 
  auth, db, collection, addDoc, Timestamp, doc, getDoc, setDoc, 
  query, where, onSnapshot, orderBy 
} from "../firebase";
import { useAuthState } from "react-firebase-hooks/auth";

export default function ESignTool({ onBack }) {
  // Navigation & Mode states
  const [flowMode, setFlowMode] = useState("quick_sign"); // 'quick_sign' or 'workflow'
  const [workflowSubView, setWorkflowSubView] = useState("dashboard"); // 'dashboard' | 'setup' | 'signer'
  
  // Quick Sign state
  const [files, setFiles] = useState([]);
  const [signatureData, setSignatureData] = useState(null); // composite base64 PNG
  const [sigProfile, setSigProfile] = useState(null);     // { fullName, designation, company }
  const [showEditor, setShowEditor] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultFile, setResultFile] = useState(null);

  // Workflow states
  const [user] = useAuthState(auth);
  const [savedSignature, setSavedSignature] = useState(null);
  const [loadingSavedSig, setLoadingSavedSig] = useState(false);

  // Setup form states
  const [userAEmail, setUserAEmail] = useState("");
  const [userBEmail, setUserBEmail] = useState("");
  const [showWorkflowEditor, setShowWorkflowEditor] = useState(false);

  // Active workflow list state
  const [workflowsList, setWorkflowsList] = useState([]);
  const [loadingWorkflows, setLoadingWorkflows] = useState(false);

  // Shared signer panel states
  const [sharedDocId, setSharedDocId] = useState(null);
  const [sharedRole, setSharedRole] = useState(null);
  const [currentSharedDoc, setCurrentSharedDoc] = useState(null);
  const [showSignerCreator, setShowSignerCreator] = useState(false);
  
  // ── Load saved profile signature ──
  useEffect(() => {
    async function loadSignature() {
      try {
        const guestRaw = localStorage.getItem("pdf_master_guest_sig");
        if (guestRaw) setSavedSignature(JSON.parse(guestRaw));
      } catch {}

      if (user) {
        setLoadingSavedSig(true);
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists() && userDoc.data().savedSignature) {
            setSavedSignature(userDoc.data().savedSignature);
          }
        } catch (err) {
          console.error("Error fetching user signature:", err);
        } finally {
          setLoadingSavedSig(false);
        }
      }
    }
    loadSignature();
  }, [user]);

  // ── Check if URL contains query parameter for signing workflow ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const esignDocId = params.get("esignDocId");
    const role = params.get("role");
    
    if (esignDocId && role) {
      setFlowMode("workflow");
      setWorkflowSubView("signer");
      setSharedDocId(esignDocId);
      setSharedRole(role);
    }
  }, []);

  // ── Load workflows related to the user ──
  useEffect(() => {
    if (!user || flowMode !== "workflow") return;

    setLoadingWorkflows(true);
    const q = query(
      collection(db, "esign_documents"),
      where("creatorUid", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setWorkflowsList(docs);
      setLoadingWorkflows(false);
    }, (error) => {
      console.error("Error loading signing workflows: ", error);
      setLoadingWorkflows(false);
    });

    return () => unsubscribe();
  }, [user, flowMode]);

  // ── Load the active shared document if in signer mode ──
  useEffect(() => {
    if (!sharedDocId || workflowSubView !== "signer") return;

    const docRef = doc(db, "esign_documents", sharedDocId);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setCurrentSharedDoc({ id: docSnap.id, ...docSnap.data() });
      } else {
        toast.error("Document workflow not found.");
      }
    });

    return () => unsubscribe();
  }, [sharedDocId, workflowSubView]);

  const handleFilesAdded = (newFiles) => setFiles(prev => [...prev, ...newFiles]);
  const handleFileRemoved = (index) => { 
    setFiles(prev => prev.filter((_, i) => i !== index)); 
    setResultFile(null); 
  };

  // ── Save newly created signature to profile ──
  const handleSaveSignature = async (compositeDataUrl, profile) => {
    setSignatureData(compositeDataUrl);
    const newSig = {
      dataUrl: compositeDataUrl,
      fullName: profile.fullName,
      designation: profile.designation,
      company: profile.company,
      updatedAt: Timestamp.now(),
    };

    if (user) {
      try {
        const userDocRef = doc(db, "users", user.uid);
        await setDoc(userDocRef, { savedSignature: newSig }, { merge: true });
        setSavedSignature(newSig);
        toast.success("Signature saved to your profile permanently!");
      } catch (err) {
        console.error("Error saving signature:", err);
        toast.error("Could not save signature to profile.");
      }
    } else {
      try {
        localStorage.setItem("pdf_master_guest_sig", JSON.stringify(newSig));
        setSavedSignature(newSig);
        toast.info("Signature saved locally.");
      } catch {}
    }

    setSigProfile(profile);
    setShowEditor(true);
  };

  // ── Use the already-saved profile signature ──
  const handleUseSavedSignature = () => {
    if (!savedSignature) return;
    setSignatureData(savedSignature.dataUrl);
    setSigProfile({
      fullName: savedSignature.fullName ?? "",
      designation: savedSignature.designation ?? "",
      company: savedSignature.company ?? "",
    });
    setShowEditor(true);
    toast.success("Using your saved signature!");
  };

  // ── Embed signature into PDF (Single User Mode) ──
  const handleApplySignature = async (formattedSigs) => {
    setShowEditor(false);
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append("files", files[0]);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) throw new Error("File upload failed.");
      const { files: uploadedFiles } = await uploadRes.json();
      const fileId = uploadedFiles[0].id;

      const res = await fetch("/api/pdf/esign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId, signatures: formattedSigs }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "E-Sign request failed.");
      }

      const result = await res.json();
      setResultFile(result);

      if (user) {
        try {
          await addDoc(collection(db, "history"), {
            userId: user.uid,
            toolId: "E-Sign",
            fileName: result.name || "signed.pdf",
            fileSize: result.size || 0,
            timestamp: Timestamp.now(),
            downloadUrl: `/api/download/${result.id}`,
          });
        } catch {}
      }

      toast.success("PDF signed & encrypted successfully!");
    } catch (err) {
      console.error(err);
      toast.error(err.message || "An error occurred while signing the PDF.");
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Setup & Launch Multi-Party Workflow ──
  const handleOpenWorkflowBuilder = () => {
    if (files.length === 0) {
      toast.error("Please upload a PDF document first.");
      return;
    }
    if (!userAEmail.trim() || !userBEmail.trim()) {
      toast.error("Please specify email addresses for both User A and User B.");
      return;
    }
    if (!savedSignature) {
      toast.error("Please set up your own saved signature profile first.");
      return;
    }
    setShowWorkflowEditor(true);
  };

  const handleLaunchWorkflow = async (placeholders) => {
    setShowWorkflowEditor(false);
    setIsProcessing(true);
    try {
      // 1. Upload base file
      const formData = new FormData();
      formData.append("files", files[0]);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) throw new Error("Document upload failed.");
      const { files: uploadedFiles } = await uploadRes.json();
      const uploadedFileId = uploadedFiles[0].id;

      // 2. Generate new document UUID
      const docId = `wflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // 3. Write document workflow record to Firestore
      const newDoc = {
        id: docId,
        fileName: files[0].name,
        fileId: uploadedFileId,
        originalFileId: uploadedFileId,
        creatorUid: user.uid,
        creatorEmail: user.email || "creator@example.com",
        creatorName: user.displayName || "Creator",
        status: "pending",
        signerEmails: [userAEmail.trim(), userBEmail.trim()],
        creatorSignatureTemplate: savedSignature,
        placeholders: {
          userA: {
            pageIndex: placeholders.userA.pageIndex,
            pdfX: placeholders.userA.pdfX,
            pdfY: placeholders.userA.pdfY,
            pdfWidth: placeholders.userA.pdfWidth,
            pdfHeight: placeholders.userA.pdfHeight,
            status: "pending",
            signedAt: null
          },
          userB: {
            pageIndex: placeholders.userB.pageIndex,
            pdfX: placeholders.userB.pdfX,
            pdfY: placeholders.userB.pdfY,
            pdfWidth: placeholders.userB.pdfWidth,
            pdfHeight: placeholders.userB.pdfHeight,
            status: "pending",
            signedAt: null
          },
          creator: {
            pageIndex: placeholders.creator.pageIndex,
            pdfX: placeholders.creator.pdfX,
            pdfY: placeholders.creator.pdfY,
            pdfWidth: placeholders.creator.pdfWidth,
            pdfHeight: placeholders.creator.pdfHeight
          }
        },
        auditLog: [
          {
            event: "Workflow Created",
            timestamp: Timestamp.now(),
            details: `Automated workflow configured by ${user.displayName || user.email}`
          }
        ],
        createdAt: Timestamp.now()
      };

      await setDoc(doc(db, "esign_documents", docId), newDoc);
      
      // Trigger local backend notify mocks for demonstration
      const localBase = window.location.origin;
      const linkA = `${localBase}/?esignDocId=${docId}&role=User A`;
      const linkB = `${localBase}/?esignDocId=${docId}&role=User B`;

      await fetch("/api/pdf/esign/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docId,
          signerEmail: userAEmail.trim(),
          shareLink: linkA,
          docName: files[0].name
        })
      });

      await fetch("/api/pdf/esign/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docId,
          signerEmail: userBEmail.trim(),
          shareLink: linkB,
          docName: files[0].name
        })
      });

      toast.success("E-Sign Workflow launched successfully!");
      setFiles([]);
      setUserAEmail("");
      setUserBEmail("");
      setWorkflowSubView("dashboard");
    } catch (err) {
      console.error(err);
      toast.error("Failed to start workflow: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Signer Application Flow ──
  const handleApplySignerSignature = async (compositeDataUrl, profile) => {
    setShowSignerCreator(false);
    setIsProcessing(true);

    try {
      const activeRole = sharedRole === "User A" ? "userA" : "userB";
      const placeholder = currentSharedDoc.placeholders[activeRole];

      // 1. Prepare User's Signature payload
      const signerSigObj = {
        pageIndex: placeholder.pageIndex,
        pdfX: placeholder.pdfX,
        pdfY: placeholder.pdfY,
        pdfWidth: placeholder.pdfWidth,
        pdfHeight: placeholder.pdfHeight,
        imageData: compositeDataUrl,
        signerName: profile.fullName,
        showDate: true,
        showBadge: true,
        date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
      };

      // 2. Prepare signatures array for the backend call
      const signaturesPayload = [signerSigObj];
      let docStatus = currentSharedDoc.status;
      let auditEvents = [
        {
          event: `${sharedRole} Signed`,
          timestamp: Timestamp.now(),
          details: `Signed by ${profile.fullName} (${sharedRole})`
        }
      ];

      // 3. AUTO-APPLY CHECK:
      // If User B is signing (or if this signature completes all manual steps),
      // fetch Creator's pre-saved template from document structure and automatically stamp it!
      const userBPlaceholder = currentSharedDoc.placeholders.userB;
      const isUserBActive = activeRole === "userB";
      const isUserASigned = currentSharedDoc.placeholders.userA.status === "signed";

      const finalStageReached = isUserBActive || (activeRole === "userA" && userBPlaceholder.status === "signed");

      if (finalStageReached) {
        const creatorTemplate = currentSharedDoc.creatorSignatureTemplate;
        const creatorPlaceholder = currentSharedDoc.placeholders.creator;

        // Auto-application payload
        const creatorSigObj = {
          pageIndex: creatorPlaceholder.pageIndex,
          pdfX: creatorPlaceholder.pdfX,
          pdfY: creatorPlaceholder.pdfY,
          pdfWidth: creatorPlaceholder.pdfWidth,
          pdfHeight: creatorPlaceholder.pdfHeight,
          imageData: creatorTemplate.dataUrl,
          signerName: `${creatorTemplate.fullName} (auto-applied per template)`,
          showDate: true,
          showBadge: true,
          date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
        };

        signaturesPayload.push(creatorSigObj);
        docStatus = "completed";

        auditEvents.push({
          event: "Creator Signature Auto-Applied",
          timestamp: Timestamp.now(),
          details: `Your Signature (auto-applied per template) - embedded at final stage`
        });
      } else {
        docStatus = "in_progress";
      }

      // 4. Submit signing requests to backend
      const res = await fetch("/api/pdf/esign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId: currentSharedDoc.fileId,
          signatures: signaturesPayload
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "E-Sign request failed.");
      }

      const result = await res.json();

      // 5. Update FireStore Document State
      const docRef = doc(db, "esign_documents", currentSharedDoc.id);
      
      const updatedPlaceholders = { ...currentSharedDoc.placeholders };
      updatedPlaceholders[activeRole] = {
        ...updatedPlaceholders[activeRole],
        status: "signed",
        signedAt: Timestamp.now()
      };

      await setDoc(docRef, {
        fileId: result.id, // Replace with signed PDF ID
        status: docStatus,
        placeholders: updatedPlaceholders,
        auditLog: [...currentSharedDoc.auditLog, ...auditEvents]
      }, { merge: true });

      toast.success("Document signed successfully!");
      if (docStatus === "completed") {
        toast.info("Workflow complete. Creator's signature template automatically applied!");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to sign: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async (fileId, name) => {
    try {
      const res = await fetch(`/api/download/${fileId}`);
      if (!res.ok) throw new Error("Failed to download file");
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", name || "signed.pdf");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download error:", err);
      toast.error("Failed to download document.");
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Link copied to clipboard!");
  };

  // ── RENDER COMPONENT: Quick Sign Layout ──
  const renderQuickSign = () => (
    <div className="space-y-6">
      {!resultFile ? (
        <div className="space-y-6">
          <FileUpload
            files={files}
            onFilesAdded={handleFilesAdded}
            onFileRemoved={handleFileRemoved}
            accept={{ "application/pdf": [".pdf"] }}
            multiple={false}
          />

          {files.length > 0 && (
            <div className="animate-in fade-in slide-in-from-bottom-2">
              {loadingSavedSig ? (
                <div className="glass-card rounded-3xl p-8 max-w-2xl mx-auto text-center">
                  <div className="w-8 h-8 border-2 border-zinc-700 border-t-violet-500 rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-zinc-500 text-sm">Loading signature profile…</p>
                </div>
              ) : savedSignature ? (
                <div className="glass-card rounded-3xl p-6 md:p-8 max-w-2xl mx-auto space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
                      <CheckCircle2 size={18} className="text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-base leading-tight">Saved Signature Profile</h3>
                      <p className="text-zinc-500 text-xs mt-0.5">This signature will be applied to your document.</p>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-4 shadow-inner border border-zinc-100 mx-auto max-w-[380px] overflow-hidden">
                    <img src={savedSignature.dataUrl} alt="Saved" className="w-full max-w-full h-auto max-h-[72px] object-contain block mx-auto" />
                    <div className="border-t border-gray-200 mt-3 mb-3" />
                    {savedSignature.fullName && <p className="font-bold text-gray-900 text-[15px] leading-tight text-center">{savedSignature.fullName}</p>}
                    {(savedSignature.designation || savedSignature.company) && (
                      <p className="text-gray-500 text-[12px] mt-0.5 text-center">
                        {[savedSignature.designation, savedSignature.company].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 justify-center">
                    {savedSignature.fullName && <span className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-zinc-400 text-xs font-medium flex items-center gap-1.5"><User size={11} /> {savedSignature.fullName}</span>}
                    {savedSignature.designation && <span className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-zinc-400 text-xs font-medium flex items-center gap-1.5"><Briefcase size={11} /> {savedSignature.designation}</span>}
                    {savedSignature.company && <span className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-zinc-400 text-xs font-medium flex items-center gap-1.5"><Building2 size={11} /> {savedSignature.company}</span>}
                  </div>

                  <button onClick={handleUseSavedSignature} className="btn-primary w-full justify-center gap-2 py-3.5">
                    <FileSignature size={16} /> Proceed to Sign Document
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-3">
                      <PenLine size={20} className="text-violet-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Set Up Your Signature Profile</h3>
                    <p className="text-xs text-zinc-500 max-w-md mx-auto">
                      Create your professional signature once — it's saved permanently to your profile and reused on all future documents.
                    </p>
                  </div>
                  <ESignCreator onSave={handleSaveSignature} prefillName={user?.displayName ?? ""} />
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Quick Sign Success */
        <div className="glass-card rounded-3xl p-8 text-center max-w-md mx-auto space-y-6 animate-in fade-in zoom-in-95" ref={el => el?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-lg">
            <FileSignature size={28} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white tracking-tight">Document Signed!</h3>
            <p className="text-xs text-zinc-500 mt-1">Encrypted & locked. Ready for download.</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-left space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-500 uppercase tracking-wider font-bold">Document:</span>
              <span className="text-zinc-300 font-bold max-w-[180px] truncate">{files[0]?.name}</span>
            </div>
            {savedSignature?.fullName && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500 uppercase tracking-wider font-bold">Signed by:</span>
                <span className="text-zinc-300 font-bold">{savedSignature.fullName}</span>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <button onClick={() => handleDownload(resultFile.id, resultFile.name)} className="btn-primary w-full justify-center gap-2">
              <Download size={16} /> Download Signed PDF
            </button>
            <button onClick={() => { setFiles([]); setResultFile(null); setSignatureData(null); }} className="px-6 py-3 rounded-full text-zinc-500 hover:text-white text-xs font-bold transition-colors">
              Sign another document
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // ── RENDER COMPONENT: Workflow Setup & Dashboard ──
  const renderWorkflow = () => {
    if (workflowSubView === "setup") {
      return (
        <div className="space-y-6 max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
            <div>
              <h3 className="text-xl font-bold text-white">Create Multi-Party Signing Workflow</h3>
              <p className="text-zinc-500 text-xs mt-0.5">Define signers, select template, and place signature blocks on the PDF.</p>
            </div>
            <button 
              onClick={() => setWorkflowSubView("dashboard")} 
              className="text-zinc-500 hover:text-white text-xs font-bold bg-white/5 border border-white/10 rounded-xl px-4 py-2"
            >
              Cancel
            </button>
          </div>

          {/* Form */}
          <div className="glass-card rounded-3xl p-6 space-y-6">
            <FileUpload
              files={files}
              onFilesAdded={handleFilesAdded}
              onFileRemoved={handleFileRemoved}
              accept={{ "application/pdf": [".pdf"] }}
              multiple={false}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400">Signer A (User A) Email</label>
                <input
                  type="email"
                  value={userAEmail}
                  onChange={(e) => setUserAEmail(e.target.value)}
                  placeholder="usera@example.com"
                  className="input-field"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400">Signer B (User B) Email</label>
                <input
                  type="email"
                  value={userBEmail}
                  onChange={(e) => setUserBEmail(e.target.value)}
                  placeholder="userb@example.com"
                  className="input-field"
                />
              </div>
            </div>

            {/* Template Profile Verification */}
            <div className="bg-zinc-950/60 rounded-2xl border border-white/5 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <p className="text-white text-xs font-bold">Auto-Applied Creator Signature Template</p>
                  <p className="text-zinc-500 text-[10px] mt-0.5">
                    {savedSignature ? `Configured: ${savedSignature.fullName}` : "No template found. Please create a signature."}
                  </p>
                </div>
              </div>
              {!savedSignature && (
                <button
                  onClick={() => { setFlowMode("quick_sign"); }}
                  className="shrink-0 text-violet-400 hover:text-violet-300 text-xs font-bold border border-violet-500/20 hover:border-violet-500/40 bg-violet-500/5 px-3 py-1.5 rounded-xl transition-all"
                >
                  Create Template
                </button>
              )}
            </div>

            <button
              onClick={handleOpenWorkflowBuilder}
              disabled={files.length === 0 || !userAEmail || !userBEmail || !savedSignature}
              className="btn-primary w-full justify-center gap-2 py-3.5"
            >
              <PenLine size={16} /> Place Signatures & Launch
            </button>
          </div>
        </div>
      );
    }

    if (workflowSubView === "signer") {
      if (!currentSharedDoc) {
        return (
          <div className="glass-card rounded-3xl p-12 text-center max-w-md mx-auto">
            <div className="w-8 h-8 border-2 border-zinc-700 border-t-violet-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-zinc-500 text-sm">Loading shared signing document…</p>
          </div>
        );
      }

      const activeRole = sharedRole === "User A" ? "userA" : "userB";
      const isSigned = currentSharedDoc.placeholders[activeRole].status === "signed";
      
      return (
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Header */}
          <div className="glass-card rounded-3xl p-6 md:p-8 space-y-6 border-b border-white/5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <FileText size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white leading-tight">{currentSharedDoc.fileName}</h3>
                  <p className="text-zinc-500 text-xs mt-1">Requested by: <span className="text-zinc-300 font-semibold">{currentSharedDoc.creatorEmail}</span></p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-zinc-800 text-indigo-400 px-3 py-1 rounded-full border border-white/5">
                  Role: {sharedRole}
                </span>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full ${
                  isSigned ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                }`}>
                  Status: {isSigned ? "SIGNED" : "PENDING YOUR SIGNATURE"}
                </span>
              </div>
            </div>

            {/* Workflow steps visual trail */}
            <div className="grid grid-cols-3 gap-2 pt-2">
              {["User A", "User B", "Creator"].map((role, idx) => {
                const isCompleted = role === "Creator" 
                  ? currentSharedDoc.status === "completed" 
                  : currentSharedDoc.placeholders[role === "User A" ? "userA" : "userB"].status === "signed";
                return (
                  <div key={role} className={`rounded-xl p-3 border text-center ${
                    isCompleted 
                      ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400" 
                      : "bg-white/2 border-white/5 text-zinc-500"
                  }`}>
                    <p className="text-[10px] font-black uppercase tracking-wider">{role}</p>
                    <p className="text-[9px] font-semibold mt-0.5">{isCompleted ? "Completed" : (role === "Creator" ? "Auto-Apply" : "Pending")}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Card */}
          <div className="glass-card rounded-3xl p-8 text-center space-y-6">
            {isSigned ? (
              <div className="space-y-4">
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 size={24} />
                </div>
                <h4 className="text-lg font-bold text-white">Signature Embedded Successfully</h4>
                <p className="text-zinc-500 text-xs max-w-sm mx-auto">
                  Your signing stage is complete! The document will be finalized automatically when all other parties have completed their signature block.
                </p>
                <div className="pt-4 border-t border-white/5 flex gap-2 justify-center">
                  {currentSharedDoc.status === "completed" && (
                    <button
                      onClick={() => handleDownload(currentSharedDoc.fileId, currentSharedDoc.fileName)}
                      className="btn-primary justify-center gap-2 py-3"
                    >
                      <Download size={14} /> Download Final Signed PDF
                    </button>
                  )}
                  <button 
                    onClick={() => {
                      const params = new URLSearchParams(window.location.search);
                      params.delete("esignDocId");
                      params.delete("role");
                      window.history.pushState({}, "", "/");
                      setWorkflowSubView("dashboard");
                    }} 
                    className="text-zinc-400 hover:text-white text-xs font-bold bg-white/5 border border-white/10 rounded-full px-5 py-3"
                  >
                    Go to E-Sign Dashboard
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-3 text-indigo-400">
                    <PenLine size={22} />
                  </div>
                  <h4 className="text-lg font-bold text-white">Place Your Digital Signature</h4>
                  <p className="text-zinc-500 text-xs max-w-sm mx-auto mt-1">
                    Draw or type your signature below. It will be positioned at the exact location designated on the document.
                  </p>
                </div>

                <div className="max-w-md mx-auto">
                  <ESignCreator 
                    onSave={handleApplySignerSignature} 
                    prefillName={""} 
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Default Dashboard view
    return (
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-5">
          <div>
            <h3 className="text-xl font-bold text-white tracking-tight">E-Sign Workflow Pipeline</h3>
            <p className="text-zinc-500 text-xs mt-0.5">Automated multi-signer PDF signing streams with zero manual template overhead.</p>
          </div>
          <button
            onClick={() => setWorkflowSubView("setup")}
            disabled={!savedSignature}
            className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-violet-500/20"
          >
            <Plus size={16} /> Set Up New Workflow
          </button>
        </div>

        {/* Saved template alert banner */}
        {!savedSignature && (
          <div className="rounded-2xl border border-dashed border-violet-500/30 bg-violet-500/5 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex gap-3">
              <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 shrink-0">
                <Settings size={18} />
              </div>
              <div>
                <p className="text-violet-300 text-xs font-bold leading-tight">Signature Template Required</p>
                <p className="text-zinc-500 text-[11px] mt-1 leading-relaxed">
                  To launch automated signature workflows, you must set up your signature template first. Create one in the "Quick Sign" mode!
                </p>
              </div>
            </div>
            <button
              onClick={() => setFlowMode("quick_sign")}
              className="shrink-0 text-white hover:text-black hover:bg-white text-xs font-bold border border-white/10 hover:border-white bg-white/5 px-4 py-2 rounded-xl transition-all"
            >
              Configure Template
            </button>
          </div>
        )}

        {/* Dashboard table / list */}
        <div className="bg-[#161618] border border-white/5 rounded-2xl overflow-hidden">
          {loadingWorkflows ? (
            <div className="py-16 text-center">
              <div className="w-8 h-8 border-2 border-zinc-700 border-t-violet-500 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-zinc-500 text-sm">Fetching document streams…</p>
            </div>
          ) : workflowsList.length === 0 ? (
            <div className="py-20 text-center">
              <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4 text-zinc-500">
                <Clock size={24} />
              </div>
              <h4 className="text-white font-bold text-sm">No Active Document Streams</h4>
              <p className="text-zinc-600 text-xs mt-1 max-w-xs mx-auto leading-relaxed">
                Click "Set Up New Workflow" above to configure a multi-signer document pipeline.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {workflowsList.map((docItem) => {
                const statusColors = {
                  pending: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
                  in_progress: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
                  completed: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                };

                const localBase = window.location.origin;
                const linkA = `${localBase}/?esignDocId=${docItem.id}&role=User A`;
                const linkB = `${localBase}/?esignDocId=${docItem.id}&role=User B`;

                return (
                  <div key={docItem.id} className="p-5 md:p-6 space-y-4 hover:bg-white/[0.01] transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 bg-red-500/10 rounded-lg flex items-center justify-center text-red-400 shrink-0">
                          <FileText size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-white text-sm font-bold truncate">{docItem.fileName}</p>
                          <p className="text-zinc-500 text-[10px] mt-0.5">
                            Created {docItem.createdAt?.toDate ? docItem.createdAt.toDate().toLocaleDateString() : "N/A"}
                          </p>
                        </div>
                      </div>
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${statusColors[docItem.status] || ""}`}>
                        {docItem.status.replace("_", " ")}
                      </span>
                    </div>

                    {/* Progress grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="bg-zinc-950/40 rounded-xl p-3 border border-white/5">
                        <p className="text-zinc-500 text-[9px] font-black uppercase tracking-wider">User A (Signer 1)</p>
                        <p className="text-white text-xs font-bold truncate mt-0.5">{docItem.signerEmails[0]}</p>
                        <span className={`inline-block text-[8px] font-bold uppercase mt-2 px-1.5 py-0.5 rounded ${
                          docItem.placeholders.userA.status === "signed" ? "bg-emerald-500/15 text-emerald-400" : "bg-yellow-500/15 text-yellow-400"
                        }`}>
                          {docItem.placeholders.userA.status === "signed" ? "Signed" : "Pending"}
                        </span>
                      </div>
                      <div className="bg-zinc-950/40 rounded-xl p-3 border border-white/5">
                        <p className="text-zinc-500 text-[9px] font-black uppercase tracking-wider">User B (Signer 2)</p>
                        <p className="text-white text-xs font-bold truncate mt-0.5">{docItem.signerEmails[1]}</p>
                        <span className={`inline-block text-[8px] font-bold uppercase mt-2 px-1.5 py-0.5 rounded ${
                          docItem.placeholders.userB.status === "signed" ? "bg-emerald-500/15 text-emerald-400" : "bg-yellow-500/15 text-yellow-400"
                        }`}>
                          {docItem.placeholders.userB.status === "signed" ? "Signed" : "Pending"}
                        </span>
                      </div>
                      <div className="bg-zinc-950/40 rounded-xl p-3 border border-white/5">
                        <p className="text-zinc-500 text-[9px] font-black uppercase tracking-wider">Creator Signature</p>
                        <p className="text-white text-xs font-bold truncate mt-0.5">{docItem.creatorSignatureTemplate?.fullName || "Template Setup"}</p>
                        <span className={`inline-block text-[8px] font-bold uppercase mt-2 px-1.5 py-0.5 rounded ${
                          docItem.status === "completed" ? "bg-emerald-500/15 text-emerald-400" : "bg-violet-500/15 text-violet-400"
                        }`}>
                          {docItem.status === "completed" ? "Auto-Applied" : "Will Auto-Apply"}
                        </span>
                      </div>
                    </div>

                    {/* Actions and Audit Log dropdown */}
                    <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-white/5">
                      {/* Copy link buttons */}
                      <div className="flex gap-2">
                        {docItem.status !== "completed" && (
                          <>
                            <button
                              onClick={() => copyToClipboard(linkA)}
                              className="flex items-center gap-1 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white text-[10px] font-bold px-3 py-1.5 rounded-lg border border-white/5 transition-colors"
                            >
                              <Link size={10} /> Link A
                            </button>
                            <button
                              onClick={() => copyToClipboard(linkB)}
                              className="flex items-center gap-1 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white text-[10px] font-bold px-3 py-1.5 rounded-lg border border-white/5 transition-colors"
                            >
                              <Link size={10} /> Link B
                            </button>
                          </>
                        )}
                        {docItem.status === "completed" && (
                          <button
                            onClick={() => handleDownload(docItem.fileId, docItem.fileName)}
                            className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-bold px-4 py-1.5 rounded-lg shadow-md transition-colors"
                          >
                            <Download size={11} /> Download PDF
                          </button>
                        )}
                      </div>

                      {/* Audit Log Display */}
                      <div className="w-full sm:w-auto text-left sm:text-right space-y-1">
                        <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Audit Trail</p>
                        <div className="max-h-[80px] overflow-y-auto space-y-1 text-[10px] text-zinc-400 leading-normal scrollbar-thin">
                          {docItem.auditLog?.map((log, index) => (
                            <div key={index} className="flex items-center gap-1">
                              <Check size={9} className="text-emerald-400" />
                              <span>{log.details}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {isProcessing && <ProcessingOverlay progress={50} status="Embedding signatures and completing document steps…" />}

      {/* Workflow placeholder builder editor overlay */}
      {showWorkflowEditor && files.length > 0 && (
        <ESignWorkflowEditor
          file={files[0]}
          userAEmail={userAEmail}
          userBEmail={userBEmail}
          onClose={() => setShowWorkflowEditor(false)}
          onSave={handleLaunchWorkflow}
        />
      )}

      {/* Editor overlay for Quick Sign */}
      {showEditor && signatureData && files.length > 0 && (
        <ESignEditor
          file={files[0]}
          signatureData={signatureData}
          sigProfile={sigProfile}
          onClose={() => setShowEditor(false)}
          onSave={handleApplySignature}
        />
      )}

      {/* ── Mode Selection Header (only shown if not in shared signing panel) ── */}
      {workflowSubView !== "signer" && (
        <div className="flex gap-1 p-1 bg-black/40 rounded-2xl max-w-md mx-auto mb-8 border border-white/5">
          <button
            onClick={() => setFlowMode("quick_sign")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              flowMode === "quick_sign" ? "bg-white text-black shadow-lg" : "text-zinc-400 hover:text-white"
            }`}
          >
            <PenLine size={13} /> Quick Sign (Self)
          </button>
          <button
            onClick={() => setFlowMode("workflow")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              flowMode === "workflow" ? "bg-white text-black shadow-lg" : "text-zinc-400 hover:text-white"
            }`}
          >
            <Clock size={13} /> Multi-Party Workflow
          </button>
        </div>
      )}

      {/* Render selected flow view */}
      {flowMode === "quick_sign" ? renderQuickSign() : renderWorkflow()}
    </div>
  );
}
