"use client";
import { useEffect, useState, useRef } from "react";
import toast from "react-hot-toast";
import { Send, X, RefreshCw, Bell, Search, Users, Car } from "lucide-react";
import { api } from "@/lib/api";

const TYPES = [
  { key: "general",      label: "General",      icon: "📢" },
  { key: "announcement", label: "Announcement", icon: "📣" },
  { key: "offer",        label: "Offer",        icon: "🎁" },
  { key: "coupon",       label: "Coupon",       icon: "🏷" },
  { key: "news",         label: "News",         icon: "📰" },
  { key: "ride",         label: "Ride Update",  icon: "🚗" },
];
const TYPE_ICON: Record<string, string> = Object.fromEntries(TYPES.map(t => [t.key, t.icon]));
const TYPE_BADGE: Record<string, string> = {
  general: "bg-gray-100 text-gray-600", announcement: "bg-yellow-100 text-yellow-700",
  offer: "bg-green-100 text-green-700", coupon: "bg-teal-100 text-teal-700",
  news: "bg-purple-100 text-purple-700", ride: "bg-blue-100 text-blue-700",
};
const CATEGORIES = [
  { key: "", label: "All categories" },
  { key: "cab", label: "Cab" },
  { key: "truck", label: "Truck" },
  { key: "ambulance", label: "Ambulance" },
];

const emptyForm = () => ({ title: "", body: "", type: "general", coupon_code: "", link_url: "" });

interface Person { id: string; user_id: string; name: string; phone?: string; }

function MultiPersonSearch({ audience, category, selected, onChange }: {
  audience: "drivers" | "riders"; category: string; selected: Person[]; onChange: (p: Person[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [all, setAll] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const url = audience === "drivers"
        ? `/gogoo/drivers${category ? `?category=${category}` : ""}`
        : "/gogoo/riders";
      const res = await api.get(url);
      const data = res.data;
      const arr: Person[] = Array.isArray(data) ? data : (data?.drivers || data?.data || []);
      setAll(arr.filter(p => p.user_id));
    } catch { setAll([]); }
    finally { setLoading(false); }
  };

  // Reload whenever audience/category flips — the person pool changes.
  useEffect(() => { setAll([]); load(); }, [audience, category]);

  const q = query.trim().toLowerCase();
  const matches = q.length === 0 ? [] : all.filter(p =>
    p.name?.toLowerCase().includes(q) || p.phone?.includes(q)
  ).slice(0, 8);

  const isSelected = (p: Person) => selected.some(s => s.user_id === p.user_id);
  const toggle = (p: Person) => {
    if (isSelected(p)) onChange(selected.filter(s => s.user_id !== p.user_id));
    else onChange([...selected, p]);
  };

  return (
    <div className="mb-3">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map(p => (
            <span key={p.user_id} className="inline-flex items-center gap-1 bg-purple-50 border border-purple-200 rounded-full pl-2.5 pr-1 py-1 text-xs font-semibold text-purple-700">
              {p.name || "Unnamed"}
              <button type="button" onClick={() => toggle(p)} className="p-0.5 hover:bg-purple-100 rounded-full"><X size={10}/></button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder={`Search ${audience === "drivers" ? "drivers" : "riders"} to add…`}
          className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400 transition" />
      </div>
      {q.length > 0 && (
        <div className="mt-1 bg-white border border-gray-100 rounded-xl shadow-sm max-h-56 overflow-y-auto">
          {loading ? <p className="px-4 py-3 text-xs text-gray-400">Loading…</p> :
            matches.length === 0 ? <p className="px-4 py-3 text-xs text-gray-400">No match found</p> :
            matches.map(p => (
              <label key={p.id} className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-purple-50 border-b border-gray-50 last:border-0 cursor-pointer">
                <input type="checkbox" checked={isSelected(p)} onChange={() => toggle(p)} className="accent-purple-600" />
                <span className="font-medium text-gray-800">{p.name || "Unnamed"}</span>
                {p.phone && <span className="text-xs text-gray-400 ml-auto">{p.phone}</span>}
              </label>
            ))}
        </div>
      )}
    </div>
  );
}

function ComposeForm({ onSent }: { onSent: () => void }) {
  const [audience, setAudience] = useState<"riders" | "drivers">("drivers");
  const [category, setCategory] = useState("");
  const [form, setForm] = useState(emptyForm());
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState<"broadcast" | "select">("broadcast");
  const [selected, setSelected] = useState<Person[]>([]);

  const update = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const switchAudience = (a: "riders" | "drivers") => {
    setAudience(a);
    setCategory("");
    setSelected([]);
  };
  const switchMode = (m: "broadcast" | "select") => { setMode(m); setSelected([]); };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) { toast.error("Title and message are required"); return; }
    if (mode === "select" && selected.length === 0) {
      toast.error(`Select at least one ${audience === "drivers" ? "driver" : "rider"}`);
      return;
    }
    if (mode === "broadcast") {
      const who = audience === "riders"
        ? "ALL riders"
        : category ? `ALL ${category} drivers` : "ALL drivers of every category";
      if (!confirm(`Send this to ${who}? Everyone in this audience will get a push notification.`)) return;
    }
    setSending(true);
    try {
      await api.post("/gogoo/admin/notifications", {
        ...form,
        target_audience: audience,
        ...(audience === "drivers" && category ? { target_category: category } : {}),
        ...(mode === "select" ? { target_user_ids: selected.map(p => p.user_id) } : {}),
      });
      toast.success(mode === "select"
        ? `Sent to ${selected.length} selected ${audience}`
        : `Broadcast sent to ${audience}${category ? ` (${category})` : ""}!`);
      setForm(emptyForm());
      setSelected([]);
      onSent();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to send. Try again.");
    } finally { setSending(false); }
  };

  const needsCoupon = form.type === "coupon" || form.type === "offer";

  return (
    <form onSubmit={send} className="border border-gray-100 rounded-2xl p-5 bg-gray-50 mb-5">
      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-4">New Message</p>

      {/* Audience */}
      <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 mb-3">
        <button type="button" onClick={() => switchAudience("riders")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition ${audience === "riders" ? "bg-purple-600 text-white" : "text-gray-500 hover:text-gray-800"}`}>
          <Users size={15}/> Riders
        </button>
        <button type="button" onClick={() => switchAudience("drivers")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition ${audience === "drivers" ? "bg-purple-600 text-white" : "text-gray-500 hover:text-gray-800"}`}>
          <Car size={15}/> Drivers
        </button>
      </div>

      {audience === "drivers" && (
        <select value={category} onChange={e => { setCategory(e.target.value); setSelected([]); }}
          className="w-full px-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400 transition mb-3">
          {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
      )}

      {/* Target mode */}
      <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 mb-4">
        <button type="button" onClick={() => switchMode("broadcast")}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${mode === "broadcast" ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-800"}`}>
          Broadcast
        </button>
        <button type="button" onClick={() => switchMode("select")}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${mode === "select" ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-800"}`}>
          Select people
        </button>
      </div>

      {mode === "select" && (
        <MultiPersonSearch audience={audience} category={category} selected={selected} onChange={setSelected} />
      )}

      <div className="flex flex-wrap gap-1.5 mb-4">
        {TYPES.map(t => (
          <button key={t.key} type="button" onClick={() => update("type", t.key)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition ${
              form.type === t.key ? "border-purple-400 bg-purple-50 text-purple-600" : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <input value={form.title} onChange={e => update("title", e.target.value)}
        placeholder="Title" maxLength={80}
        className="w-full px-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400 transition mb-3" />

      <textarea value={form.body} onChange={e => update("body", e.target.value)}
        placeholder="Message body…" maxLength={300} rows={3}
        className="w-full px-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400 transition resize-none mb-3" />

      {needsCoupon && (
        <input value={form.coupon_code} onChange={e => update("coupon_code", e.target.value.toUpperCase())}
          placeholder="Coupon code e.g. BOGIE50" maxLength={20}
          className="w-full px-4 py-2.5 text-sm bg-white border border-teal-300 rounded-xl focus:outline-none focus:border-teal-500 transition mb-3 font-mono tracking-widest text-teal-700" />
      )}

      <input value={form.link_url} onChange={e => update("link_url", e.target.value)}
        placeholder="Link URL (optional)"
        className="w-full px-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400 transition mb-4" />

      <button type="submit" disabled={sending || (mode === "select" && selected.length === 0)}
        className="w-full flex items-center justify-center gap-2 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50 transition hover:opacity-90 bg-purple-600">
        {sending ? (
          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
          </svg>
        ) : <Send size={15}/>}
        {sending ? "Sending…" : mode === "select" ? `Send to ${selected.length || ""} selected` : `Broadcast to ${audience}`}
      </button>
    </form>
  );
}

function NotificationCard({ item, onDiscontinue }: { item: any; onDiscontinue: (id: string) => void }) {
  return (
    <div className={`border rounded-2xl p-4 mb-3 transition ${item.is_active ? "border-gray-100 bg-white shadow-sm" : "border-gray-100 bg-gray-50 opacity-60"}`}>
      <div className="flex items-start gap-3">
        <span className="text-xl mt-0.5 flex-shrink-0">{TYPE_ICON[item.type] || "📢"}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`font-semibold text-sm text-gray-900 ${!item.is_active ? "line-through" : ""}`}>{item.title}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${TYPE_BADGE[item.type] || "bg-gray-100 text-gray-600"}`}>{item.type}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 capitalize">
              {item.target_audience}{item.target_category ? ` · ${item.target_category}` : ""}
            </span>
            {item.target_user_id ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">1:1</span>
            ) : item.target_user_ids?.length > 0 ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{item.target_user_ids.length} selected</span>
            ) : (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">broadcast</span>
            )}
            {!item.is_active && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">discontinued</span>}
          </div>
          <p className="text-sm text-gray-600 leading-relaxed mb-2">{item.body}</p>
          {item.coupon_code && (
            <div className="inline-flex items-center gap-1.5 bg-teal-50 border border-teal-200 rounded-xl px-3 py-1 mb-2">
              <span className="text-xs">🏷</span>
              <span className="text-xs font-mono font-bold text-teal-700 tracking-widest">{item.coupon_code}</span>
            </div>
          )}
          {item.link_url && (
            <div className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-xl px-3 py-1 mb-2 max-w-full">
              <span className="text-xs">🔗</span>
              <span className="text-xs text-blue-600 truncate max-w-[180px]">{item.link_url}</span>
            </div>
          )}
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-gray-400">{new Date(item.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
            {item.read_count > 0 && <span className="text-xs text-gray-400">👁 {item.read_count} read</span>}
          </div>
        </div>
        {item.is_active && (
          <button onClick={() => onDiscontinue(item.id)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 px-2.5 py-1.5 rounded-xl transition flex-shrink-0">
            <X size={12}/> Stop
          </button>
        )}
      </div>
    </div>
  );
}

export default function SupportNotificationsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await api.get("/gogoo/admin/notifications");
      setItems(res.data || []);
    } catch { setItems([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchItems(); }, []);

  const discontinue = async (id: string) => {
    if (!confirm("Stop this broadcast? It will be hidden from the app.")) return;
    try {
      await api.delete(`/gogoo/admin/notifications/${id}`);
      toast.success("Broadcast discontinued");
      fetchItems();
    } catch { toast.error("Failed to discontinue"); }
  };

  const active = items.filter(n => n.is_active);
  const inactive = items.filter(n => !n.is_active);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-gray-400">Send announcements, offers, coupons, and news to riders or drivers of any category</p>
        <button onClick={fetchItems} className="p-1.5 hover:bg-gray-100 rounded-xl text-gray-400 transition"><RefreshCw size={16}/></button>
      </div>

      <div className="max-w-2xl">
        <ComposeForm onSent={fetchItems} />

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="animate-pulse h-20 bg-gray-50 rounded-2xl"/>)}
          </div>
        ) : items.length === 0 ? (
          <div className="border-2 border-dashed border-gray-200 rounded-2xl py-12 text-center">
            <Bell size={24} className="text-gray-300 mx-auto mb-3"/>
            <p className="text-sm text-gray-400">No messages yet</p>
            <p className="text-xs text-gray-300 mt-1">Send your first message above</p>
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">Active</p>
                {active.map(n => <NotificationCard key={n.id} item={n} onDiscontinue={discontinue}/>)}
              </div>
            )}
            {inactive.length > 0 && (
              <div className="mt-4">
                <p className="text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-3">Discontinued</p>
                {inactive.map(n => <NotificationCard key={n.id} item={n} onDiscontinue={discontinue}/>)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
