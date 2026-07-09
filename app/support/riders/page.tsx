"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { X, Copy, AlertCircle, Shield } from "lucide-react";
import Pagination from "@/components/Pagination";
import { DateRangeFilter, SortToggle, ScrollBody, rangeToParams, type DateRangeValue, type SortDir } from "@/components/TableControls";

interface Rider {
  id: string;
  name: string;
  phone: string;
  email: string;
  is_blocked: boolean;
  block_reason: string | null;
  total_rides: number;
  completed_rides: number;
  cancelled_rides: number;
  total_spent: number;
  wallet_balance: number;
  rating: number;
  created_at: string;
  last_ride_at: string | null;
}

const PAGE_SIZE = 50;

export default function RidersPage() {
  const router = useRouter();
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRangeValue>({ range: "all_time" });
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Rider | null>(null);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [blocking, setBlocking] = useState(false);

  const fetchRiders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/gogoo/riders", { params: { ...rangeToParams(dateRange), sort: sortDir } });
      setRiders(res.data.riders || res.data || []);
    } catch {
      setRiders([]);
    } finally {
      setLoading(false);
    }
  }, [dateRange, sortDir]);

  useEffect(() => { fetchRiders(); }, [fetchRiders]);
  useEffect(() => { setPage(1); }, [search, dateRange, sortDir]);

  const filtered = riders.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.name?.toLowerCase().includes(q) ||
      r.phone?.includes(q) ||
      r.email?.toLowerCase().includes(q)
    );
  });

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const blockRider = async () => {
    if (!blockReason.trim()) { toast.error("Reason required"); return; }
    if (!selected) return;
    setBlocking(true);
    try {
      await api.patch(`/gogoo/drivers/${selected.id}/block`, { block: true, reason: blockReason });
      toast.success("Rider blocked");
      setShowBlockModal(false);
      setBlockReason("");
      fetchRiders();
    } catch {
      toast.error("Failed to block rider");
    } finally {
      setBlocking(false);
    }
  };

  const unblockRider = async (rider: Rider) => {
    try {
      await api.patch(`/gogoo/drivers/${rider.id}/block`, { block: false });
      toast.success("Rider unblocked");
      fetchRiders();
    } catch {
      toast.error("Failed to unblock rider");
    }
  };

  const totalBlocked = riders.filter(r => r.is_blocked).length;

  return (
    <div className="space-y-5">
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Riders", value: riders.length },
          { label: "Active Today", value: riders.filter(r => r.last_ride_at && new Date(r.last_ride_at) > new Date(Date.now() - 86400000)).length },
          { label: "Blocked", value: totalBlocked, red: true },
        ].map(({ label, value, red }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className={`text-2xl font-bold ${red ? "text-red-600" : "text-purple-600"}`}>{loading ? "—" : value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Security Notice */}
      <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
        <AlertCircle size={15} className="text-blue-500 flex-shrink-0" />
        <p className="text-xs text-blue-700">Support access — Full contact info visible for customer assistance only.</p>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3 flex-wrap">
        <input
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 w-80"
          placeholder="Search by name, phone, email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
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
              {["#", "Name", "Phone", "Email", "Rides", "Spent", "Rating", "Status", "Last Ride", "Actions"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading
              ? Array(8).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array(10).fill(0).map((__, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded" /></td>)}
                  </tr>
                ))
              : paginated.length === 0
              ? <tr><td colSpan={10} className="px-4 py-10 text-center text-gray-400">No riders found</td></tr>
              : paginated.map((r, i) => (
                  <tr key={r.id} className="hover:bg-purple-50 transition cursor-pointer" onClick={() => setSelected(r)}>
                    <td className="px-4 py-3 text-xs text-gray-400 font-medium">{(page - 1) * PAGE_SIZE + i + 1}</td>
                    <td className="px-4 py-3 font-medium text-gray-800 text-sm">{r.name || "—"}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{r.phone || "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[140px] truncate">{r.email || "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-700">{r.total_rides || 0}</td>
                    <td className="px-4 py-3 text-xs font-medium text-gray-800">{r.total_spent > 0 ? `₹${r.total_spent}` : "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-700">{r.rating > 0 ? `⭐ ${r.rating}` : "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${r.is_blocked ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                        {r.is_blocked ? "Blocked" : "Active"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {r.last_ride_at ? format(new Date(r.last_ride_at), "MMM d") : "Never"}
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <button onClick={() => router.push(`/support/tickets?rider=${r.id}`)}
                          className="text-xs text-purple-600 border border-purple-200 px-2 py-1 rounded-lg hover:bg-purple-50 font-medium">
                          Tickets
                        </button>
                        {r.is_blocked
                          ? <button onClick={() => unblockRider(r)}
                              className="text-xs text-green-600 border border-green-200 px-2 py-1 rounded-lg hover:bg-green-50 font-medium">
                              Unblock
                            </button>
                          : <button onClick={() => { setSelected(r); setShowBlockModal(true); }}
                              className="text-xs text-red-600 border border-red-200 px-2 py-1 rounded-lg hover:bg-red-50 font-medium">
                              Block
                            </button>
                        }
                      </div>
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
        </ScrollBody>
        {filtered.length > PAGE_SIZE && (
          <div className="border-t border-gray-100 px-4 py-3">
            <Pagination total={filtered.length} pageSize={PAGE_SIZE} current={page} onChange={setPage} />
          </div>
        )}
      </div>

      {/* Side Panel */}
      {selected && !showBlockModal && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setSelected(null)} />
          <div className="relative w-[380px] bg-white h-full shadow-2xl overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">Rider Profile</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-lg flex-shrink-0">
                  {selected.name?.charAt(0) || "R"}
                </div>
                <div>
                  <p className="font-bold text-gray-900">{selected.name || "—"}</p>
                  <p className="text-xs text-gray-400">
                    Joined {selected.created_at ? format(new Date(selected.created_at), "MMMM yyyy") : "—"}
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Phone</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-800">{selected.phone || "—"}</span>
                    <button onClick={() => { navigator.clipboard.writeText(selected.phone || ""); toast.success("Copied"); }}
                      className="text-gray-400 hover:text-purple-600"><Copy size={12} /></button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Email</span>
                  <span className="font-medium text-gray-800">{selected.email || "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Rating</span>
                  <span>{selected.rating > 0 ? `⭐ ${selected.rating}` : "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Status</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${selected.is_blocked ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                    {selected.is_blocked ? "Blocked" : "Active"}
                  </span>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Ride History</p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Total", value: selected.total_rides || 0 },
                    { label: "Completed", value: selected.completed_rides || 0 },
                    { label: "Cancelled", value: selected.cancelled_rides || 0 },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
                      <div className="text-lg font-bold text-gray-800">{value}</div>
                      <div className="text-xs text-gray-500">{label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Wallet</p>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Balance</span>
                  <span className="font-semibold text-gray-800">₹{selected.wallet_balance || 0}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-gray-500">Total Spent</span>
                  <span className="font-semibold text-gray-800">₹{selected.total_spent || 0}</span>
                </div>
              </div>

              {selected.is_blocked && selected.block_reason && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Block Reason</p>
                  <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{selected.block_reason}</p>
                </div>
              )}

              <div className="border-t border-gray-100 pt-4 space-y-2">
                <button onClick={() => router.push(`/support/bookings`)}
                  className="w-full border border-gray-200 rounded-xl py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  View All Bookings
                </button>
                <button onClick={() => router.push(`/support/tickets`)}
                  className="w-full border border-purple-200 rounded-xl py-2 text-sm font-medium text-purple-600 hover:bg-purple-50">
                  Create Support Ticket
                </button>
                {selected.is_blocked
                  ? <button onClick={() => { unblockRider(selected); setSelected(null); }}
                      className="w-full border border-green-200 rounded-xl py-2 text-sm font-medium text-green-600 hover:bg-green-50">
                      Unblock Rider
                    </button>
                  : <button onClick={() => setShowBlockModal(true)}
                      className="w-full border border-red-200 rounded-xl py-2 text-sm font-medium text-red-600 hover:bg-red-50">
                      <Shield size={13} className="inline mr-1" />Block Rider
                    </button>
                }
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Block Modal */}
      {showBlockModal && selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Block Rider</h3>
            <p className="text-sm text-orange-600 font-medium">⚠ {selected.name} will be unable to use the app.</p>
            <textarea
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
              rows={3}
              placeholder="Reason for blocking (required)..."
              value={blockReason}
              onChange={e => setBlockReason(e.target.value)}
            />
            <div className="flex gap-3">
              <button onClick={() => { setShowBlockModal(false); setBlockReason(""); }} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={blockRider} disabled={blocking} className="flex-1 bg-red-600 text-white rounded-xl py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-60">
                {blocking ? "Blocking…" : "Block Rider"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
