"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
import { formatDistanceToNow } from "date-fns";
import { DollarSign, CheckCircle, XCircle, Clock } from "lucide-react";
import Pagination from "@/components/Pagination";
import { DateRangeFilter, SortToggle, ScrollBody, rangeToParams, type DateRangeValue, type SortDir } from "@/components/TableControls";

interface RefundTicket {
  id: string;
  ticket_number: string;
  subject: string;
  rider_name: string;
  rider_phone: string;
  booking_id: string | null;
  refund_amount: number | null;
  refund_status: string | null;
  priority: string;
  created_at: string;
  description: string;
}

const PAGE_SIZE = 50;

export default function RefundsPage() {
  const [tickets, setTickets] = useState<RefundTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [dateRange, setDateRange] = useState<DateRangeValue>({ range: "all_time" });
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [approveModal, setApproveModal] = useState<RefundTicket | null>(null);
  const [rejectModal, setRejectModal] = useState<RefundTicket | null>(null);
  const [approveAmount, setApproveAmount] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState(false);

  const fetchRefunds = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/gogoo/support/tickets", {
        params: { type: "refund_request", ...rangeToParams(dateRange), sort: sortDir },
      });
      setTickets(res.data.tickets || []);
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [dateRange, sortDir]);

  useEffect(() => { fetchRefunds(); }, [fetchRefunds]);
  useEffect(() => { setPage(1); }, [tab, dateRange, sortDir]);

  const pending = tickets.filter(t => !t.refund_status || t.refund_status === "pending");
  const approved = tickets.filter(t => t.refund_status === "approved");
  const rejected = tickets.filter(t => t.refund_status === "rejected");

  const tabTickets = tab === "pending" ? pending : tab === "approved" ? approved : rejected;
  const paginated = tabTickets.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalPendingAmount = pending.reduce((acc, t) => acc + (t.refund_amount || 0), 0);

  const processRefund = async (ticket: RefundTicket, action: "approve" | "reject") => {
    setProcessing(true);
    try {
      await api.post(`/gogoo/support/tickets/${ticket.id}/refund`, {
        action,
        amount: action === "approve" ? parseFloat(approveAmount) || ticket.refund_amount || 0 : 0,
        reason: action === "reject" ? rejectReason : "",
      });
      toast.success(`Refund ${action}d`);
      setApproveModal(null);
      setRejectModal(null);
      setApproveAmount("");
      setRejectReason("");
      fetchRefunds();
    } catch {
      toast.error("Failed to process refund");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1"><Clock size={15} className="text-yellow-500" /></div>
          <div className="text-2xl font-bold text-yellow-600">{pending.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Pending</div>
          {totalPendingAmount > 0 && <div className="text-xs text-yellow-600 font-medium mt-1">₹{totalPendingAmount} total</div>}
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1"><CheckCircle size={15} className="text-green-500" /></div>
          <div className="text-2xl font-bold text-green-600">{approved.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Approved</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1"><XCircle size={15} className="text-red-500" /></div>
          <div className="text-2xl font-bold text-red-600">{rejected.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Rejected</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1"><DollarSign size={15} className="text-purple-500" /></div>
          <div className="text-2xl font-bold text-purple-600">₹{approved.reduce((a, t) => a + (t.refund_amount || 0), 0)}</div>
          <div className="text-xs text-gray-500 mt-0.5">Total Approved</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {([["pending", "Pending"], ["approved", "Approved"], ["rejected", "Rejected"]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === key ? "bg-white text-purple-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              {label}
            </button>
          ))}
        </div>
        <SortToggle value={sortDir} onChange={setSortDir} />
      </div>

      {/* Date range filter */}
      <DateRangeFilter value={dateRange} onChange={setDateRange} />

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <ScrollBody>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
            <tr>
              {["#", "Ticket", "Rider", "Booking", "Amount", "Reason", "Priority", "Requested", ...(tab === "pending" ? ["Actions"] : ["Status"])].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading
              ? Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array(9).fill(0).map((__, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded" /></td>)}
                  </tr>
                ))
              : paginated.length === 0
              ? <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">No {tab} refunds</td></tr>
              : paginated.map((t, i) => (
                  <tr key={t.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 text-xs text-gray-400 font-medium">{(page - 1) * PAGE_SIZE + i + 1}</td>
                    <td className="px-4 py-3 font-mono text-xs text-purple-600">{t.ticket_number}</td>
                    <td className="px-4 py-3 text-xs">
                      <div className="font-medium text-gray-800">{t.rider_name || "—"}</div>
                      <div className="text-gray-400">{t.rider_phone || ""}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {t.booking_id ? `#${t.booking_id.slice(0, 8)}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-800">
                      {t.refund_amount ? `₹${t.refund_amount}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 max-w-[200px]">
                      <p className="truncate">{t.subject}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${t.priority === "urgent" ? "bg-red-100 text-red-700" : t.priority === "high" ? "bg-orange-100 text-orange-700" : "bg-yellow-100 text-yellow-700"}`}>
                        {t.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {t.created_at ? formatDistanceToNow(new Date(t.created_at), { addSuffix: true }) : "—"}
                    </td>
                    {tab === "pending" ? (
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setApproveModal(t); setApproveAmount(String(t.refund_amount || "")); }}
                            className="text-xs bg-green-600 text-white px-2.5 py-1 rounded-lg hover:bg-green-700 font-medium"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setRejectModal(t)}
                            className="text-xs border border-red-200 text-red-600 px-2.5 py-1 rounded-lg hover:bg-red-50 font-medium"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    ) : (
                      <td className="px-4 py-3">
                        <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${t.refund_status === "approved" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {t.refund_status}
                        </span>
                      </td>
                    )}
                  </tr>
                ))
            }
          </tbody>
        </table>
        </ScrollBody>
        {tabTickets.length > PAGE_SIZE && (
          <div className="border-t border-gray-100 px-4 py-3">
            <Pagination total={tabTickets.length} pageSize={PAGE_SIZE} current={page} onChange={setPage} />
          </div>
        )}
      </div>

      {/* Approve Modal */}
      {approveModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Approve Refund</h3>
            <p className="text-sm text-gray-500">{approveModal.ticket_number} · {approveModal.rider_name}</p>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Refund Amount (₹)</label>
              <input
                type="number"
                value={approveAmount}
                onChange={e => setApproveAmount(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Enter amount..."
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Refund Method</label>
              <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                <option>Original Payment</option>
                <option>Wallet</option>
                <option>Cash</option>
              </select>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setApproveModal(null)} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={() => processRefund(approveModal, "approve")} disabled={processing}
                className="flex-1 bg-green-600 text-white rounded-xl py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-60">
                {processing ? "Processing…" : "Confirm Approval"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Reject Refund</h3>
            <p className="text-sm text-gray-500">{rejectModal.ticket_number} · {rejectModal.rider_name}</p>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Reason for rejection</label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Explain why the refund is being rejected..."
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setRejectModal(null)} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={() => processRefund(rejectModal, "reject")} disabled={processing}
                className="flex-1 bg-red-600 text-white rounded-xl py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-60">
                {processing ? "Processing…" : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
