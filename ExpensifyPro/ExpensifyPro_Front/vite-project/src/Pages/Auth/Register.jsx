import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiService } from "../../api";

export default function Register() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!name || !email || !password) {
      setError("All fields are required.");
      return;
    }
    try {
      setLoading(true);
      const user = await apiService.registerAdmin(email, password);
      localStorage.setItem("exp_user", JSON.stringify(user));
      if (user?.org_id != null) localStorage.setItem("org_id", String(user.org_id));
      navigate("/admin");
    } catch (err) {
      setError(err.message || "Unable to create organization");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/assets/BackgroundImg1.png')" }}>
      <div className="min-h-screen bg-slate-900/20">
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center gap-10 px-6 py-12 lg:flex-row">
          <div className="flex-1 space-y-5 text-center text-white lg:text-left">
            <span className="inline-flex items-center rounded-full bg-white/80 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700 shadow">
              Get started in minutes
            </span>
            <h1 className="text-4xl font-semibold text-white">
              Launch your <span className="text-emerald-300">ExpensifyPro</span> workspace
            </h1>
            <p className="text-base text-white/80">
              Create your organization to unlock admin tools, reporting dashboards, and team collaboration features.
            </p>
            <ul className="space-y-2 text-sm text-white/75">
              <li>✓ Unlimited users and role-based permissions</li>
              <li>✓ Real-time budgets, accounts, and project tracking</li>
              <li>✓ Forecasting & AI-powered insights</li>
            </ul>
          </div>

          <div className="w-full max-w-md rounded-3xl border border-white/50 bg-white/95 p-8 shadow-2xl backdrop-blur-md">
            <h2 className="text-center text-2xl font-semibold text-slate-900">Create your organization</h2>
            <p className="mt-1 text-center text-sm text-slate-500">Set up a new workspace and invite your team later.</p>

            {error && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Full name</label>
                <div className="rounded-2xl border border-slate-200 bg-white px-3 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Karim Hijazi"
                    className="w-full bg-transparent px-2 py-2 text-sm text-slate-900 outline-none"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Work email</label>
                <div className="rounded-2xl border border-slate-200 bg-white px-3 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="finance@company.com"
                    className="w-full bg-transparent px-2 py-2 text-sm text-slate-900 outline-none"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Password</label>
                <div className="rounded-2xl border border-slate-200 bg-white px-3 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-transparent px-2 py-2 text-sm text-slate-900 outline-none"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-60"
              >
                {loading ? "Creating..." : "Create organization"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-500">
              Already have an account?{" "}
              <Link to="/login" className="font-semibold text-emerald-600 hover:underline">
                Log in
              </Link>
            </p>

            <div className="mt-4 text-center">
              <Link
                to="/"
                className="inline-flex items-center text-xs font-semibold text-emerald-600 hover:text-emerald-700"
              >
                ← Back to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
