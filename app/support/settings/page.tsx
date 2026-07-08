"use client";
import { useState } from "react";
import toast from "react-hot-toast";
import { CheckCircle, XCircle } from "lucide-react";

const QUICK_REPLIES_DEFAULT = [
  "Thank you for contacting bogie support. We are looking into your issue and will respond shortly.",
  "We have received your complaint and have escalated it to the relevant team.",
  "Your refund has been processed and will reflect in your account within 3-5 business days.",
  "Could you please provide more details about the issue you experienced?",
  "We have resolved your issue. Please let us know if you need any further assistance.",
];

export default function SettingsPage() {
  const [tab, setTab] = useState<"profile" | "quick_replies" | "notifications" | "security">("profile");
  const [name, setName] = useState("Support Agent");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [quickReplies, setQuickReplies] = useState(QUICK_REPLIES_DEFAULT);
  const [newReply, setNewReply] = useState("");
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editVal, setEditVal] = useState("");
  const [notifs, setNotifs] = useState({ urgent: true, assigned: true, digest: false });

  const agentEmail = typeof window !== "undefined" ? localStorage.getItem("support_agent_email") || "support@bogie.in" : "support@bogie.in";

  const updateProfile = () => toast.success("Profile updated");
  const updatePassword = () => {
    if (!currentPw || !newPw) { toast.error("Fill all fields"); return; }
    if (newPw !== confirmPw) { toast.error("Passwords don't match"); return; }
    toast.success("Password updated");
    setCurrentPw(""); setNewPw(""); setConfirmPw("");
  };

  const addReply = () => {
    if (!newReply.trim()) return;
    setQuickReplies(r => [...r, newReply.trim()]);
    setNewReply("");
    toast.success("Template added");
  };

  const deleteReply = (i: number) => {
    setQuickReplies(r => r.filter((_, idx) => idx !== i));
    toast.success("Template removed");
  };

  const saveEdit = () => {
    if (editIdx === null) return;
    setQuickReplies(r => r.map((t, i) => i === editIdx ? editVal : t));
    setEditIdx(null);
    toast.success("Template updated");
  };

  const TABS = [
    { key: "profile", label: "My Profile" },
    { key: "quick_replies", label: "Quick Replies" },
    { key: "notifications", label: "Notifications" },
    { key: "security", label: "Security Info" },
  ] as const;

  return (
    <div className="max-w-2xl space-y-5">
      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${tab === t.key ? "bg-white text-purple-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {tab === "profile" && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-5">
          <h3 className="font-bold text-gray-900">My Profile</h3>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Name</label>
              <input value={name} onChange={e => setName(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Email</label>
              <input value={agentEmail} readOnly
                className="w-full border border-gray-100 rounded-xl px-3 py-2.5 text-sm bg-gray-50 text-gray-400 cursor-not-allowed" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Role</label>
              <select className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                <option>Agent</option>
                <option>Senior Agent</option>
                <option>Manager</option>
              </select>
            </div>
            <button onClick={updateProfile} className="bg-purple-600 text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-purple-700 transition">
              Update Profile
            </button>
          </div>

          <div className="border-t border-gray-100 pt-5 space-y-4">
            <h4 className="font-semibold text-gray-800 text-sm">Change Password</h4>
            {[
              { label: "Current Password", val: currentPw, set: setCurrentPw },
              { label: "New Password", val: newPw, set: setNewPw },
              { label: "Confirm New Password", val: confirmPw, set: setConfirmPw },
            ].map(({ label, val, set }) => (
              <div key={label}>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">{label}</label>
                <input type="password" value={val} onChange={e => set(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
            ))}
            <button onClick={updatePassword} className="bg-gray-800 text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-gray-900 transition">
              Update Password
            </button>
          </div>
        </div>
      )}

      {/* Quick Replies Tab */}
      {tab === "quick_replies" && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
          <h3 className="font-bold text-gray-900">Quick Reply Templates</h3>
          <div className="flex gap-2">
            <input
              value={newReply}
              onChange={e => setNewReply(e.target.value)}
              placeholder="Add new template..."
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              onKeyDown={e => e.key === "Enter" && addReply()}
            />
            <button onClick={addReply} className="bg-purple-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-purple-700">Add</button>
          </div>
          <div className="space-y-2">
            {quickReplies.map((r, i) => (
              <div key={i} className="border border-gray-100 rounded-xl p-3">
                {editIdx === i ? (
                  <div className="space-y-2">
                    <textarea value={editVal} onChange={e => setEditVal(e.target.value)} rows={2}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500" />
                    <div className="flex gap-2">
                      <button onClick={saveEdit} className="text-xs bg-purple-600 text-white px-3 py-1 rounded-lg">Save</button>
                      <button onClick={() => setEditIdx(null)} className="text-xs border border-gray-200 text-gray-600 px-3 py-1 rounded-lg">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-gray-700 flex-1">{r}</p>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => { setEditIdx(i); setEditVal(r); }}
                        className="text-xs text-purple-600 border border-purple-200 px-2 py-1 rounded-lg hover:bg-purple-50">Edit</button>
                      <button onClick={() => deleteReply(i)}
                        className="text-xs text-red-600 border border-red-200 px-2 py-1 rounded-lg hover:bg-red-50">Delete</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notifications Tab */}
      {tab === "notifications" && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
          <h3 className="font-bold text-gray-900">Notifications</h3>
          {[
            { key: "urgent" as const, label: "Email me when urgent ticket created" },
            { key: "assigned" as const, label: "Email me when ticket assigned to me" },
            { key: "digest" as const, label: "Daily digest of open tickets" },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={notifs[key]} onChange={e => setNotifs(n => ({ ...n, [key]: e.target.checked }))}
                className="w-4 h-4 rounded accent-purple-600" />
              <span className="text-sm text-gray-700">{label}</span>
            </label>
          ))}
          <button onClick={() => toast.success("Notification preferences saved")}
            className="bg-purple-600 text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-purple-700 transition">
            Save Preferences
          </button>
        </div>
      )}

      {/* Security Tab */}
      {tab === "security" && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-5">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-gray-900">Security Notice</h3>
            <span className="text-orange-500 text-lg">⚠</span>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">You have access to:</p>
            <div className="space-y-2">
              {[
                "Rider personal information (name, phone, email)",
                "Full booking history",
                "Wallet balances",
                "Chat with riders/drivers",
                "Cancel bookings",
                "Issue refunds",
                "Block abusive riders",
              ].map(item => (
                <div key={item} className="flex items-center gap-2.5">
                  <CheckCircle size={15} className="text-green-500 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">You do NOT have access to:</p>
            <div className="space-y-2">
              {[
                "Platform pricing settings",
                "Driver documents",
                "Financial reports",
                "Admin panel management",
                "Change fares or commissions",
              ].map(item => (
                <div key={item} className="flex items-center gap-2.5">
                  <XCircle size={15} className="text-red-400 flex-shrink-0" />
                  <span className="text-sm text-gray-500">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
            <p className="text-xs text-orange-700 leading-relaxed">
              All your actions are logged in the audit system. Misuse of access will result in account suspension.
            </p>
          </div>
          <div className="border-t border-gray-100 pt-4 space-y-2 text-sm text-gray-500">
            <div className="flex justify-between">
              <span>Active Sessions</span>
              <span className="font-medium text-gray-800">1</span>
            </div>
            <button className="w-full border border-red-200 text-red-600 text-sm font-medium py-2.5 rounded-xl hover:bg-red-50 transition mt-3">
              Sign Out All Sessions
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
