import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiService } from "../../api"; // make sure src/api.js exists

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const routeByRole = (role) => {
    // UserRole: 1=Admin, 2=Employee, 3=Guest
    if (role === 1) return "/admin";
    if (role === 2) return "/user/home";  // Employee
    if (role === 3) return "/user/home";  // Guest (use "/guest" later when you implement GuestHome)
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

      // Save session (simple local storage; replace with JWT/cookies later)
      localStorage.setItem("exp_user", JSON.stringify(user));

      // Store org_id separately for the API helper (headers & query param)
      if (user?.org_id != null) {
        localStorage.setItem("org_id", String(user.org_id));
      }

      // Route by role
      navigate(routeByRole(user?.role));
    } catch (err) {
      setError(err.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8">
        <h1 className="text-2xl font-semibold text-center mb-6">Welcome Back</h1>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border px-3 py-2 focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border px-3 py-2 focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 text-white rounded-lg py-2 hover:bg-emerald-700 transition disabled:opacity-60"
          >
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-4">
          Don’t have an account?{" "}
          <Link to="/register" className="text-emerald-600 hover:underline">
            Create one
          </Link>
        </p>

        <div className="text-center mt-4">
          <Link
            to="/"
            className="inline-block text-sm text-emerald-600 hover:text-emerald-700 hover:underline transition"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
