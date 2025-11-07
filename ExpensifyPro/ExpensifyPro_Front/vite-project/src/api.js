// src/api.js
const API_BASE = "http://localhost:8000/api";

/* ------------------ core helpers ------------------ */
const safeParse = async (response) => {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text || null;
  }
};

const handleResponse = async (response) => {
  const data = await safeParse(response);
  if (!response.ok) {
    const msg =
      (data && (data.message || data.detail)) ||
      (typeof data === "string" ? data : null) ||
      `HTTP ${response.status}`;
    const err = new Error(msg);
    err.status = response.status;
    err.payload = data;
    throw err;
  }
  return data;
};

const getCookie = (name) => {
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
};

const buildQuery = (params = {}) =>
  Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

/* ------------------ fetch wrappers ------------------ */
/** No org / no csrf expectations (use for login/register) */
const noAuthFetch = (url, { method = "GET", headers = {}, body } = {}) => {
  const h = { ...headers };
  if (body !== undefined && !h["Content-Type"]) h["Content-Type"] = "application/json";

  const opts = {
    method,
    headers: h,
    credentials: "include", // keep cookies enabled in case server sets session
  };
  if (body !== undefined) {
    opts.body = typeof body === "string" ? body : JSON.stringify(body);
  }
  return fetch(url, opts).then(handleResponse);
};

/** Org-scoped + cookies + CSRF for unsafe methods */
const authFetch = (url, { method = "GET", headers = {}, body } = {}) => {
  const h = { ...headers };

  // Org scoping
  const orgId = localStorage.getItem("org_id");
  if (orgId) h["X-Org-Id"] = orgId;

  // CSRF for unsafe methods
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrftoken = getCookie("csrftoken");
    if (csrftoken) h["X-CSRFToken"] = csrftoken;
    if (!h["Content-Type"]) h["Content-Type"] = "application/json";
  }

  const opts = {
    method,
    headers: h,
    credentials: "include",
  };
  if (body !== undefined) {
    opts.body = typeof body === "string" ? body : JSON.stringify(body);
    if (!h["Content-Type"]) opts.headers["Content-Type"] = "application/json";
  }

  return fetch(url, opts).then(handleResponse);
};

/* ------------------ API surface ------------------ */
export const apiService = {
  /* ========= Auth ========= */
  // Use noAuthFetch for these (no org header required yet)
  login: (email, password) =>
    noAuthFetch(`${API_BASE}/auth/login/`, {
      method: "POST",
      body: { email, password },
    }).then((user) => {
      if (user && user.org_id) localStorage.setItem("org_id", String(user.org_id));
      return user;
    }),

  registerAdmin: (email, password) =>
    noAuthFetch(`${API_BASE}/auth/register_admin/`, {
      method: "POST",
      body: { email, password },
    }).then((user) => {
      if (user && user.org_id) localStorage.setItem("org_id", String(user.org_id));
      return user;
    }),

  /* ========= Users ========= */
  getUsers: (filters = {}) => {
    const qs = buildQuery({
      page: filters.page || 1,
      page_size: filters.page_size || 10,
      q: filters.q,
      email: filters.email,
      name: filters.name,
      role: filters.role,
      org_id: localStorage.getItem("org_id") || undefined,
    });
    return authFetch(`${API_BASE}/users/${qs ? `?${qs}` : ""}`);
  },
  getUserById: (id) => authFetch(`${API_BASE}/users/${id}/`),
  createUser: (userData) =>
    authFetch(`${API_BASE}/users/`, { method: "POST", body: userData }),
  updateUser: (id, data) =>
    authFetch(`${API_BASE}/users/${id}/`, { method: "PATCH", body: data }),
  deleteUser: (id) => authFetch(`${API_BASE}/users/${id}/`, { method: "DELETE" }),

  /* ========= Accounts ========= */
  getAccounts: (filters = {}) => {
    const qs = buildQuery({
      page: filters.page || 1,
      page_size: filters.page_size || 10,
      q: filters.q,
      user_id: filters.user_id,
      type: filters.type,
      currency: filters.currency,
      is_default: filters.is_default,
      org_id: localStorage.getItem("org_id") || undefined,
    });
    return authFetch(`${API_BASE}/accounts/${qs ? `?${qs}` : ""}`);
  },
  getAccountById: (id) => authFetch(`${API_BASE}/accounts/${id}/`),
  createAccount: (data) =>
    authFetch(`${API_BASE}/accounts/`, { method: "POST", body: data }),
  updateAccount: (id, data) =>
    authFetch(`${API_BASE}/accounts/${id}/`, { method: "PATCH", body: data }),
  deleteAccount: (id) =>
    authFetch(`${API_BASE}/accounts/${id}/`, { method: "DELETE" }),

  /* ========= Projects ========= */
  getProjects: (filters = {}) => {
    const qs = buildQuery({
      page: filters.page || 1,
      page_size: filters.page_size || 10,
      q: filters.q,
      user_id: filters.user_id,
      is_active: filters.is_active,
      org_id: localStorage.getItem("org_id") || undefined,
    });
    return authFetch(`${API_BASE}/projects/${qs ? `?${qs}` : ""}`);
  },
  getProjectById: (id) => authFetch(`${API_BASE}/projects/${id}/`),
  createProject: (data) =>
    authFetch(`${API_BASE}/projects/`, { method: "POST", body: data }),
  updateProject: (id, data) =>
    authFetch(`${API_BASE}/projects/${id}/`, { method: "PATCH", body: data }),
  deleteProject: (id) =>
    authFetch(`${API_BASE}/projects/${id}/`, { method: "DELETE" }),

  /* ========= Categories ========= */
  getCategories: (filters = {}) => {
    const qs = buildQuery({
      page: filters.page || 1,
      page_size: filters.page_size || 10,
      q: filters.q,
      user_id: filters.user_id,
      kind: filters.kind,
      org_id: localStorage.getItem("org_id") || undefined,
    });
    return authFetch(`${API_BASE}/categories/${qs ? `?${qs}` : ""}`);
  },
  getCategoryById: (id) => authFetch(`${API_BASE}/categories/${id}/`),
  createCategory: (data) =>
    authFetch(`${API_BASE}/categories/`, { method: "POST", body: data }),
  updateCategory: (id, data) =>
    authFetch(`${API_BASE}/categories/${id}/`, { method: "PATCH", body: data }),
  deleteCategory: (id) =>
    authFetch(`${API_BASE}/categories/${id}/`, { method: "DELETE" }),

  /* ========= Budgets ========= */
  getBudgets: (filters = {}) => {
    const qs = buildQuery({
      page: filters.page || 1,
      page_size: filters.page_size || 10,
      q: filters.q,
      user_id: filters.user_id,
      project_id: filters.project_id,
      account_id: filters.account_id,
      category_id: filters.category_id,
      is_active: filters.is_active,
      starts_on_or_after: filters.starts_on_or_after,
      ends_on_or_before: filters.ends_on_or_before,
      org_id: localStorage.getItem("org_id") || undefined,
    });
    return authFetch(`${API_BASE}/budgets/${qs ? `?${qs}` : ""}`);
  },
  getBudgetById: (id) => authFetch(`${API_BASE}/budgets/${id}/`),
  createBudget: (data) =>
    authFetch(`${API_BASE}/budgets/`, { method: "POST", body: data }),
  updateBudget: (id, data) =>
    authFetch(`${API_BASE}/budgets/${id}/`, { method: "PATCH", body: data }),
  deleteBudget: (id) =>
    authFetch(`${API_BASE}/budgets/${id}/`, { method: "DELETE" }),

  /* ========= Transactions ========= */
  getTransactions: (filters = {}) => {
    const qs = buildQuery({
      page: filters.page || 1,
      page_size: filters.page_size || 10,
      q: filters.q,
      user_id: filters.user_id,
      account_id: filters.account_id,
      to_account_id: filters.to_account_id,
      project_id: filters.project_id,
      category_id: filters.category_id,
      type: filters.type, // income | expense | transfer
      status: filters.status, // pending | cleared | reconciled | void
      is_recurring: filters.is_recurring,
      date_from: filters.date_from,
      date_to: filters.date_to,
      min_amount: filters.min_amount,
      max_amount: filters.max_amount,
      org_id: localStorage.getItem("org_id") || undefined,
    });
    return authFetch(`${API_BASE}/transactions/${qs ? `?${qs}` : ""}`);
  },
  getTransactionById: (id) => authFetch(`${API_BASE}/transactions/${id}/`),
  createTransaction: (data) =>
    authFetch(`${API_BASE}/transactions/`, { method: "POST", body: data }),
  updateTransaction: (id, data) =>
    authFetch(`${API_BASE}/transactions/${id}/`, { method: "PATCH", body: data }),
  deleteTransaction: (id) =>
    authFetch(`${API_BASE}/transactions/${id}/`, { method: "DELETE" }),

  /* ========= Admin Dashboard Overview ========= */
  getDashboardOverview: (params = {}) => {
    const qs = buildQuery({
      currency: params.currency || "USD",
      recent_limit: params.recent_limit || 5,
      accounts_limit: params.accounts_limit || 3,
      org_id: localStorage.getItem("org_id") || params.org_id,
    });
    return authFetch(`${API_BASE}/dashboard/overview/${qs ? `?${qs}` : ""}`);
  },

  /* ========= Reports / Forecast ========= */
  getReportTimeSeries: (params = {}) => {
    const qs = buildQuery({
      ...params,
      org_id: localStorage.getItem("org_id") || params.org_id,
    });
    return authFetch(`${API_BASE}/reports/time-series/${qs ? `?${qs}` : ""}`);
  },
  getReportByCategory: (params = {}) => {
    const qs = buildQuery({
      ...params,
      org_id: localStorage.getItem("org_id") || params.org_id,
    });
    return authFetch(`${API_BASE}/reports/by-category/${qs ? `?${qs}` : ""}`);
  },
  getReportBudgetVsActual: (params = {}) => {
    const qs = buildQuery({
      ...params,
      org_id: localStorage.getItem("org_id") || params.org_id,
    });
    return authFetch(`${API_BASE}/reports/budget-vs-actual/${qs ? `?${qs}` : ""}`);
  },

  getReportForecast: (body = {}) =>
    authFetch(`${API_BASE}/forecast/`, { method: "POST", body }),

  postForecast: (payload = {}) =>
    authFetch(`${API_BASE}/forecast/`, { method: "POST", body: payload }),
};
