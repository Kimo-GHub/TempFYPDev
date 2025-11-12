// src/Pages/Auth/Register.jsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiService } from "../../api";

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!form.email || !form.password) return setErr("Email and password are required.");
    if (form.password.length < 6) return setErr("Password must be at least 6 characters.");

    try {
      setLoading(true);
      // Register an Organization + first Admin
      await apiService.registerAdmin(form.email, form.password);
      navigate("/login");
    } catch (error) {
      setErr(error.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8">
        <h1 className="text-2xl font-semibold text-center mb-6">Create your organization</h1>

        {err && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
            {err}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Full Name</label>
            <input
              name="name"
              value={form.name}
              onChange={onChange}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">Email</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={onChange}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">Password</label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={onChange}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          {/* Role removed: this endpoint always creates an Admin in a new org */}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 text-white rounded-xl py-2 hover:bg-emerald-700 transition disabled:opacity-60"
          >
            {loading ? "Creating..." : "Create organization"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-4">
          Already have an account?{" "}
          <Link to="/login" className="text-emerald-600 hover:underline">
            Log in
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
