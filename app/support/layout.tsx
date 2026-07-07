"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import {
  LayoutDashboard, MessageSquare, BookOpen, Users,
  RefreshCw, Settings, LogOut, ExternalLink, Headphones, Bell,
} from "lucide-react";
import { api } from "@/lib/api";

const NAV = [
  { href: "/support", icon: LayoutDashboard, label: "Overview" },
  { href: "/support/tickets", icon: MessageSquare, label: "Tickets" },
  { href: "/support/bookings", icon: BookOpen, label: "Bookings" },
  { href: "/support/riders", icon: Users, label: "Riders" },
  { href: "/support/refunds", icon: RefreshCw, label: "Refunds" },
  { href: "/support/notifications", icon: Bell, label: "Notifications" },
  { href: "/support/settings", icon: Settings, label: "Settings" },
];

export default function SupportLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [agentEmail, setAgentEmail] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnread = useCallback(async () => {
    try {
      const res = await api.get("/gogoo/support/unread-count");
      setUnreadCount(res.data.unread || 0);
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("support_admin_token");
      if (!token) { router.push("/"); return; }
      setAgentEmail(localStorage.getItem("support_agent_email") || "Agent");
      fetchUnread();
    }
  }, []);

  // Poll unread count every 30s
  useEffect(() => {
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [fetchUnread]);

  const logout = () => {
    localStorage.removeItem("support_admin_token");
    localStorage.removeItem("support_agent_email");
    router.push("/");
  };

  const getTitle = () => {
    if (pathname === "/support") return "Overview";
    if (pathname.startsWith("/support/tickets/")) return "Ticket Detail";
    if (pathname === "/support/tickets") return "Tickets";
    if (pathname === "/support/bookings") return "Bookings";
    if (pathname === "/support/riders") return "Riders";
    if (pathname === "/support/refunds") return "Refunds";
    if (pathname === "/support/notifications") return "Notifications";
    if (pathname === "/support/settings") return "Settings";
    return "Support";
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 bg-white border-r border-gray-100 flex flex-col fixed left-0 top-0 h-screen z-20">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center flex-shrink-0">
              <Headphones size={15} className="text-white" />
            </div>
            <div>
              <span className="text-gray-900 font-bold text-base tracking-tight">gogoo</span>
              <div className="mt-0.5">
                <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full tracking-wider uppercase">
                  Support
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map(({ href, icon: Icon, label }) => {
            const active =
              href === "/support"
                ? pathname === "/support"
                : pathname === href || pathname.startsWith(href + "/");
            const isTickets = href === "/support/tickets";
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? "bg-purple-50 text-purple-600 border-l-4 border-purple-500 pl-2"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <Icon size={17} className="flex-shrink-0" />
                <span className="flex-1">{label}</span>
                {isTickets && unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 ml-auto leading-none">
                    {unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="px-3 py-4 border-t border-gray-100">
          <div className="flex items-center gap-3 px-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {agentEmail.charAt(0).toUpperCase() || "A"}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-900 truncate">{agentEmail.split("@")[0] || "Agent"}</p>
              <p className="text-[11px] text-gray-400">Support Agent</p>
            </div>
          </div>

          <div className="px-3 mb-2">
            <a
              href="https://gogoo-production.up.railway.app"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-gray-50 group mb-1 transition-colors"
            >
              <span className="text-xs text-gray-500 group-hover:text-gray-700">Master Panel</span>
              <ExternalLink size={11} className="text-gray-400" />
            </a>
          </div>

          <button
            onClick={logout}
            className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm text-red-500 hover:bg-red-50 transition font-medium"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="ml-60 flex-1 flex flex-col min-h-screen">
        <header className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
          <h1 className="text-base font-bold text-gray-900">{getTitle()}</h1>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-purple-600 bg-purple-50 border border-purple-100 px-3 py-1.5 rounded-full font-semibold">
              <span className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
              Live
            </div>
          </div>
        </header>
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
