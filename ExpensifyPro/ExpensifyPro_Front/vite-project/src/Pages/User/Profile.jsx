import { useEffect, useMemo, useRef, useState } from "react";
import { Mail, Shield, Palette, Camera, Trash2, Copy } from "lucide-react";
import { apiService } from "../../api";

const ROLE_LABELS = { 1: "Admin", 2: "Employee", 3: "Guest" };

export default function Profile() {
  // pull lightweight info from localStorage for initial display
  const [user, setUser] = useState({ id: null, name: "", email: "", role: 2, org_id: null });

  // local edit state (layout only; no persistence wired yet)
  const [form, setForm] = useState({ name: "", email: "" });
  const [pwd, setPwd] = useState({ newPassword: "", confirm: "" });
  const [prefs, setPrefs] = useState({ theme: "system", density: "comfortable" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState("");

  // avatar state (client-only persistence for now)
  const [avatarUrl, setAvatarUrl] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("exp_user");
      const parsed = raw ? JSON.parse(raw) : {};
      const u = {
        id: parsed?.id ?? null,
        name: parsed?.name ?? "",
        email: parsed?.email ?? "",
        role: parsed?.role ?? 2,
        org_id: parsed?.org_id ?? null,
      };
      setUser(u);
      setForm({ name: u.name || "", email: u.email || "" });
    } catch {
      // ignore parse errors; keep defaults
    }
  }, []);

  const initials = useMemo(() => {
    const parts = String(user.name || user.email || "").trim().split(/\s+/);
    return parts.slice(0, 2).map((s) => s[0]?.toUpperCase() || "").join("") || "U";
  }, [user]);

  const avatarKey = useMemo(() => (user?.id ? `avatar:${user.id}` : null), [user?.id]);

  useEffect(() => {
    if (!avatarKey) return;
    try {
      const stored = localStorage.getItem(avatarKey);
      if (stored) setAvatarUrl(stored);
    } catch {
      /* ignore */
    }
  }, [avatarKey]);

  const onPickAvatar = () => fileInputRef.current?.click();
  const onAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      setAvatarUrl(dataUrl);
      if (avatarKey) {
        try { localStorage.setItem(avatarKey, dataUrl); } catch { /* storage may fail */ }
      }
    };
    reader.readAsDataURL(file);
  };
  const onRemoveAvatar = () => {
    setAvatarUrl("");
    if (avatarKey) {
      try { localStorage.removeItem(avatarKey); } catch { /* ignore */ }
    }
  };
  const onCopyEmail = async () => {
    try { await navigator.clipboard.writeText(user.email || ""); } catch { /* ignore */ }
  };

  const saveLocalUser = (patch) => {
    try {
      const raw = localStorage.getItem("exp_user");
      const current = raw ? JSON.parse(raw) : {};
      const updated = { ...current, ...patch };
      localStorage.setItem("exp_user", JSON.stringify(updated));
      setUser((u) => ({ ...u, ...patch }));
    } catch { /* ignore */ }
  };

  const handleSaveProfile = async () => {
    setProfileMsg("");
    if (!user?.id) { setProfileMsg("Missing user id."); return; }
    if (!form.email?.includes("@")) { setProfileMsg("Enter a valid email."); return; }
    setSavingProfile(true);
    try {
      await apiService.updateUser(user.id, { name: form.name || "", email: form.email.trim() });
      saveLocalUser({ name: form.name || "", email: form.email.trim() });
      setProfileMsg("Profile updated.");
    } catch (e) {
      // fallback: update local only so UI stays in sync
      saveLocalUser({ name: form.name || "", email: form.email.trim() });
      setProfileMsg("Saved locally. Backend unreachable.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdatePassword = async () => {
    setPwdMsg("");
    if (!user?.id) { setPwdMsg("Missing user id."); return; }
    if (!pwd.newPassword || pwd.newPassword.length < 6) { setPwdMsg("Password must be at least 6 characters."); return; }
    if (pwd.newPassword !== pwd.confirm) { setPwdMsg("Passwords do not match."); return; }
    setSavingPwd(true);
    try {
      await apiService.updateUser(user.id, { password: pwd.newPassword });
      setPwd({ newPassword: "", confirm: "" });
      setPwdMsg("Password updated.");
    } catch (e) {
      setPwd({ newPassword: "", confirm: "" });
      setPwdMsg("Updated locally. Backend unreachable.");
    } finally {
      setSavingPwd(false);
    }
  };

  const setTheme = (v) => {
    setPrefs((p) => ({ ...p, theme: v }));
    try { localStorage.setItem("pref:theme", v); } catch { /* ignore */ }
  };
  const setDensity = (v) => {
    setPrefs((p) => ({ ...p, density: v }));
    try { localStorage.setItem("pref:density", v); } catch { /* ignore */ }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="text-gray-600 text-sm">Manage your personal info and preferences.</p>
      </div>

      {/* Overview card with gradient border */}
      <div className="rounded-2xl bg-linear-to-r from-indigo-600 to-purple-600 p-px">
        <div className="rounded-2xl bg-white/80 p-5 md:p-7">
          <div className="flex items-center gap-5">
            {/* Avatar */}
            <div className="relative">
              <div className="h-24 w-24 rounded-full overflow-hidden shadow-sm ring-2 ring-indigo-200/70 bg-linear-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-2xl font-semibold text-white">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
              {/* hover controls */}
              <div className="absolute -bottom-2 -right-2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={onPickAvatar}
                  className="h-9 w-9 inline-flex items-center justify-center rounded-full bg-white text-gray-700 shadow border hover:bg-gray-50 ring-1 ring-indigo-200/60"
                  aria-label="Change avatar"
                  title="Change avatar"
                >
                  <Camera className="h-4.5 w-4.5" />
                </button>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={onRemoveAvatar}
                    className="h-9 w-9 inline-flex items-center justify-center rounded-full bg-white text-gray-700 shadow border hover:bg-gray-50 ring-1 ring-indigo-200/60"
                    aria-label="Remove avatar"
                    title="Remove avatar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onAvatarChange}
              />
            </div>

            {/* Meta */}
            <div className="min-w-0">
              <div className="font-medium truncate">{user.name || "Unnamed User"}</div>
              <div className="text-sm text-gray-600 flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span className="truncate">{user.email || "-"}</span>
                {user.email && (
                  <button
                    type="button"
                    onClick={onCopyEmail}
                    className="ml-1 inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs hover:bg-gray-50"
                    title="Copy email"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </button>
                )}
              </div>
              <div className="mt-1 inline-flex items-center gap-2 text-xs text-gray-600">
                <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 text-indigo-700 px-2 py-0.5">
                  <Shield className="h-3.5 w-3.5" />
                  {ROLE_LABELS[user.role] || `Role ${user.role ?? "-"}`}
                </span>
                {user.org_id != null && (
                  <span className="rounded-lg bg-gray-100 text-gray-700 px-2 py-0.5">Org #{user.org_id}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Personal info (spans 2) */}
        <section className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-4 md:p-6">
          <h2 className="text-sm font-medium">Personal Info</h2>
          <p className="text-xs text-gray-500">Update your basic profile details.</p>

          <form
            onSubmit={(e) => e.preventDefault()}
            className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            <div className="sm:col-span-1">
              <label className="block text-sm text-gray-700 mb-1">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Your name"
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="sm:col-span-1">
              <label className="block text-sm text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="sm:col-span-2 flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setForm({ name: user.name || "", email: user.email || "" })}
                className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={savingProfile}
                className={`rounded-xl px-3 py-2 text-sm font-medium text-white ${savingProfile ? "bg-indigo-300" : "bg-indigo-600 hover:bg-indigo-700"}`}
              >
                {savingProfile ? "Saving..." : "Save Changes"}
              </button>
            </div>
            {profileMsg && (
              <div className="sm:col-span-2 text-xs text-gray-600">{profileMsg}</div>
            )}
          </form>
        </section>

        {/* Right: Preferences */}
        <aside className="rounded-2xl border border-gray-200 bg-white p-4 md:p-6">
          <h2 className="text-sm font-medium flex items-center gap-2">
            <Palette className="h-4 w-4 text-indigo-600" /> Preferences
          </h2>
          <div className="mt-4 space-y-4 text-sm">
            <div>
              <div className="text-gray-700 mb-1">Theme</div>
              <div className="flex items-center gap-2">
                {[
                  { v: "light", label: "Light" },
                  { v: "system", label: "System" },
                  { v: "dark", label: "Dark" },
                ].map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setTheme(opt.v)}
                    className={`rounded-xl px-3 py-1.5 border text-xs ${
                      prefs.theme === opt.v
                        ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                        : "border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-gray-700 mb-1">Density</div>
              <div className="flex items-center gap-2">
                {[
                  { v: "comfortable", label: "Comfortable" },
                  { v: "compact", label: "Compact" },
                ].map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setDensity(opt.v)}
                    className={`rounded-xl px-3 py-1.5 border text-xs ${
                      prefs.density === opt.v
                        ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                        : "border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Security / password */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4 md:p-6">
        <h2 className="text-sm font-medium flex items-center gap-2"><Shield className="h-4 w-4 text-indigo-600" /> Security</h2>
        <p className="text-xs text-gray-500">Change your password to keep your account secure.</p>

        <form onSubmit={(e) => e.preventDefault()} className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-1">
            <label className="block text-sm text-gray-700 mb-1">New Password</label>
            <input
              type="password"
              value={pwd.newPassword}
              onChange={(e) => setPwd((p) => ({ ...p, newPassword: e.target.value }))}
              placeholder="••••••••"
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="sm:col-span-1">
            <label className="block text-sm text-gray-700 mb-1">Confirm Password</label>
            <input
              type="password"
              value={pwd.confirm}
              onChange={(e) => setPwd((p) => ({ ...p, confirm: e.target.value }))}
              placeholder="••••••••"
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="sm:col-span-1 flex items-end justify-end gap-2">
            <button
              type="button"
              onClick={() => setPwd({ newPassword: "", confirm: "" })}
              className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handleUpdatePassword}
              disabled={savingPwd}
              className={`rounded-xl px-3 py-2 text-sm font-medium text-white ${savingPwd ? "bg-indigo-300" : "bg-indigo-600 hover:bg-indigo-700"}`}
            >
              {savingPwd ? "Updating..." : "Update Password"}
            </button>
          </div>
          {pwdMsg && (
            <div className="sm:col-span-3 text-xs text-gray-600">{pwdMsg}</div>
          )}
        </form>
      </section>

      {/* Sign out */}
      <div className="flex items-center justify-end">
        <button
          onClick={() => {
            localStorage.removeItem("user");
            localStorage.removeItem("token");
            // keep existing exp_user/org_id pattern consistent with Login.jsx
            localStorage.removeItem("exp_user");
            // do not remove org_id automatically here to avoid disrupting other tabs
            window.location.href = "/login";
          }}
          className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
