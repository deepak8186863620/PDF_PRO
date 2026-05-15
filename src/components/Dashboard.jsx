import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  Download, Clock, FileText, Sparkles, Settings, 
  ArrowRight, Files, Image as ImageIcon, Home, 
  Folder, Search, MoreVertical, Plus, Edit, 
  Minimize2, Scissors, Shield, FileSearch, Share2
} from "lucide-react";
import { auth, db, collection, query, where, orderBy, onSnapshot, handleFirestoreError, OperationType } from "../firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { format } from "date-fns";

export default function Dashboard({ onNavigateHome, onSelectTool }) {
  const [user] = useAuthState(auth);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "history"),
      where("userId", "==", user.uid),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setHistory(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "history");
    });

    return () => unsubscribe();
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-screen pt-40 flex flex-col items-center justify-center gap-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <Clock size={24} className="text-white" />
        </div>
        <p className="text-zinc-500 text-sm">Please sign in to view your dashboard.</p>
      </div>
    );
  }

  const quickTools = [
    { id: "edit-pdf", name: "Edit PDF", icon: <Edit size={26} strokeWidth={2} />, gradient: "from-indigo-500 via-purple-500 to-pink-500", iconColor: "text-indigo-400", iconBg: "bg-indigo-500/10" },
    { id: "compress-pdf", name: "Compress", icon: <Minimize2 size={26} strokeWidth={2} />, gradient: "from-emerald-400 via-teal-500 to-cyan-500", iconColor: "text-emerald-400", iconBg: "bg-emerald-500/10" },
    { id: "merge-pdf", name: "Merge", icon: <Files size={26} strokeWidth={2} />, gradient: "from-orange-500 via-rose-500 to-pink-500", iconColor: "text-orange-400", iconBg: "bg-orange-500/10" },
    { id: "split-pdf", name: "Split", icon: <Scissors size={26} strokeWidth={2} />, gradient: "from-blue-500 via-indigo-500 to-purple-500", iconColor: "text-blue-400", iconBg: "bg-blue-500/10" },
    { id: "pdf-to-jpg", name: "To Image", icon: <ImageIcon size={26} strokeWidth={2} />, gradient: "from-fuchsia-500 via-purple-600 to-indigo-500", iconColor: "text-fuchsia-400", iconBg: "bg-fuchsia-500/10" },
    { id: "ocr-pdf", name: "OCR", icon: <FileSearch size={26} strokeWidth={2} />, gradient: "from-cyan-400 via-blue-500 to-indigo-500", iconColor: "text-cyan-400", iconBg: "bg-cyan-500/10" },
  ];

  const filteredHistory = history.filter(item => 
    item.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.toolId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleShare = async (item) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: item.fileName,
          text: `Check out this document: ${item.fileName}`,
          url: item.downloadUrl,
        });
      } catch (error) {
        console.error('Error sharing document:', error);
      }
    } else {
      try {
        await navigator.clipboard.writeText(item.downloadUrl);
        alert('Link copied to clipboard!');
      } catch (err) {
        console.error('Failed to copy text: ', err);
      }
    }
  };

  return (
    <div className="min-h-screen pt-20 flex bg-[#0f0f11]">
      
      {/* Premium Sidebar */}
      <div className="w-[260px] border-r border-white/5 hidden lg:flex flex-col fixed left-0 top-20 bottom-0 bg-[#09090b] z-10 pt-6">
        
        {/* Upload Button */}
        <div className="px-5 mb-8">
          <button onClick={onNavigateHome} className="relative w-full group overflow-hidden rounded-xl p-[1px]">
             <span className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-xl opacity-70 group-hover:opacity-100 transition-opacity duration-500"></span>
             <div className="relative bg-[#09090b] px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all group-hover:bg-opacity-0">
               <Plus size={18} className="text-white group-hover:text-white transition-colors" /> 
               <span className="font-600 text-sm text-white group-hover:text-white transition-colors">Upload a file</span>
             </div>
          </button>
        </div>
        
        {/* Navigation */}
        <div className="px-3 mb-8 space-y-1">
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/10 text-white font-500 transition-colors">
            <Home size={18} className="text-white" strokeWidth={2} />
            <span className="text-sm">Home</span>
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-zinc-400 hover:bg-white/5 hover:text-zinc-200 font-500 transition-colors group">
            <Folder size={18} className="text-zinc-500 group-hover:text-zinc-300" strokeWidth={2} />
            <span className="text-sm">Documents</span>
          </button>
        </div>

        {/* Favorite Tools */}
        <div className="px-3 flex-1">
          <div className="text-[11px] font-700 text-zinc-500 uppercase tracking-widest mb-3 px-3">Favorite Tools</div>
          <div className="space-y-1">
             <button onClick={() => onSelectTool('edit-pdf')} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-zinc-400 hover:bg-white/5 hover:text-white transition-all group">
               <div className="w-6 h-6 rounded-md bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                  <Edit size={14} strokeWidth={2.5} />
               </div>
               <span className="text-sm font-500">Edit text & images</span>
             </button>
             <button onClick={() => onSelectTool('compress-pdf')} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-zinc-400 hover:bg-white/5 hover:text-white transition-all group">
               <div className="w-6 h-6 rounded-md bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                  <Minimize2 size={14} strokeWidth={2.5} />
               </div>
               <span className="text-sm font-500">Compress a PDF</span>
             </button>
             <button onClick={onNavigateHome} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-zinc-400 hover:bg-white/5 hover:text-white transition-all group">
               <div className="w-6 h-6 rounded-md bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                  <FileText size={14} strokeWidth={2.5} />
               </div>
               <span className="text-sm font-500">Convert a PDF</span>
             </button>
             <button onClick={() => onSelectTool('lock-pdf')} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-zinc-400 hover:bg-white/5 hover:text-white transition-all group">
               <div className="w-6 h-6 rounded-md bg-rose-500/10 flex items-center justify-center text-rose-400 group-hover:bg-rose-500 group-hover:text-white transition-colors">
                  <Shield size={14} strokeWidth={2.5} />
               </div>
               <span className="text-sm font-500">Protect PDF</span>
             </button>
          </div>
        </div>

        {/* Bottom User Profile */}
        <div className="p-4 mt-auto border-t border-white/5 bg-[#09090b]">
           <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-purple-500/20">
                 {user?.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="flex-1 min-w-0">
                 <p className="text-sm font-600 text-white truncate">{user?.displayName || 'User'}</p>
                 <p className="text-xs text-zinc-500 truncate">Pro Member</p>
              </div>
           </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 lg:ml-64 px-4 sm:px-8 py-8 w-full max-w-[1200px] mx-auto">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
           <h1 className="text-2xl sm:text-3xl font-400 text-white mb-10 tracking-tight">
             Welcome, {user.displayName ? user.displayName.split(' ')[0] : 'User'}
           </h1>
        </motion.div>

        {/* Recommended Tools List */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="mb-12">
          <div className="flex justify-between items-end mb-4">
            <h2 className="text-[13px] font-600 text-zinc-400 uppercase tracking-wider">Recommended tools</h2>
            <button onClick={onNavigateHome} className="text-sm text-blue-400 hover:text-blue-300 font-500 flex items-center gap-1 transition-colors">
              View all tools <ArrowRight size={14} />
            </button>
          </div>
          
          <div className="flex gap-4 overflow-x-auto pb-8 pt-4 px-2 -mx-2 scrollbar-hide snap-x">
            {quickTools.map((tool, i) => (
              <button 
                key={i} 
                onClick={() => onSelectTool(tool.id)} 
                className="relative min-w-[140px] sm:min-w-[160px] h-[150px] snap-start group rounded-[24px] p-[1px] transition-all duration-300 hover:-translate-y-1.5"
              >
                {/* Glow behind the card */}
                <span className={`absolute inset-0 bg-gradient-to-br ${tool.gradient} rounded-[24px] opacity-0 group-hover:opacity-40 transition-opacity duration-500 blur-xl`}></span>
                
                {/* Border gradient */}
                <span className={`absolute inset-0 bg-gradient-to-br ${tool.gradient} rounded-[24px] opacity-30 group-hover:opacity-100 transition-opacity duration-500`}></span>
                
                {/* Inner Card */}
                <div className="relative h-full w-full bg-[#121214] rounded-[23px] p-5 flex flex-col items-start justify-between transition-all duration-300">
                  <div className={`p-3 rounded-2xl ${tool.iconBg} ${tool.iconColor} transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3`}>
                     {tool.icon}
                  </div>
                  <div className="w-full text-left">
                     <span className="text-lg font-700 tracking-tight text-white leading-tight block">{tool.name}</span>
                     <span className={`text-xs font-500 bg-clip-text text-transparent bg-gradient-to-r ${tool.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}>Launch tool &rarr;</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Recent Documents Section */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
             <h2 className="text-[13px] font-600 text-zinc-400 uppercase tracking-wider">Recent</h2>
             <div className="relative">
               <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
               <input 
                 type="text" 
                 placeholder="Search documents" 
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className="bg-[#161618] border border-white/10 rounded-full pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-white/20 w-full sm:w-64 transition-all" 
               />
             </div>
          </div>

          <div className="bg-[#161618] border border-white/5 rounded-2xl overflow-hidden">
            {/* Desktop Table View */}
            <table className="w-full text-left hidden sm:table">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-6 py-4 text-xs font-500 text-zinc-400 w-1/2">Name</th>
                  <th className="px-6 py-4 text-xs font-500 text-zinc-400">Opened</th>
                  <th className="px-6 py-4 text-xs font-500 text-zinc-400">Tool</th>
                  <th className="px-6 py-4 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="px-6 py-12 text-center text-zinc-500 text-sm">Loading documents...</td></tr>
                ) : filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-16 text-center">
                      <FileText size={32} className="mx-auto text-zinc-600 mb-3" />
                      <p className="text-zinc-400 text-sm font-500">No documents found</p>
                      <p className="text-zinc-600 text-xs mt-1">Upload a file to get started.</p>
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((item) => (
                    <tr key={item.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="text-red-400">
                             <FileText size={20} strokeWidth={1.5} />
                          </div>
                          <span className="text-zinc-200 text-sm font-400 truncate max-w-[300px]">{item.fileName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-zinc-500 text-sm">
                          {item.timestamp?.toDate ? format(item.timestamp.toDate(), "MMM dd, yyyy") : "N/A"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-zinc-400 text-sm capitalize">{item.toolId.replace('-', ' ')}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                           <button
                             onClick={() => { const l = document.createElement('a'); l.href = item.downloadUrl; l.setAttribute('download', item.fileName); document.body.appendChild(l); l.click(); document.body.removeChild(l); }}
                             className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                             title="Download"
                           >
                             <Download size={16} />
                           </button>
                           <button
                             onClick={() => handleShare(item)}
                             className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                             title="Share"
                           >
                             <Share2 size={16} />
                           </button>
                           <button className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                             <MoreVertical size={16} />
                           </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Mobile List View */}
            <div className="sm:hidden">
              {loading ? (
                <div className="px-6 py-12 text-center text-zinc-500 text-sm">Loading documents...</div>
              ) : filteredHistory.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <FileText size={32} className="mx-auto text-zinc-600 mb-3" />
                  <p className="text-zinc-400 text-sm font-500">No documents found</p>
                </div>
              ) : (
                filteredHistory.map((item) => (
                  <div key={item.id} className="p-4 border-b border-white/5 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="text-red-400 mt-1">
                         <FileText size={20} strokeWidth={1.5} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-zinc-200 text-sm font-500 truncate">{item.fileName}</p>
                        <p className="text-zinc-500 text-xs mt-1">
                          {item.timestamp?.toDate ? format(item.timestamp.toDate(), "MMM dd") : ""} • <span className="capitalize">{item.toolId.replace('-', ' ')}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleShare(item)}
                        className="p-2 text-zinc-400 hover:text-white bg-white/5 rounded-lg"
                        title="Share"
                      >
                        <Share2 size={16} />
                      </button>
                      <button
                        onClick={() => { const l = document.createElement('a'); l.href = item.downloadUrl; l.setAttribute('download', item.fileName); document.body.appendChild(l); l.click(); document.body.removeChild(l); }}
                        className="p-2 text-zinc-400 hover:text-white bg-white/5 rounded-lg"
                        title="Download"
                      >
                        <Download size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
