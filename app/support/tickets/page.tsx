"use client";
import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
import { formatDistanceToNow } from "date-fns";
import { Plus, Eye, MessageSquare } from "lucide-react";
import Pagination from "@/components/Pagination";

interface Ticket {
  id: string;
  ticket_number: string;
  type: string;
  status: string;
  priority: string;
  subject: string;
  description: string;
  raised_by: string;
  rider_name: string;
  rider_phone: string;
  driver_name: string;
  driver_phone: string;
  assigned_to: string | null;
  created_at: string;
  unread_count?: number;
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-gray-100 text-gray-600",
};
const STATUS_COLORS: Record<string, string> = {
  open: "bg-purple-100 text-purple-700",
  in_progress: "bg-blue-100 text-blue-700",
  resolved: "bg-green-100 text-green-700",
  closed: "bg-gray-100 text-gray-600",
};
const TYPE_COLORS: Record<string, string> = {
  payment_issue: "bg-red-50 text-red-600",
  booking_issue: "bg-blue-50 text-blue-600",
  rider_complaint: "bg-orange-50 text-orange-600",
  driver_complaint: "bg-yellow-50 text-yellow-700",
  refund_request: "bg-green-50 text-green-600",
  in_app_chat: "bg-purple-50 text-purple-600",
  sos: "bg-red-600 text-white",
  other: "bg-gray-50 text-gray-600",
};

const PAGE_SIZE = 50;

function TicketsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [priority, setPriority] = useState(searchParams.get("priority") || "");
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    type: "payment_issue", priority: "medium", subject: "", description: "", raised_by: "rider",
  });
  const [creating, setCreating] = useState(false);
  const prevUnreadRef = useRef(0);

  const fetchTickets = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (status) params.status = status;
      if (priority) params.priority = priority;
      if (type) params.type = type;
      const [ticketsRes, unreadRes] = await Promise.all([
        api.get("/gogoo/support/tickets", { params }),
        api.get("/gogoo/support/unread-count").catch(() => ({ data: { unread: 0 } })),
      ]);
      setTickets(ticketsRes.data.tickets || []);

      // Tab title notification for new unread messages
      const unread = unreadRes.data.unread || 0;
      if (unread > 0) {
        document.title = `(${unread}) Support Panel`;
      } else {
        document.title = "Support Panel";
      }
      if (unread > prevUnreadRef.current && prevUnreadRef.current !== -1) {
        // New message arrived — flash the title
        document.title = `🔴 New message! (${unread}) Support Panel`;
        setTimeout(() => {
          document.title = unread > 0 ? `(${unread}) Support Panel` : "Support Panel";
        }, 3000);
      }
      prevUnreadRef.current = unread;
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [status, priority, type]);

  useEffect(() => {
    prevUnreadRef.current = -1; // skip first-load flash
    fetchTickets();
  }, [fetchTickets]);

  // Auto-refresh every 10s
  useEffect(() => {
    const interval = setInterval(() => fetchTickets(true), 10000);
    return () => clearInterval(interval);
  }, [fetchTickets]);

  const isSOS = (t: Ticket) => t.type === "sos" || t.subject?.startsWith("🚨");

  const filtered = tickets
    .filter(t => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        t.ticket_number?.toLowerCase().includes(q) ||
        t.subject?.toLowerCase().includes(q) ||
        t.rider_name?.toLowerCase().includes(q) ||
        t.rider_phone?.includes(q)
      );
    })
    // SOS tickets always float to the top, regardless of the active filter —
    // Array.sort is stable, so this only reorders SOS vs. non-SOS and leaves
    // the backend's priority/created_at ordering untouched within each group.
    .sort((a, b) => Number(isSOS(b)) - Number(isSOS(a)));

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const createTicket = async () => {
    if (!form.subject.trim()) { toast.error("Subject is required"); return; }
    setCreating(true);
    try {
      await api.post("/gogoo/support/tickets", form);
      toast.success("Ticket created");
      setShowModal(false);
      setForm({ type: "payment_issue", priority: "medium", subject: "", description: "", raised_by: "rider" });
      fetchTickets();
    } catch {
      toast.error("Failed to create ticket");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-wrap gap-3 items-center">
        <div className="flex gap-1 flex-wrap">
          {["", "open", "in_progress", "resolved", "closed"].map(s => (
            <button key={s} onClick={() => { setStatus(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${status === s ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {s === "" ? "All Status" : s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
            </button>
          ))}
        </div>
        <div className="w-px h-6 bg-gray-200" />
        <div className="flex gap-1 flex-wrap">
          {["", "urgent", "high", "medium", "low"].map(p => (
            <button key={p} onClick={() => { setPriority(p); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${priority === p ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {p === "" ? "All Priority" : p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
        <div className="w-px h-6 bg-gray-200" />
        <div className="flex gap-1 flex-wrap">
          {["", "sos", "in_app_chat", "payment_issue", "booking_issue", "rider_complaint", "refund_request", "other"].map(tp => (
            <button key={tp} onClick={() => { setType(tp); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${type === tp ? "bg-purple-600 text-white" : tp === "sos" ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {tp === "" ? "All Types" : tp === "sos" ? "🚨 SOS" : tp === "in_app_chat" ? "💬 In-App Chat" : tp.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
            </button>
          ))}
        </div>
        <input
          className="ml-auto border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          placeholder="Search ticket #, subject, rider..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-purple-700 transition"
        >
          <Plus size={14} /> Create Ticket
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {["Ticket #", "Subject", "Type", "Raised By", "Priority", "Status", "Assigned", "Created", ""].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading
              ? Array(8).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array(9).fill(0).map((__, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded" /></td>
                    ))}
                  </tr>
                ))
              : paginated.length === 0
              ? <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">No tickets found</td></tr>
              : paginated.map(t => (
                  <tr key={t.id}
                    className={`transition cursor-pointer ${isSOS(t) ? "bg-red-50 hover:bg-red-100 animate-pulse" : "hover:bg-purple-50"}`}
                    onClick={() => router.push(`/support/tickets/${t.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${t.priority === "urgent" ? "bg-red-500" : t.priority === "high" ? "bg-orange-400" : t.priority === "medium" ? "bg-yellow-400" : "bg-gray-300"}`} />
                        <span className="font-mono text-xs text-gray-600">{t.ticket_number}</span>
                        {isSOS(t) && (
                          <span className="flex-shrink-0 bg-red-600 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
                            🚨 SOS
                          </span>
                        )}
                        {t.type === "in_app_chat" && <MessageSquare size={11} className="text-purple-500 flex-shrink-0" />}
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate block text-gray-800 font-medium">{t.subject?.slice(0, 40)}{(t.subject?.length || 0) > 40 ? "…" : ""}</span>
                        {(t.unread_count ?? 0) > 0 && (
                          <span className="flex-shrink-0 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                            {t.unread_count}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[t.type] || "bg-gray-50 text-gray-600"}`}>
                        {t.type === "sos" ? "🚨 SOS" : t.type === "in_app_chat" ? "💬 In-App Chat" : t.type?.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {t.raised_by === "rider"
                        ? <><div className="font-medium">{t.rider_name || "—"}</div><div className="text-gray-400">{t.rider_phone ? t.rider_phone.slice(0,2) + "XXXXX" + t.rider_phone.slice(-3) : ""}</div></>
                        : <><div className="font-medium">{t.driver_name || "—"}</div><div className="text-gray-400">{t.driver_phone ? t.driver_phone.slice(0,2) + "XXXXX" + t.driver_phone.slice(-3) : ""}</div></>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[t.priority] || "bg-gray-100 text-gray-600"}`}>
                        {t.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${STATUS_COLORS[t.status] || "bg-gray-100 text-gray-600"}`}>
                        {t.status?.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 truncate max-w-[100px]">{t.assigned_to?.split("@")[0] || "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {t.created_at ? formatDistanceToNow(new Date(t.created_at), { addSuffix: true }) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={e => { e.stopPropagation(); router.push(`/support/tickets/${t.id}`); }}
                        className="flex items-center gap-1 text-purple-600 hover:text-purple-800 text-xs font-medium"
                      >
                        <Eye size={13} /> View
                      </button>
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
        {filtered.length > PAGE_SIZE && (
          <div className="border-t border-gray-100 px-4 py-3">
            <Pagination total={filtered.length} pageSize={PAGE_SIZE} current={page} onChange={setPage} />
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Create Support Ticket</h3>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Type</label>
              <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option value="payment_issue">Payment Issue</option>
                <option value="booking_issue">Booking Issue</option>
                <option value="rider_complaint">Rider Complaint</option>
                <option value="driver_complaint">Driver Complaint</option>
                <option value="refund_request">Refund Request</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Priority</label>
              <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Raised By</label>
              <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                value={form.raised_by} onChange={e => setForm(f => ({ ...f, raised_by: e.target.value }))}>
                <option value="rider">Rider</option>
                <option value="driver">Driver</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Subject</label>
              <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Brief subject..."
                value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Description</label>
              <textarea className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                rows={3} placeholder="Details..."
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={createTicket} disabled={creating}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 disabled:opacity-60">
                {creating ? "Creating…" : "Create Ticket"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TicketsPage() {
  return (
    <Suspense>
      <TicketsContent />
    </Suspense>
  );
}
