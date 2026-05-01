import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { History as HistoryIcon, Download, Trash2, Clock, FileText, Sparkles } from "lucide-react";
import { auth, db, collection, query, where, orderBy, onSnapshot, Timestamp, handleFirestoreError, OperationType } from "../firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { format } from "date-fns";

export default function Dashboard() {
  const [user] = useAuthState(auth);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

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
          <HistoryIcon size={24} className="text-white" />
        </div>
        <p className="text-zinc-500 text-sm">Please sign in to view your dashboard.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-36 pb-24 px-4 md:px-6">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-10">
          <div>
            <p className="section-label mb-1">My Account</p>
            <h1 className="text-3xl font-800 text-white tracking-tight">Dashboard</h1>
            <p className="text-zinc-500 text-sm mt-1">View and download your processed files.</p>
          </div>
          <div className="flex items-center gap-4 p-5 rounded-2xl" style={{ background: "rgba(24,24,27,0.7)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <HistoryIcon size={22} className="text-white" />
            </div>
            <div>
              <p className="text-white font-800 text-2xl leading-none">{history.length}</p>
              <p className="text-zinc-500 text-xs mt-1 uppercase tracking-widest font-600">Files Processed</p>
            </div>
          </div>
        </div>

        {/* Table card */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(24,24,27,0.7)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <div className="px-6 py-4 flex items-center gap-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
            <Clock size={15} className="text-white" />
            <h2 className="text-sm font-700 text-white">Recent Activity</h2>
          </div>

          <div className="overflow-x-auto">
            {/* Desktop Table */}
            <table className="w-full text-left hidden md:table">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                  {["File Name", "Tool Used", "Date", ""].map((h, i) => (
                    <th key={i} className={`px-6 py-3 text-[10px] font-700 uppercase tracking-widest text-zinc-600 ${i === 3 ? "text-right" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="px-6 py-20 text-center text-zinc-600 text-sm">Loading...</td></tr>
                ) : history.length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-20 text-center text-zinc-600 text-sm">No files processed yet. Try a tool!</td></tr>
                ) : (
                  history.map((item) => (
                    <tr key={item.id} className="group transition-colors" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                      onMouseEnter={e => (e.currentTarget).style.background = "rgba(255,255,255,0.02)"}
                      onMouseLeave={e => (e.currentTarget).style.background = ""}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                            <FileText size={14} className="text-white" />
                          </div>
                          <span className="text-white text-sm font-500 truncate max-w-[200px]">{item.fileName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-600 px-2.5 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.05)", color: "#a1a1aa", border: "1px solid rgba(255,255,255,0.1)" }}>{item.toolId}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-zinc-500 text-xs">
                          {item.timestamp?.toDate ? format(item.timestamp.toDate(), "MMM dd, yyyy · HH:mm") : "N/A"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => { const l = document.createElement('a'); l.href = item.downloadUrl; l.setAttribute('download', item.fileName); document.body.appendChild(l); l.click(); document.body.removeChild(l); }}
                          className="w-8 h-8 rounded-lg flex items-center justify-center ml-auto transition-all text-zinc-500 hover:text-white"
                          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                          onMouseEnter={e => { (e.currentTarget).style.background = "rgba(255,255,255,0.1)"; (e.currentTarget).style.borderColor = "rgba(255,255,255,0.2)"; }}
                          onMouseLeave={e => { (e.currentTarget).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget).style.borderColor = "rgba(255,255,255,0.1)"; }}
                        >
                          <Download size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Mobile Cards */}
            <div className="md:hidden">
              {loading ? (
                <div className="px-6 py-20 text-center text-zinc-600 text-sm">Loading...</div>
              ) : history.length === 0 ? (
                <div className="px-6 py-20 text-center text-zinc-600 text-sm">No files yet. Try a tool!</div>
              ) : (
                history.map((item) => (
                  <div key={item.id} className="p-5 flex items-center gap-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                      <FileText size={18} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-600 truncate">{item.fileName}</p>
                      <p className="text-zinc-500 text-xs mt-0.5 flex items-center gap-1.5">
                        <Clock size={10} />
                        {item.timestamp?.toDate ? format(item.timestamp.toDate(), "MMM dd, yyyy") : "N/A"}
                      </p>
                    </div>
                    <button
                      onClick={() => { const l = document.createElement('a'); l.href = item.downloadUrl; l.setAttribute('download', item.fileName); document.body.appendChild(l); l.click(); document.body.removeChild(l); }}
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white hover:text-zinc-300 transition-all"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                    >
                      <Download size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
