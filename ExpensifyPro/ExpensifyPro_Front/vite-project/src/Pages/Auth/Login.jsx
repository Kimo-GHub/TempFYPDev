import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiService } from "../../api";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const routeByRole = (role) => {
    if (role === 1) return "/admin";
    if (role === 2) return "/user/home";
    if (role === 3) return "/user/home";
    return "/user/home";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    try {
      setLoading(true);
      const user = await apiService.login(email, password);
      localStorage.setItem("exp_user", JSON.stringify(user));
      if (user?.org_id != null) localStorage.setItem("org_id", String(user.org_id));
      navigate(routeByRole(user?.role));
    } catch (err) {
      setError(err.message || "Invalid credentials");
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
              Welcome to ExpensifyPro
            </span>
            <h1 className="text-4xl font-semibold text-white drop-shadow">
              Manage your finances <span className="text-emerald-300">with clarity</span>
            </h1>
            <p className="text-base text-white/80">
              Log in to keep tracking accounts, budgets, and projects from one intuitive workspace.
            </p>
            <div className="flex items-center justify-center gap-4 text-sm text-white/75 lg:justify-start">
              <div>
                <div className="text-2xl font-semibold text-white">2K+</div>
                Trusted teams
              </div>
              <div className="h-10 w-px bg-white/40" />
              <div>
                <div className="text-2xl font-semibold text-white">4.9/5</div>
                User satisfaction
              </div>
            </div>
          </div>

          <div className="w-full max-w-md rounded-3xl border border-white/50 bg-white/95 p-8 shadow-2xl backdrop-blur-md">
            <h2 className="text-center text-2xl font-semibold text-slate-900">Welcome back</h2>
            <p className="mt-1 text-center text-sm text-slate-500">Log in to continue where you left off.</p>

            {error && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Email</label>
                <div className="flex items-center rounded-2xl border border-slate-200 bg-white px-3 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100">
                  <span className="text-slate-400">✉</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="yousifitani@example.com"
                    className="w-full flex-1 bg-transparent px-3 py-2 text-sm text-slate-900 outline-none"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Password</label>
                <div className="flex items-center rounded-2xl border border-slate-200 bg-white px-3 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100">
                  <span className="text-slate-400">🔒</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full flex-1 bg-transparent px-3 py-2 text-sm text-slate-900 outline-none"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-60"
              >
                {loading ? "Logging in..." : "Log in"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-500">
              Don't have an account?{" "}
              <Link to="/register" className="font-semibold text-emerald-600 hover:underline">
                Create one
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
