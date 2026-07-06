"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
import { formatDistanceToNow, format } from "date-fns";
import { X, AlertCircle } from "lucide-react";
import Pagination from "@/components/Pagination";

interface Booking {
  id: string;
  status: string;
  service_type: string;
  pickup_address: string;
  drop_address: string;
  fare: number;
  created_at: string;
  otp_verified: boolean;
  cancel_reason: string;
  cancelled_by: string;
  cancellation_fee: number;
  accepted_at: string | null;
  cancelled_at: string | null;
  is_scheduled: boolean;
  scheduled_at: string | null;
  rider_name: string;
  rider_phone: string;
  driver_name: string;
  driver_phone: string;
  driver_rating: number;
  source: string;
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-sky-100 text-sky-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  active: "bg-blue-100 text-blue-700",
  pending: "bg-yellow-100 text-yellow-700",
  accepted: "bg-purple-100 text-purple-700",
};

const fmtDuration = (seconds: number) => {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  return mins < 60 ? `${mins}m ${seconds % 60}s` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

const SOURCE_COLORS: Record<string, string> = {
  app: "bg-indigo-100 text-indigo-800",
  website: "bg-teal-100 text-teal-800",
};

const PAGE_SIZE = 50;

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/gogoo/bookings");
      setBookings(res.data.bookings || res.data || []);
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const filtered = bookings.filter(b => {
    if (statusFilter && b.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        b.id?.toLowerCase().includes(q) ||
        b.rider_name?.toLowerCase().includes(q) ||
        b.driver_name?.toLowerCase().includes(q) ||
        b.rider_phone?.includes(q)
      );
    }
    return true;
  });

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const cancelBooking = async () => {
    if (!cancelReason.trim()) { toast.error("Reason required"); return; }
    if (!selected) return;
    setCancelling(true);
    try {
      await api.post(`/gogoo/support/cancel-booking/${selected.id}`, { reason: cancelReason });
      toast.success("Booking cancelled");
      setShowCancelModal(false);
      setSelected(null);
      setCancelReason("");
      fetchBookings();
    } catch {
      toast.error("Failed to cancel");
    } finally {
      setCancelling(false);
    }
  };

  const isActive = (b: Booking) => !["completed", "cancelled"].includes(b.status);

  return (
    <div className="space-y-5">
      {/* Security Notice */}
      <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
        <AlertCircle size={15} className="text-blue-500 flex-shrink-0" />
        <p className="text-xs text-blue-700">
          Support access — Phone numbers visible for customer assistance only. Do not share externally.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 flex gap-3 items-center flex-wrap">
        <input
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 w-72"
          placeholder="Search booking ID, rider, driver..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
        <div className="flex gap-1">
          {["", "scheduled", "pending", "accepted", "active", "completed", "cancelled"].map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${statusFilter === s ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {s === "" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {["Booking ID", "Service", "Rider", "Driver", "Route", "Fare", "Status", "Source", "Time", "Actions"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading
              ? Array(8).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array(10).fill(0).map((__, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded" /></td>
                    ))}
                  </tr>
                ))
              : paginated.length === 0
              ? <tr><td colSpan={10} className="px-4 py-10 text-center text-gray-400">No bookings found</td></tr>
              : paginated.map(b => (
                  <tr key={b.id} className="hover:bg-purple-50 transition cursor-pointer" onClick={() => setSelected(b)}>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">#{b.id?.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-xs text-gray-700 capitalize">{b.service_type || "Cab"}</td>
                    <td className="px-4 py-3 text-xs">
                      <div className="font-medium text-gray-800">{b.rider_name || "—"}</div>
                      <div className="text-gray-500">{b.rider_phone || "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="font-medium text-gray-800">{b.driver_name || "—"}</div>
                      <div className="text-gray-500">{b.driver_phone || "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-xs max-w-[160px]">
                      <div className="truncate text-gray-700">{b.pickup_address || "—"}</div>
                      <div className="truncate text-gray-400">{b.drop_address || "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-gray-800">{b.fare ? `₹${b.fare}` : "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${STATUS_COLORS[b.status] || "bg-gray-100 text-gray-600"}`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${SOURCE_COLORS[b.source] || "bg-indigo-100 text-indigo-800"}`}>
                        {b.source === "website" ? "Website" : "App"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {b.created_at ? formatDistanceToNow(new Date(b.created_at), { addSuffix: true }) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {isActive(b) && (
                        <button
                          onClick={e => { e.stopPropagation(); setSelected(b); setShowCancelModal(true); }}
                          className="text-xs text-orange-600 border border-orange-200 px-2.5 py-1 rounded-lg hover:bg-orange-50 font-medium"
                        >
                          Cancel
                        </button>
                      )}
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

      {/* Side Panel */}
      {selected && !showCancelModal && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setSelected(null)} />
          <div className="relative w-[420px] bg-white h-full shadow-2xl overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">Booking Detail</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Booking Info</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">ID</span><span className="font-mono text-xs">{selected.id}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Status</span><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[selected.status] || ""}`}>{selected.status}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Source</span><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SOURCE_COLORS[selected.source] || "bg-indigo-100 text-indigo-800"}`}>{selected.source === "website" ? "Website" : "App"}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Service</span><span className="capitalize">{selected.service_type || "Cab"}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Fare</span><span className="font-semibold">₹{selected.fare || 0}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">OTP</span><span>{selected.otp_verified ? "✅ Verified" : "❌ Not verified"}</span></div>
                  {selected.created_at && <div className="flex justify-between"><span className="text-gray-500">Date</span><span>{format(new Date(selected.created_at), "MMM d, yyyy h:mm a")}</span></div>}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Rider</p>
                <div className="space-y-1 text-sm">
                  <div className="font-medium text-gray-800">{selected.rider_name || "—"}</div>
                  <div className="text-gray-600">{selected.rider_phone || "—"}</div>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Driver</p>
                <div className="space-y-1 text-sm">
                  <div className="font-medium text-gray-800">{selected.driver_name || "—"}</div>
                  <div className="text-gray-600">{selected.driver_phone || "—"}</div>
                  {selected.driver_rating > 0 && <div className="text-gray-500">⭐ {selected.driver_rating}</div>}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Route</p>
                <div className="space-y-2 text-sm">
                  <div className="bg-green-50 rounded-lg px-3 py-2">
                    <span className="text-xs text-green-600 font-semibold">FROM</span>
                    <p className="text-gray-800 mt-0.5">{selected.pickup_address || "—"}</p>
                  </div>
                  <div className="bg-red-50 rounded-lg px-3 py-2">
                    <span className="text-xs text-red-600 font-semibold">TO</span>
                    <p className="text-gray-800 mt-0.5">{selected.drop_address || "—"}</p>
                  </div>
                </div>
              </div>

              {/* Scheduled ride info */}
              {selected.is_scheduled && selected.scheduled_at && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Scheduled Pickup</p>
                  <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-sm">
                    <p className="font-semibold text-sky-800">{format(new Date(selected.scheduled_at), "MMM d, yyyy h:mm a")}</p>
                    {selected.status === "scheduled" && (
                      <p className="text-xs text-sky-500 mt-1">Not yet dispatched — driver matching starts ~15 min before pickup</p>
                    )}
                  </div>
                </div>
              )}

              {/* Ambulance info — visible for ambulance bookings */}
              {(selected.service_type || "").toLowerCase().includes("ambulance") && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Ambulance Details</p>
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Type</span>
                      <span className="font-semibold">
                        {(selected as any).is_free_ambulance ? "🆓 Free (NGO)" : "💰 Paid"}
                      </span>
                    </div>
                    {(selected as any).hospital_name && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Hospital</span>
                        <span className="font-semibold">{(selected as any).hospital_name}</span>
                      </div>
                    )}
                    {(selected as any).ambulance_sub_type && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Amb. Type</span>
                        <span className="font-semibold uppercase">{(selected as any).ambulance_sub_type}</span>
                      </div>
                    )}
                    {(selected as any).patient_name && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Patient</span>
                        <span className="font-semibold">{(selected as any).patient_name}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-green-700 font-semibold">
                      <span>Commission</span>
                      <span>₹0 — Zero Commission ✅</span>
                    </div>
                  </div>
                </div>
              )}

              {selected.status === "cancelled" && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Cancellation</p>
                  <div className="bg-red-50 rounded-lg px-3 py-2 space-y-1.5 text-sm">
                    {selected.cancel_reason && <p className="text-gray-700">{selected.cancel_reason}</p>}
                    <div className="flex justify-between">
                      <span className="text-gray-500">Cancelled by</span>
                      <span className="font-medium capitalize">{selected.cancelled_by || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Cancellation fee</span>
                      <span className="font-medium">{selected.cancellation_fee > 0 ? `₹${selected.cancellation_fee}` : "Free"}</span>
                    </div>
                    {selected.accepted_at && selected.cancelled_at && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Accept → cancel</span>
                        <span className="font-medium">
                          {fmtDuration(Math.round((new Date(selected.cancelled_at).getTime() - new Date(selected.accepted_at).getTime()) / 1000))}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {isActive(selected) && (
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="w-full border border-orange-200 text-orange-600 text-sm font-medium py-2.5 rounded-xl hover:bg-orange-50 transition"
                >
                  Cancel This Booking
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Cancel Booking</h3>
            <p className="text-sm text-gray-500">Booking #{selected.id?.slice(0, 8)}</p>
            <textarea
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-500"
              rows={3}
              placeholder="Reason for cancellation (required)..."
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" defaultChecked className="rounded" />
              Notify rider via notification
            </label>
            <div className="flex gap-3">
              <button onClick={() => { setShowCancelModal(false); setCancelReason(""); }} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={cancelBooking} disabled={cancelling} className="flex-1 bg-orange-600 text-white rounded-xl py-2 text-sm font-medium hover:bg-orange-700 disabled:opacity-60">
                {cancelling ? "Cancelling…" : "Confirm Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
