"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from "recharts";
import { AlertTriangle, Ticket, Zap, CheckCircle, Calendar, DollarSign, Clock, Plus, Search } from "lucide-react";

interface Stats {
  total_open: number;
  total_urgent: number;
  total_resolved: number;
  total_today: number;
  pending_refunds: number;
  pending_refund_amount: number;
  avg_resolve_minutes: number;
}

interface Ticket {
  id: string;
  ticket_number: string;
  type: string;
  status: string;
  priority: string;
  subject: string;
  created_at: string;
  rider_name: string;
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

const TYPE_CHART_COLORS = ["#7C3AED", "#A855F7", "#C084FC", "#DDD6FE", "#EDE9FE"];

export default function SupportOverviewPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, ticketsRes] = await Promise.all([
        api.get("/gogoo/support/stats"),
        api.get("/gogoo/support/tickets"),
      ]);
      setStats(statsRes.data);
      setTickets((ticketsRes.data.tickets || []).slice(0, 10));
    } catch {
      // backend not yet deployed — use empty defaults
      setStats({ total_open: 0, total_urgent: 0, total_resolved: 0, total_today: 0, pending_refunds: 0, pending_refund_amount: 0, avg_resolve_minutes: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const typeChartData = [
    { name: "Payment", value: tickets.filter(t => t.type === "payment_issue").length || 1 },
    { name: "Booking", value: tickets.filter(t => t.type === "booking_issue").length || 1 },
    { name: "Complaint", value: tickets.filter(t => t.type.includes("complaint")).length || 1 },
    { name: "Refund", value: tickets.filter(t => t.type === "refund_request").length || 1 },
    { name: "Other", value: tickets.filter(t => t.type === "other").length || 1 },
  ];

  const STAT_CARDS = [
    { label: "Open Tickets", value: stats?.total_open ?? "—", icon: Ticket, color: "text-purple-600" },
    { label: "Urgent", value: stats?.total_urgent ?? "—", icon: Zap, color: "text-red-600" },
    { label: "Resolved Today", value: stats?.total_resolved ?? "—", icon: CheckCircle, color: "text-green-600" },
    { label: "New Today", value: stats?.total_today ?? "—", icon: Calendar, color: "text-blue-600" },
    { label: "Pending Refunds", value: stats?.pending_refunds ?? "—", icon: DollarSign, color: "text-orange-600" },
    { label: "Avg Resolve", value: stats ? `${Math.round(stats.avg_resolve_minutes)}m` : "—", icon: Clock, color: "text-gray-600" },
  ];

  return (
    <div className="space-y-6">
      {/* Urgent Banner */}
      {(stats?.total_urgent ?? 0) > 0 && (
        <div className="flex items-center justify-between p-4 rounded-xl border-l-4 border-red-500" style={{ backgroundColor: "#FEF2F2" }}>
          <div className="flex items-center gap-3">
            <AlertTriangle size={18} className="text-red-500 flex-shrink-0" />
            <span className="text-red-700 font-medium text-sm">
              {stats?.total_urgent} urgent tickets need immediate attention
            </span>
          </div>
          <button
            onClick={() => router.push("/support/tickets?priority=urgent")}
            className="text-red-600 text-sm font-semibold hover:underline flex-shrink-0"
          >
            View Urgent Tickets →
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-6 gap-4">
        {STAT_CARDS.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className={`${color} mb-2`}><Icon size={18} /></div>
            <div className={`text-2xl font-bold ${color}`}>{loading ? "—" : value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => router.push("/support/tickets")}
          className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-purple-700 transition"
        >
          <Plus size={15} /> New Ticket
        </button>
        <button
          onClick={() => router.push("/support/bookings")}
          className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
        >
          <Search size={15} /> Search Booking
        </button>
        <button
          onClick={() => router.push("/support/riders")}
          className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
        >
          <Search size={15} /> Search Rider
        </button>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-5 gap-6">
        {/* Recent Tickets (60%) */}
        <div className="col-span-3 bg-white rounded-xl border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-sm">Recent Tickets</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {loading
              ? Array(5).fill(0).map((_, i) => (
                  <div key={i} className="px-5 py-3 animate-pulse">
                    <div className="h-4 bg-gray-100 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                  </div>
                ))
              : tickets.length === 0
              ? <div className="px-5 py-8 text-center text-gray-400 text-sm">No tickets yet</div>
              : tickets.map((t) => (
                  <div
                    key={t.id}
                    className="px-5 py-3 hover:bg-purple-50 cursor-pointer transition flex items-center gap-3"
                    onClick={() => router.push(`/support/tickets/${t.id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs text-gray-400 font-mono">{t.ticket_number}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[t.priority] || "bg-gray-100 text-gray-600"}`}>
                          {t.priority}
                        </span>
                      </div>
                      <p className="text-sm text-gray-800 font-medium truncate">{t.subject}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-400">{t.type?.replace(/_/g, " ")}</span>
                        <span className="text-gray-300">·</span>
                        <span className="text-xs text-gray-400">
                          {t.created_at ? formatDistanceToNow(new Date(t.created_at), { addSuffix: true }) : ""}
                        </span>
                      </div>
                    </div>
                    <span className={`text-[10px] px-2 py-1 rounded-full font-medium flex-shrink-0 ${STATUS_COLORS[t.status] || "bg-gray-100 text-gray-600"}`}>
                      {t.status?.replace(/_/g, " ")}
                    </span>
                  </div>
                ))
            }
          </div>
          {tickets.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-100">
              <button
                onClick={() => router.push("/support/tickets")}
                className="text-purple-600 text-sm font-medium hover:underline"
              >
                View all tickets →
              </button>
            </div>
          )}
        </div>

        {/* Right: Charts (40%) */}
        <div className="col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Ticket Type Breakdown</h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={typeChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value">
                  {typeChartData.map((_, i) => (
                    <Cell key={i} fill={TYPE_CHART_COLORS[i % TYPE_CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number, n: string) => [v, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-1 mt-2">
              {typeChartData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: TYPE_CHART_COLORS[i] }} />
                  <span className="text-xs text-gray-500">{d.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Resolution Rate</h3>
            {stats && (
              <>
                <div className="text-3xl font-bold text-purple-600 mb-1">
                  {stats.total_resolved + stats.total_open > 0
                    ? Math.round((stats.total_resolved / (stats.total_resolved + stats.total_open)) * 100)
                    : 0}%
                </div>
                <div className="text-xs text-gray-500 mb-3">tickets resolved</div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-purple-600 h-2 rounded-full transition-all"
                    style={{
                      width: `${stats.total_resolved + stats.total_open > 0
                        ? Math.round((stats.total_resolved / (stats.total_resolved + stats.total_open)) * 100)
                        : 0}%`
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
