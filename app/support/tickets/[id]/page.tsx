"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
import { formatDistanceToNow, format } from "date-fns";
import {
  ArrowLeft, Copy, Phone, User, Clipboard, ChevronDown,
  Send, CheckCheck, Check,
} from "lucide-react";
import OlaMap, { decodePolyline, OlaMarker } from "@/components/OlaMap";

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
  resolution: string | null;
  refund_requested: boolean;
  refund_amount: number | null;
  refund_status: string | null;
  booking_id: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

interface Message {
  id: string;
  ticket_id: string;
  sender_type: string;
  sender_id: string;
  sender_name: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface Booking {
  id: string;
  status: string;
  service_name?: string;
  pickup?: { lat: number; lng: number; address: string };
  drop?: { lat: number; lng: number; address: string };
  driver?: { lat?: number; lng?: number; name?: string; rating?: number; updated_at?: string };
  estimated_fare?: number;
  final_fare?: number;
  ride_otp?: string;
  started_at?: string;
  completed_at?: string;
}

const DRIVER_STALE_MS = 2 * 60 * 1000;

function formatAgo(ms: number): string {
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}s ago`;
  return `${Math.round(secs / 60)}m ago`;
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371, dLat = ((bLat - aLat) * Math.PI) / 180, dLng = ((bLng - aLng) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Server-side proxy — never exposes OLA_MAPS_KEY to the panel, and caches
// by rounded coordinate so repeat opens of the driver popup don't re-hit
// Ola. Called only when the popup is opened, never pre-fetched.
async function fetchAddress(lat: number, lng: number): Promise<string> {
  try {
    const res = await api.get("/gogoo/geocode/reverse", { params: { lat, lng }, timeout: 10000 });
    return res.data?.address || "";
  } catch {
    return "";
  }
}

const QUICK_REPLIES = [
  "Thank you for contacting gogoo support. We are looking into your issue and will respond shortly.",
  "We have received your complaint and have escalated it to the relevant team.",
  "Your refund has been processed and will reflect in your account within 3-5 business days.",
  "Could you please provide more details about the issue you experienced?",
  "We have resolved your issue. Please let us know if you need any further assistance.",
];

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

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [routeLine, setRouteLine] = useState<[number, number][] | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [resolution, setResolution] = useState("");
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const chatBottomRef = useRef<HTMLDivElement>(null);
  // Reverse-geocoded address for the driver marker — only one driver per
  // booking, so a single slot (not a map) is enough. Reused unless the
  // driver has moved more than ~100m since the last lookup.
  const driverGeoRef = useRef<{ address: string; lat: number; lng: number } | null>(null);
  const agentEmail = typeof window !== "undefined" ? localStorage.getItem("support_agent_email") || "support@bogie.in" : "support@bogie.in";

  const fetchTicket = useCallback(async () => {
    try {
      const res = await api.get(`/gogoo/support/tickets?id=${id}`);
      const list: Ticket[] = res.data.tickets || [];
      const found = list.find(t => t.id === id);
      if (found) { setTicket(found); setResolution(found.resolution || ""); }
    } catch {}
  }, [id]);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await api.get(`/gogoo/support/tickets/${id}/messages`);
      setMessages(res.data.messages || []);
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch {}
  }, [id]);

  const fetchBooking = useCallback(async (bookingId: string) => {
    try {
      const res = await api.get(`/gogoo/bookings/${bookingId}`);
      const data: Booking = res.data;
      setBooking(data);
      if (data.pickup && data.drop) {
        try {
          const rRes = await api.get(`/gogoo/route`, { params: { from: `${data.pickup.lat},${data.pickup.lng}`, to: `${data.drop.lat},${data.drop.lng}` } });
          if (rRes.data?.polyline) setRouteLine(decodePolyline(rRes.data.polyline));
        } catch {}
      }
    } catch {}
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchTicket(), fetchMessages()]);
      setLoading(false);
    };
    init();
    const interval = setInterval(fetchMessages, 10000);
    return () => clearInterval(interval);
  }, [fetchTicket, fetchMessages]);

  useEffect(() => {
    if (ticket?.booking_id) fetchBooking(ticket.booking_id);
  }, [ticket?.booking_id, fetchBooking]);

  const sendMessage = async () => {
    if (!message.trim()) return;
    setSending(true);
    const text = message;
    setMessage("");
    try {
      await api.post(`/gogoo/support/tickets/${id}/messages`, {
        message: text,
        sender_type: "support",
        sender_name: agentEmail,
      });
      fetchMessages();
    } catch {
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const updateStatus = async (newStatus: string) => {
    setShowStatusMenu(false);
    try {
      await api.patch(`/gogoo/support/tickets/${id}`, {
        status: newStatus,
        resolution: newStatus === "resolved" ? resolution : undefined,
      });
      toast.success("Status updated");
      fetchTicket();
    } catch {
      toast.error("Failed to update status");
    }
  };

  const updatePriority = async (newPriority: string) => {
    setShowPriorityMenu(false);
    try {
      await api.patch(`/gogoo/support/tickets/${id}`, { priority: newPriority });
      toast.success("Priority updated");
      fetchTicket();
    } catch {
      toast.error("Failed to update priority");
    }
  };

  const assignToMe = async () => {
    try {
      await api.patch(`/gogoo/support/tickets/${id}`, { assigned_to: agentEmail, status: "in_progress" });
      toast.success("Assigned to you");
      fetchTicket();
    } catch {
      toast.error("Failed to assign");
    }
  };

  const processRefund = async (action: "approve" | "reject") => {
    try {
      await api.post(`/gogoo/support/tickets/${id}/refund`, {
        action,
        amount: parseFloat(refundAmount) || 0,
        reason: action === "reject" ? "Refund rejected by support agent" : "",
      });
      toast.success(`Refund ${action}d`);
      fetchTicket();
    } catch {
      toast.error("Failed to process refund");
    }
  };

  const cancelBooking = async () => {
    if (!cancelReason.trim()) { toast.error("Reason required"); return; }
    try {
      await api.post(`/gogoo/support/cancel-booking/${ticket?.booking_id}`, {
        reason: cancelReason,
        ticket_id: id,
      });
      toast.success("Booking cancelled");
      setShowCancelModal(false);
      fetchTicket();
    } catch {
      toast.error("Failed to cancel booking");
    }
  };

  const blockRider = async () => {
    if (!blockReason.trim()) { toast.error("Reason required"); return; }
    try {
      await api.post(`/gogoo/support/block-rider/${id}`, {
        reason: blockReason,
        ticket_id: id,
      });
      toast.success("Rider blocked");
      setShowBlockModal(false);
    } catch {
      toast.error("Failed to block rider");
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-100 rounded w-1/4" />
        <div className="h-64 bg-gray-100 rounded" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p>Ticket not found</p>
        <button onClick={() => router.back()} className="mt-4 text-purple-600 text-sm">← Go back</button>
      </div>
    );
  }

  const isActiveBooking = booking && !["completed", "cancelled"].includes(booking.status);

  let driverMarker: OlaMarker | null = null;
  if (booking?.driver?.lat != null && booking?.driver?.lng != null) {
    const dLat = booking.driver.lat;
    const dLng = booking.driver.lng;
    const cached = driverGeoRef.current;
    const hasFreshGeo = !!cached && haversineKm(cached.lat, cached.lng, dLat, dLng) <= 0.1;
    const geoLine = hasFreshGeo ? `📍 ${cached!.address || "Location unavailable"}` : "📍 Locating…";
    const updatedMs = booking.driver.updated_at ? Date.now() - new Date(booking.driver.updated_at).getTime() : null;
    const updatedAgo = updatedMs != null ? `Updated ${formatAgo(updatedMs)}${updatedMs > DRIVER_STALE_MS ? " (STALE)" : ""}` : "Updated —";
    driverMarker = {
      lng: dLng, lat: dLat, color: "#3B82F6", label: "🚗",
      popup: `
        <div style="font-family:system-ui;min-width:170px;padding:4px">
          <div style="font-weight:800;font-size:13px;margin-bottom:4px">🚗 ${booking.driver.name || "Driver"}</div>
          <div id="geo-driver-marker" style="color:#374151;font-size:12px;margin-top:4px;line-height:1.4">${geoLine}</div>
          <div style="color:#9CA3AF;font-size:10px;margin-top:3px">
            ${dLat.toFixed(4)}, ${dLng.toFixed(4)} ·
            <a href="#" onclick="navigator.clipboard.writeText('${dLat.toFixed(6)},${dLng.toFixed(6)}');this.textContent='Copied';setTimeout(()=>{this.textContent='Copy'},1200);return false;" style="color:#9CA3AF;text-decoration:underline;cursor:pointer">Copy</a> ·
            <a href="https://www.google.com/maps?q=${dLat},${dLng}" target="_blank" rel="noopener noreferrer" style="color:#7C3AED;text-decoration:underline">Open in Maps</a>
          </div>
          <div style="color:#9CA3AF;font-size:10px;margin-top:2px">${updatedAgo}</div>
        </div>`,
      onPopupOpen: () => {
        if (hasFreshGeo) return;
        fetchAddress(dLat, dLng).then((address) => {
          driverGeoRef.current = { address, lat: dLat, lng: dLng };
          const el = document.getElementById("geo-driver-marker");
          if (el) el.textContent = address ? `📍 ${address}` : "📍 Location unavailable";
        });
      },
    };
  }

  return (
    <div className="h-[calc(100vh-130px)] flex gap-5">
      {/* LEFT: Ticket Info (40%) */}
      <div className="w-[40%] flex flex-col gap-4 overflow-y-auto pr-1">
        {/* Back + Header */}
        <div>
          <button onClick={() => router.push("/support/tickets")} className="flex items-center gap-1 text-purple-600 text-sm mb-3 hover:underline">
            <ArrowLeft size={14} /> Back to Tickets
          </button>
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-start justify-between mb-2">
              <span className="font-mono text-sm text-gray-500">{ticket.ticket_number}</span>
              <div className="flex gap-2">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${PRIORITY_COLORS[ticket.priority]}`}>{ticket.priority}</span>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[ticket.status]}`}>{ticket.status?.replace(/_/g, " ")}</span>
              </div>
            </div>
            <h2 className="text-base font-bold text-gray-900 mb-2">{ticket.subject}</h2>
            {ticket.description && <p className="text-sm text-gray-500 mb-3">{ticket.description}</p>}
            <div className="flex gap-4 text-xs text-gray-400">
              <span>Created {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}</span>
              <span>Updated {formatDistanceToNow(new Date(ticket.updated_at), { addSuffix: true })}</span>
            </div>
          </div>
        </div>

        {/* User Info */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Raised By</p>
          {ticket.raised_by === "rider" && (
            <>
              <div className="flex items-center gap-2 text-sm">
                <User size={14} className="text-gray-400 flex-shrink-0" />
                <span className="font-medium text-gray-800">{ticket.rider_name || "Unknown Rider"}</span>
              </div>
              {ticket.rider_phone && (
                <div className="flex items-center gap-2">
                  <Phone size={14} className="text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{ticket.rider_phone}</span>
                  <button onClick={() => { navigator.clipboard.writeText(ticket.rider_phone); toast.success("Copied"); }}
                    className="text-gray-400 hover:text-purple-600"><Copy size={12} /></button>
                </div>
              )}
            </>
          )}
          {ticket.raised_by === "driver" && (
            <>
              <div className="flex items-center gap-2 text-sm">
                <User size={14} className="text-gray-400 flex-shrink-0" />
                <span className="font-medium text-gray-800">{ticket.driver_name || "Unknown Driver"}</span>
              </div>
              {ticket.driver_phone && (
                <div className="flex items-center gap-2">
                  <Phone size={14} className="text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{ticket.driver_phone}</span>
                  <button onClick={() => { navigator.clipboard.writeText(ticket.driver_phone); toast.success("Copied"); }}
                    className="text-gray-400 hover:text-purple-600"><Copy size={12} /></button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Booking */}
        {booking && (
          <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Related Booking</p>
            <div className="text-xs text-gray-500 space-y-1.5">
              <div className="flex justify-between"><span>Booking ID</span><span className="font-mono text-gray-700">#{ticket.booking_id?.slice(0, 8)}</span></div>
              <div className="flex justify-between"><span>Service</span><span className="font-medium text-gray-700">{booking.service_name || "Cab"}</span></div>
              <div className="flex justify-between"><span>Status</span><span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${booking.status === "completed" ? "bg-green-100 text-green-700" : booking.status === "cancelled" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>{booking.status}</span></div>
              {booking.pickup?.address && <div className="flex justify-between"><span>From</span><span className="text-gray-700 text-right max-w-[140px] truncate">{booking.pickup.address}</span></div>}
              {booking.drop?.address && <div className="flex justify-between"><span>To</span><span className="text-gray-700 text-right max-w-[140px] truncate">{booking.drop.address}</span></div>}
              {(booking.final_fare || booking.estimated_fare || 0) > 0 && <div className="flex justify-between"><span>Fare</span><span className="font-semibold text-gray-800">₹{booking.final_fare || booking.estimated_fare}</span></div>}
              {booking.started_at && <div className="flex justify-between"><span>Started</span><span className="text-gray-600">{format(new Date(booking.started_at), "MMM d, yyyy h:mm a")}</span></div>}
            </div>
            {booking.pickup && booking.drop && (
              <div className="pt-2">
                <OlaMap
                  className="w-full h-48 rounded-xl overflow-hidden"
                  fitToMarkers
                  route={routeLine || [[booking.pickup.lng, booking.pickup.lat], [booking.drop.lng, booking.drop.lat]]}
                  markers={[
                    { lng: booking.pickup.lng, lat: booking.pickup.lat, color: '#10B981', label: 'P', popup: '<b>Pickup</b>' },
                    { lng: booking.drop.lng, lat: booking.drop.lat, color: '#FF6B2B', label: 'D', popup: '<b>Drop</b>' },
                    ...(driverMarker ? [driverMarker] : []),
                  ]}
                />
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Actions</p>
          <button onClick={assignToMe} className="w-full bg-purple-600 text-white text-sm font-medium py-2 rounded-xl hover:bg-purple-700 transition">
            Assign to Me
          </button>

          <div className="relative">
            <button onClick={() => setShowStatusMenu(s => !s)} className="w-full flex items-center justify-between border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
              Change Status <ChevronDown size={14} />
            </button>
            {showStatusMenu && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-10 overflow-hidden">
                {["open", "in_progress", "resolved", "closed"].map(s => (
                  <button key={s} onClick={() => updateStatus(s)}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700">
                    {s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <button onClick={() => setShowPriorityMenu(s => !s)} className="w-full flex items-center justify-between border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
              Change Priority <ChevronDown size={14} />
            </button>
            {showPriorityMenu && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-10 overflow-hidden">
                {["urgent", "high", "medium", "low"].map(p => (
                  <button key={p} onClick={() => updatePriority(p)}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700">
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 pt-3 space-y-2">
            {isActiveBooking && (
              <button onClick={() => setShowCancelModal(true)} className="w-full border border-orange-200 text-orange-600 text-sm font-medium py-2 rounded-xl hover:bg-orange-50 transition">
                Cancel Booking
              </button>
            )}
            <button onClick={() => setShowBlockModal(true)} className="w-full border border-red-200 text-red-600 text-sm font-medium py-2 rounded-xl hover:bg-red-50 transition">
              Block Rider
            </button>
          </div>

          {/* Refund */}
          <div className="border-t border-gray-100 pt-3 space-y-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Refund</p>
            <input
              type="number"
              placeholder="Amount ₹"
              value={refundAmount}
              onChange={e => setRefundAmount(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            {ticket.refund_status && (
              <div className="text-xs text-gray-500">Status: <span className="font-medium text-gray-700">{ticket.refund_status}</span></div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => processRefund("approve")} className="bg-green-600 text-white text-xs font-medium py-2 rounded-xl hover:bg-green-700 transition">
                Approve Refund
              </button>
              <button onClick={() => processRefund("reject")} className="bg-red-50 border border-red-200 text-red-600 text-xs font-medium py-2 rounded-xl hover:bg-red-100 transition">
                Reject Refund
              </button>
            </div>
          </div>

          {/* Resolution */}
          {ticket.status !== "resolved" && (
            <div className="border-t border-gray-100 pt-3 space-y-2">
              <label className="text-xs font-medium text-gray-600">Resolution Notes</label>
              <textarea
                value={resolution}
                onChange={e => setResolution(e.target.value)}
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Describe how the issue was resolved..."
              />
              <button onClick={() => updateStatus("resolved")} className="w-full bg-green-600 text-white text-sm font-medium py-2 rounded-xl hover:bg-green-700 transition">
                Mark as Resolved ✓
              </button>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Chat (60%) */}
      <div className="flex-1 bg-white rounded-xl border border-gray-100 flex flex-col">
        {/* Chat Header */}
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">
                Conversation with {ticket.raised_by === "rider" ? (ticket.rider_name || "Rider") : (ticket.driver_name || "Driver")}
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {messages.length > 0
                  ? `Last message ${formatDistanceToNow(new Date(messages[messages.length - 1].created_at), { addSuffix: true })}`
                  : "No messages yet"
                }
              </p>
            </div>
            <Clipboard size={16} className="text-gray-300" />
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 text-sm py-10">No messages yet. Start the conversation.</div>
          )}
          {messages.map(msg => {
            const isSupport = msg.sender_type === "support";
            const isBot = msg.sender_type === "bot";
            const isSystem = msg.sender_type === "system";
            const isUser = msg.sender_type === "rider" || msg.sender_type === "driver";

            if (isSystem) {
              return (
                <div key={msg.id} className="text-center">
                  <span className="text-xs text-gray-400 bg-gray-50 px-3 py-1 rounded-full">{msg.message}</span>
                </div>
              );
            }
            return (
              <div key={msg.id} className={`flex ${isSupport ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                  isSupport ? "bg-purple-600 text-white" :
                  isBot ? "bg-gray-100 text-gray-800 border border-gray-200" :
                  "bg-gray-100 text-gray-800"
                }`}>
                  <div className={`text-[10px] font-semibold mb-1 ${
                    isSupport ? "text-purple-200" :
                    isBot ? "text-gray-500" :
                    "text-gray-400"
                  }`}>
                    {isBot ? "🤖 gogoo Assistant" : (msg.sender_name || msg.sender_type)}
                    <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] ${
                      isSupport ? "bg-purple-500 text-purple-100" :
                      isBot ? "bg-blue-100 text-blue-600" :
                      isUser ? "bg-orange-100 text-orange-600" :
                      "bg-gray-200 text-gray-500"
                    }`}>
                      {isBot ? "AI" : msg.sender_type}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                  <div className={`flex items-center justify-end gap-1 mt-1 ${isSupport ? "text-purple-300" : "text-gray-400"}`}>
                    <span className="text-[10px]">{formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}</span>
                    {isSupport && (msg.is_read ? <CheckCheck size={11} /> : <Check size={11} />)}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={chatBottomRef} />
        </div>

        {/* Message Input */}
        <div className="border-t border-gray-100 p-4 space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Type your reply... (Enter to send)"
                rows={2}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <button
              onClick={sendMessage}
              disabled={sending || !message.trim()}
              className="bg-purple-600 text-white p-3 rounded-xl hover:bg-purple-700 disabled:opacity-50 transition flex items-center justify-center"
            >
              <Send size={16} />
            </button>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <button
                onClick={() => setShowQuickReplies(s => !s)}
                className="text-xs text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1 border border-purple-200 px-3 py-1.5 rounded-lg hover:bg-purple-50"
              >
                Quick Replies <ChevronDown size={12} />
              </button>
              {showQuickReplies && (
                <div className="absolute bottom-full left-0 mb-1 bg-white border border-gray-100 rounded-xl shadow-xl z-10 w-80 overflow-hidden">
                  {QUICK_REPLIES.map((qr, i) => (
                    <button
                      key={i}
                      onClick={() => { setMessage(qr); setShowQuickReplies(false); }}
                      className="w-full text-left px-4 py-2.5 text-xs text-gray-700 hover:bg-purple-50 hover:text-purple-700 border-b border-gray-50 last:border-0"
                    >
                      {qr.slice(0, 80)}…
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Cancel Booking Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Cancel Booking</h3>
            <p className="text-sm text-gray-500">This action cannot be undone.</p>
            <textarea className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
              rows={3} placeholder="Reason for cancellation (required)..."
              value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
            <div className="flex gap-3">
              <button onClick={() => setShowCancelModal(false)} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={cancelBooking} className="flex-1 bg-orange-600 text-white rounded-xl py-2 text-sm font-medium hover:bg-orange-700">Confirm Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Block Rider Modal */}
      {showBlockModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Block Rider</h3>
            <p className="text-sm text-orange-600 font-medium">Warning: This will prevent the rider from using the app.</p>
            <textarea className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
              rows={3} placeholder="Reason for blocking (required)..."
              value={blockReason} onChange={e => setBlockReason(e.target.value)} />
            <div className="flex gap-3">
              <button onClick={() => setShowBlockModal(false)} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={blockRider} className="flex-1 bg-red-600 text-white rounded-xl py-2 text-sm font-medium hover:bg-red-700">Block Rider</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
