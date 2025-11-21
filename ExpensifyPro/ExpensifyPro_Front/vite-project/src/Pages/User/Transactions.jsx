import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { apiService } from "../../api";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import useCategories from "../../hooks/useCategories";
import { useNotifications } from "../../components/NotificationContext.jsx";

const COLORS = {
  income: "text-emerald-700",
  expense: "text-red-600",
  transfer: "text-indigo-600",
};

const tidy = (s) => (s ? s[0].toUpperCase() + s.slice(1) : "-");
const fmtMoney = (v, currency = "USD") =>
  new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 })
    .format(Number(v || 0));
const fmtFullMoney = (v, currency = "USD") =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(v || 0));

export default function Transactions() {
  const location = useLocation();
  const notify = useNotifications();
  // Data
  const [rows, setRows] = useState([]);
  const [info, setInfo] = useState({ current_page: 1, total_pages: 1, total_items: 0 });
  const currentUserId = (() => { try { return JSON.parse(localStorage.getItem("exp_user") || "{}").id || null; } catch { return null; } })();
  const [filters, setFilters] = useState({ page: 1, page_size: 10, q: "", type: undefined, account_id: undefined, date_from: "", date_to: "", is_recurring: undefined, user_id: currentUserId });
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Accounts for filters/forms
  const [accounts, setAccounts] = useState([]);
  const accountsMap = useMemo(() => {
    const m = new Map();
    for (const a of accounts) m.set(a.id, a.name);
    return m;
  }, [accounts]);
  const accountById = useMemo(() => {
    const m = new Map();
    for (const a of accounts) m.set(a.id, a);
    return m;
  }, [accounts]);
  useEffect(() => {
    (async () => {
      try {
        const acc = await apiService.getAccounts({ page: 1, page_size: 100, user_id: currentUserId });
        setAccounts(acc?.results ?? []);
      } catch {
        setAccounts([]);
      }
    })();
  }, []);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => ({ ...f, q: searchInput, page: 1 })), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    const params = new URLSearchParams(location.search || "");
    const parseNumber = (value) => {
      if (!value) return undefined;
      const n = Number(value);
      return Number.isNaN(n) ? undefined : n;
    };
    const parseRecurring = (value) => {
      if (!value) return undefined;
      const normalized = value.toLowerCase();
      if (["1", "true", "yes"].includes(normalized)) return true;
      if (["0", "false", "no"].includes(normalized)) return false;
      return undefined;
    };
    const q = params.get("q") || "";
    setFilters((prev) => ({
      ...prev,
      q,
      page: 1,
      type: params.get("type") || undefined,
      account_id: parseNumber(params.get("account_id")),
      date_from: params.get("date_from") || "",
      date_to: params.get("date_to") || "",
      is_recurring: parseRecurring(params.get("recurring")),
    }));
    setSearchInput(q);
  }, [location.search]);

  // Fetch transactions
  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true); setErr("");
      try {
        const res = await apiService.getTransactions(filters);
        if (ignore) return;
        setRows(res?.results ?? []);
        setInfo(res?.info ?? { current_page: 1, total_pages: 1, total_items: 0 });
      } catch (e) {
        if (ignore) return;
        setErr(e?.message || "Failed to load transactions");
        setRows([]); setInfo({ current_page: 1, total_pages: 1, total_items: 0 });
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [filters.page, filters.page_size, filters.q, filters.type, filters.account_id, filters.date_from, filters.date_to, filters.user_id, filters.is_recurring]);

  // Local refetch helper to reload current page without changing filters
  const refetch = async () => {
    try {
      const res = await apiService.getTransactions(filters);
      setRows(res?.results ?? []);
      setInfo(res?.info ?? { current_page: 1, total_pages: 1, total_items: 0 });
    } catch (e) {
      setErr(e?.message || "Failed to load transactions");
    }
  };

  const pages = useMemo(() => {
    const arr = [];
    const start = Math.max(1, info.current_page - 2);
    const end = Math.min(info.total_pages, start + 4);
    for (let p = start; p <= end; p++) arr.push(p);
    return arr;
  }, [info]);

  // Page stats (based on rows)
  const pageCurrency = rows[0]?.currency || "USD";
  const totals = useMemo(() => {
    let income = 0, expense = 0, transfer = 0;
    for (const r of rows) {
      const amt = Number(r.amount || 0);
      if (r.type === "income") income += amt;
      else if (r.type === "expense") expense += Math.abs(amt);
      else if (r.type === "transfer") transfer += Math.abs(amt);
    }
    return { income, expense, net: income - expense, transfer };
  }, [rows]);

  const fmtDate = (iso) =>
    iso ? new Date(iso).toLocaleString(undefined, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-";

  const { categories, categoriesMap } = useCategories();

  // Create modal
  const [addOpen, setAddOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [addForm, setAddForm] = useState({ type: "expense", amount: "", currency: "USD", description: "", date: "", account: "", to_account: "", category: "" });
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [excelModalOpen, setExcelModalOpen] = useState(false);
  const [excelRows, setExcelRows] = useState([]);
  const [excelErrors, setExcelErrors] = useState([]);
  const [excelProcessing, setExcelProcessing] = useState(false);
  const [excelNotice, setExcelNotice] = useState("");
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptForms, setReceiptForms] = useState([]);
  const [receiptProcessing, setReceiptProcessing] = useState(false);
  const [receiptNotice, setReceiptNotice] = useState("");

  useEffect(() => {
    const closeDropdowns = () => {
      setImportOpen(false);
      setExportOpen(false);
    };
    document.addEventListener("click", closeDropdowns);
    return () => document.removeEventListener("click", closeDropdowns);
  }, []);

  useEffect(() => {
    if (addForm.type === "transfer" && addForm.category) {
      setAddForm((f) => ({ ...f, category: "" }));
    }
  }, [addForm.type]);

  const onCreate = async () => {
    if (!addForm.type) return;
    if (addForm.amount === "" || Number.isNaN(Number(addForm.amount))) { setErr("Enter a valid amount"); return; }
    if (!addForm.account) { setErr("Select an account"); return; }
    if (!addForm.date) { setErr("Select a date/time"); return; }
    if (addForm.type === "transfer" && !addForm.to_account) { setErr("Select a destination account"); return; }
    if (addForm.type !== "transfer" && !addForm.category) { setErr("Select a category"); return; }

    if (!currentUserId) { setErr("Missing user session"); return; }
    setCreating(true); setErr("");
    try {
      const payload = {
        type: addForm.type,
        amount: Number(addForm.amount),
        currency: (addForm.currency || "USD").toUpperCase().slice(0,3),
        description: addForm.description || undefined,
        date: new Date(addForm.date).toISOString(),
        user: currentUserId,
        account: Number(addForm.account),
        to_account: addForm.type === "transfer" ? Number(addForm.to_account) : undefined,
        category: addForm.type === "transfer" ? undefined : Number(addForm.category),
      };
      await apiService.createTransaction(payload);
      try {
        await applyTxEffect(payload, +1);
      } catch { /* ignore balance errors */ }
      setAddOpen(false);
      setAddForm({ type: "expense", amount: "", currency: "USD", description: "", date: "", account: "", to_account: "", category: "" });
      await refetch();
      notify({ type: "success", message: "Transaction added successfully." });
    } catch (e) {
      setErr(e?.message || "Failed to create transaction");
    } finally {
      setCreating(false);
    }
  };

  // Edit/Delete
  const [editing, setEditing] = useState(null); // transaction row
  const [editForm, setEditForm] = useState({ type: "expense", amount: "", currency: "USD", description: "", date: "", account: "", to_account: "", category: "" });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    if (editForm.type === "transfer" && editForm.category) {
      setEditForm((f) => ({ ...f, category: "" }));
    }
  }, [editForm.type]);

  const onOpenEdit = (t) => {
    setEditing(t);
    setEditForm({
      type: t.type || "expense",
      amount: t.amount ?? "",
      currency: (t.currency || "USD").toUpperCase(),
      description: t.description || "",
      date: t.date ? new Date(t.date).toISOString().slice(0,16) : "",
      account: t.account_id || "",
      to_account: t.to_account_id || "",
      category: t.category_id || "",
    });
  };

  const onSaveEdit = async () => {
    if (!editing) return;
    if (editForm.amount === "" || Number.isNaN(Number(editForm.amount))) { setErr("Enter a valid amount"); return; }
    if (!editForm.account) { setErr("Select an account"); return; }
    if (!editForm.date) { setErr("Select a date/time"); return; }
    if (editForm.type === "transfer" && !editForm.to_account) { setErr("Select a destination account"); return; }
    if (editForm.type !== "transfer" && !editForm.category) { setErr("Select a category"); return; }
    setSaving(true); setErr("");
    try {
      const payload = {
        type: editForm.type,
        amount: Number(editForm.amount),
        currency: (editForm.currency || "USD").toUpperCase().slice(0,3),
        description: editForm.description || undefined,
        date: new Date(editForm.date).toISOString(),
        account: Number(editForm.account),
        to_account: editForm.type === "transfer" ? Number(editForm.to_account) : undefined,
        category: editForm.type === "transfer" ? undefined : Number(editForm.category),
      };
      await apiService.updateTransaction(editing.id, payload);
      try {
        await applyTxEffect(editing, -1);
        await applyTxEffect(payload, +1);
      } catch { /* ignore balance errors */ }
      setEditing(null);
      await refetch();
      notify({ type: "success", message: "Transaction updated." });
    } catch (e) {
      setErr(e?.message || "Failed to update transaction");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id) => {
    if (!confirm("Delete this transaction?")) return;
    setDeletingId(id);
    setErr("");
    try {
      await apiService.deleteTransaction(id);
      // if we still have the row, apply inverse effect locally
      const old = rows.find((r) => r.id === id);
      if (old) {
        try { await applyTxEffect(old, -1); } catch {}
      }
      const isLast = rows.length === 1 && info.current_page > 1;
      if (isLast) {
        setFilters((f) => ({ ...f, page: info.current_page - 1 }));
      } else {
        await refetch();
      }
      notify({ type: "success", message: "Transaction deleted." });
    } catch (e) {
      setErr(e?.message || "Failed to delete transaction");
    } finally {
      setDeletingId(null);
    }
  };

  // ---- Helper: adjust account balances and notify Accounts tab ----
  const applyTxEffect = async (tx, mult) => {
    // tx can be original row or our payload shape
    const type = tx.type;
    const amt = Number(tx.amount || 0) * (isNaN(Number(tx.amount)) ? 0 : 1);
    if (!amt) return;
    const deltas = new Map();
    if (type === "expense") {
      if (tx.account) deltas.set(Number(tx.account), -(amt * mult));
      if (tx.account_id) deltas.set(Number(tx.account_id), -(amt * mult));
    } else if (type === "income") {
      if (tx.account) deltas.set(Number(tx.account), +(amt * mult));
      if (tx.account_id) deltas.set(Number(tx.account_id), +(amt * mult));
    } else if (type === "transfer") {
      const fromId = Number(tx.account || tx.account_id);
      const toId = Number(tx.to_account || tx.to_account_id);
      if (fromId) deltas.set(fromId, -(amt * mult));
      if (toId) deltas.set(toId, +(amt * mult));
    }

    // push updates to server; update local cache too
    for (const [id, delta] of deltas.entries()) {
      const acc = accountById.get(id);
      if (!acc) continue;
      const before = Number(acc.balance || 0);
      const after = before + delta;
      try {
        await apiService.updateAccount(id, { balance: after });
      } catch { /* ignore */ }
      acc.balance = after; // mutate local cache for immediate UI usage
    }
    try {
      localStorage.setItem("accounts:refresh", String(Date.now()));
      window.dispatchEvent(new Event("accounts:refresh"));
    } catch {
      // ignore
    }
  };

  const resolveAccountId = (value) => {
    if (!value) return null;
    const stringValue = String(value).trim().toLowerCase();
    const byId = accounts.find((a) => String(a.id) === stringValue);
    if (byId) return byId.id;
    const byName = accounts.find(
      (a) => (a.name || "").trim().toLowerCase() === stringValue,
    );
    return byName?.id || null;
  };

  const resolveCategoryId = (value) => {
    if (!value) return null;
    const stringValue = String(value).trim().toLowerCase();
    const byId = categories.find((c) => String(c.id) === stringValue);
    if (byId) return byId.id;
    const byName = categories.find(
      (c) => (c.name || "").trim().toLowerCase() === stringValue,
    );
    return byName?.id || null;
  };

  const handleExcelOption = (e) => {
    e.stopPropagation();
    setImportOpen(false);
    setExcelRows([]);
    setExcelErrors([]);
    setExcelNotice("");
    setExcelModalOpen(true);
  };

  const handleReceiptOption = (e) => {
    e.stopPropagation();
    setImportOpen(false);
    setReceiptForms([]);
    setReceiptNotice("");
    setReceiptModalOpen(true);
  };

  const handleExcelFile = (file) => {
    if (!file) return;
    setExcelNotice(`Parsing "${file.name}"...`);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        setExcelRows(json);
        setExcelErrors([]);
        setExcelNotice(`Loaded ${json.length} row(s). Review and import.`);
      } catch (err) {
        setExcelNotice("Unable to read workbook. Please check the template.");
        setExcelRows([]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const processExcelRows = async () => {
    if (!excelRows.length) {
      setExcelNotice("Upload an Excel file first.");
      return;
    }
    setExcelProcessing(true);
    const errors = [];
    let success = 0;
    for (let i = 0; i < excelRows.length; i += 1) {
      const row = excelRows[i];
      const typeRaw = String(row.type || row.Type || "").trim().toLowerCase();
      if (!["income", "expense", "transfer"].includes(typeRaw)) {
        errors.push({ row: i + 2, message: "Invalid type (income/expense/transfer)" });
        continue;
      }
      const accountValue =
        row.account ||
        row.Account ||
        row.account_name ||
        row["Account Name"] ||
        "";
      const accountId = resolveAccountId(accountValue);
      if (!accountId) {
        errors.push({ row: i + 2, message: "Account not found" });
        continue;
      }
      let toAccountId = null;
      if (typeRaw === "transfer") {
        const toValue =
          row.to_account || row["To Account"] || row.destination_account || "";
        toAccountId = resolveAccountId(toValue);
        if (!toAccountId) {
          errors.push({ row: i + 2, message: "Transfer requires destination account" });
          continue;
        }
      }
      const categoryValue =
        row.category || row.Category || row.category_name || row["Category Name"];
      const categoryId =
        typeRaw === "transfer" ? null : resolveCategoryId(categoryValue);
      if (typeRaw !== "transfer" && !categoryId) {
        errors.push({ row: i + 2, message: "Category not found" });
        continue;
      }
      const amount = Number(row.amount || row.Amount || 0);
      if (!amount || Number.isNaN(amount)) {
        errors.push({ row: i + 2, message: "Amount is required" });
        continue;
      }
      const currency = (row.currency || row.Currency || "USD").toUpperCase();
      const dateValue = row.date || row.Date;
      const parsedDate = dateValue ? new Date(dateValue) : null;
      if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
        errors.push({ row: i + 2, message: "Date is required" });
        continue;
      }
      const payload = {
        type: typeRaw,
        amount,
        currency,
        description: row.description || row.Description || undefined,
        date: parsedDate.toISOString(),
        user: currentUserId,
        account: accountId,
        to_account: typeRaw === "transfer" ? toAccountId : undefined,
        category: typeRaw === "transfer" ? undefined : categoryId,
      };
      try {
        await apiService.createTransaction(payload);
        success += 1;
      } catch (err) {
        errors.push({ row: i + 2, message: err?.message || "Failed to save row" });
      }
    }
    setExcelErrors(errors);
    setExcelProcessing(false);
    if (!errors.length) {
      setExcelNotice(`Imported ${success} row(s) successfully.`);
      setExcelModalOpen(false);
      await refetch();
    } else {
      setExcelNotice(`Imported ${success} row(s). ${errors.length} error(s) require attention.`);
    }
  };

  const handleReceiptFiles = (files) => {
    if (!files?.length) return;
    const newForms = [];
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        newForms.push({
          id: `${file.name}-${Date.now()}`,
          name: file.name,
          preview: event.target.result,
          type: "expense",
          amount: "",
          date: new Date().toISOString().slice(0, 16),
          account: "",
          description: "",
        });
        setReceiptForms((prev) => [...prev, ...newForms]);
      };
      reader.readAsDataURL(file);
    });
  };

  const updateReceiptForm = (formId, key, value) => {
    setReceiptForms((prev) =>
      prev.map((form) => (form.id === formId ? { ...form, [key]: value } : form)),
    );
  };

  const processReceiptForms = async () => {
    if (!receiptForms.length) {
      setReceiptNotice("Upload receipt images first.");
      return;
    }
    setReceiptProcessing(true);
    let success = 0;
    const errors = [];
    for (const form of receiptForms) {
      if (!form.amount || Number.isNaN(Number(form.amount))) {
        errors.push(`${form.name}: missing amount`);
        continue;
      }
      if (!form.account) {
        errors.push(`${form.name}: select an account`);
        continue;
      }
      const payload = {
        type: form.type,
        amount: Number(form.amount),
        currency: "USD",
        description: form.description || `Receipt import - ${form.name}`,
        date: form.date ? new Date(form.date).toISOString() : new Date().toISOString(),
        user: currentUserId,
        account: Number(form.account),
        receipt_url: form.preview,
        category: form.type === "transfer" ? undefined : (categories[0]?.id ?? undefined),
      };
      try {
        await apiService.createTransaction(payload);
        success += 1;
      } catch (err) {
        errors.push(`${form.name}: ${err?.message || "Failed to import"}`);
      }
    }
    setReceiptProcessing(false);
    if (!errors.length) {
      setReceiptNotice(`Imported ${success} receipt(s).`);
      setReceiptForms([]);
      setReceiptModalOpen(false);
      await refetch();
    } else {
      setReceiptNotice(`Imported ${success}. Issues:\n${errors.join("\n")}`);
    }
  };

  const handleExportExcel = () => {
    if (!rows.length) return;
    const worksheetData = rows.map((row) => ({
      Date: fmtDate(row.date),
      Description: row.description || "-",
      Account: accountsMap.get(row.account_id) || row.account_id || "-",
      Type: tidy(row.type),
      Amount: row.amount,
      Currency: row.currency || pageCurrency,
      Category: categoriesMap[row.category_id]?.name || "Unassigned",
    }));
    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buffer], { type: "application/octet-stream" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "transactions.xlsx";
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    if (!rows.length) return;
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("Transactions report", 14, 16);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);
    autoTable(doc, {
      startY: 28,
      head: [["Date", "Description", "Account", "Type", "Amount"]],
      body: rows.map((row) => [
        fmtDate(row.date),
        row.description || "-",
        accountsMap.get(row.account_id) || row.account_id || "-",
        tidy(row.type),
        fmtFullMoney(row.amount, row.currency || pageCurrency),
      ]),
      styles: { fontSize: 9 },
      columnStyles: { 1: { cellWidth: 60 } },
    });
    doc.save("transactions.pdf");
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Transactions</h1>
          <p className="text-gray-600 text-sm">Review and add your transactions.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search description"
            className="h-9 w-56 rounded-xl border border-gray-300 px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <select
            value={filters.page_size}
            onChange={(e) => setFilters((f) => ({ ...f, page_size: Number(e.target.value), page: 1 }))}
            className="h-9 rounded-xl border border-gray-300 px-2 text-sm"
          >
            {[5,10,20,50].map(n => <option key={n} value={n}>{n}/page</option>)}
          </select>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setImportOpen((prev) => !prev);
                  setExportOpen(false);
                }}
                className="h-9 rounded-xl border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:border-indigo-300 hover:text-indigo-600"
              >
                Import
              </button>
              {importOpen && (
                <div className="absolute right-0 z-10 mt-2 w-44 rounded-2xl border border-slate-200 bg-white py-2 text-sm shadow-xl">
                  <button
                    type="button"
                    onClick={handleExcelOption}
                    className="block w-full px-4 py-2 text-left text-slate-600 hover:bg-slate-50"
                  >
                    Excel (.xlsx)
                  </button>
                  <button
                    type="button"
                    onClick={handleReceiptOption}
                    className="block w-full px-4 py-2 text-left text-slate-600 hover:bg-slate-50"
                  >
                    Images / receipts
                  </button>
                </div>
              )}
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExportOpen((prev) => !prev);
                  setImportOpen(false);
                }}
                className="h-9 rounded-xl border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:border-indigo-300 hover:text-indigo-600"
              >
                Export
              </button>
              {exportOpen && (
                <div className="absolute right-0 z-10 mt-2 w-44 rounded-2xl border border-slate-200 bg-white py-2 text-sm shadow-xl">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExportOpen(false);
                      handleExportExcel();
                    }}
                    className="block w-full px-4 py-2 text-left text-slate-600 hover:bg-slate-50"
                  >
                    Excel (.xlsx)
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExportOpen(false);
                      handleExportPDF();
                    }}
                    className="block w-full px-4 py-2 text-left text-slate-600 hover:bg-slate-50"
                  >
                    PDF summary
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={() => setAddOpen(true)}
              className="h-9 rounded-xl bg-indigo-600 px-3 text-sm font-medium text-white hover:bg-indigo-700"
            >
              + Add Transaction
            </button>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <div className="text-xs text-gray-600">Income (page)</div>
          <div className="mt-1 text-lg font-semibold text-emerald-700">{fmtMoney(totals.income, pageCurrency)}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <div className="text-xs text-gray-600">Expense (page)</div>
          <div className="mt-1 text-lg font-semibold text-red-600">{fmtMoney(totals.expense, pageCurrency)}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <div className="text-xs text-gray-600">Net (page)</div>
          <div className={`mt-1 text-lg font-semibold ${totals.net >= 0 ? "text-emerald-700" : "text-red-600"}`}>{fmtMoney(totals.net, pageCurrency)}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { v: undefined, label: "All" },
            { v: "income", label: "Income" },
            { v: "expense", label: "Expense" },
            { v: "transfer", label: "Transfer" },
          ].map(opt => (
            <button
              key={String(opt.v ?? "all")}
              onClick={() => setFilters((f) => ({ ...f, type: opt.v, page: 1 }))}
              className={`rounded-xl px-3 py-1.5 text-xs border ${ (filters.type ?? undefined) === opt.v ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-gray-300 hover:bg-gray-50"}`}
            >{opt.label}</button>
          ))}
          {(filters.type ?? undefined) !== undefined && (
            <button onClick={() => setFilters((f) => ({ ...f, type: undefined, page: 1 }))} className="rounded-xl px-3 py-1.5 text-xs border border-gray-300 hover:bg-gray-50">Clear</button>
          )}

          <div className="h-6 w-px bg-gray-200 mx-1" />
          <select
            value={filters.is_recurring === undefined ? "" : filters.is_recurring ? "true" : "false"}
            onChange={(e) => {
              const val = e.target.value;
              setFilters((f) => ({
                ...f,
                is_recurring: val === "" ? undefined : val === "true",
                page: 1,
              }));
            }}
            className="h-9 rounded-xl border border-gray-300 px-2 text-sm"
          >
            <option value="">All schedules</option>
            <option value="true">Automations only</option>
            <option value="false">Manual only</option>
          </select>

          <div className="h-6 w-px bg-gray-200 mx-1" />
          <select
            value={filters.account_id || ""}
            onChange={(e) => setFilters((f) => ({ ...f, account_id: e.target.value ? Number(e.target.value) : undefined, page: 1 }))}
            className="h-9 rounded-xl border border-gray-300 px-2 text-sm"
          >
            <option value="">All accounts</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>

          <div className="h-6 w-px bg-gray-200 mx-1" />
          <input
            type="date"
            value={filters.date_from || ""}
            onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value || undefined, page: 1 }))}
            className="h-9 rounded-xl border border-gray-300 px-2 text-sm"
          />
          <span className="text-xs text-gray-500">to</span>
          <input
            type="date"
            value={filters.date_to || ""}
            onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value || undefined, page: 1 }))}
            className="h-9 rounded-xl border border-gray-300 px-2 text-sm"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        {loading ? (
          <div className="text-sm text-gray-600">Loading...</div>
        ) : err ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                      <th className="py-2">Date</th>
                      <th className="py-2">Description</th>
                      <th className="py-2">ID</th>
                      <th className="py-2">Account</th>
                      <th className="py-2">Type</th>
                      <th className="py-2 text-right">Amount</th>
                      <th className="py-2">Currency</th>
                      <th className="py-2">Project</th>
                    <th className="py-2">Category</th>
                    <th className="py-2">Status</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => {
                    const color = COLORS[t.type] || "";
                    const sign = t.type === "expense" ? "-" : t.type === "income" ? "+" : "±";
                    return (
                      <tr key={t.id} className="border-t">
                        <td className="py-2">{fmtDate(t.date)}</td>
                        <td className="py-2">{t.description || "-"}</td>
                        <td className="py-2 text-xs text-slate-500">#{t.id}</td>
                        <td className="py-2">{accountsMap.get(t.account_id) || t.account_id || "-"}</td>
                        <td className="py-2">{tidy(t.type)}</td>
                        <td className={`py-2 text-right ${color}`}>{sign}{fmtMoney(t.amount, t.currency || pageCurrency)}</td>
                        <td className="py-2">{t.currency || pageCurrency}</td>
                        <td className="py-2">{t.project_id || "-"}</td>
                        <td className="py-2">
                          {t.category_id ? (
                            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                              {categoriesMap[t.category_id]?.name || `Category ${t.category_id}`}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">Unassigned</span>
                          )}
                        </td>
                        <td className="py-2">{tidy(t.status) || "-"}</td>
                        <td className="py-2">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => onOpenEdit(t)} className="rounded-xl border px-3 py-1 text-xs hover:bg-gray-50">Edit</button>
                            <button onClick={() => onDelete(t.id)} disabled={deletingId === t.id} className={`rounded-xl px-3 py-1 text-xs text-white ${deletingId === t.id ? "bg-red-300" : "bg-red-600 hover:bg-red-700"}`}>{deletingId === t.id ? "Deleting..." : "Delete"}</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td className="py-6 text-center text-gray-500" colSpan={10}>No transactions found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="mt-4 flex items-center justify-between text-sm">
              <div className="text-gray-600">Showing page <span className="font-medium">{info.current_page}</span> of {info.total_pages}</div>
              <div className="flex items-center gap-2">
                <button className="rounded-xl border px-3 py-1 hover:bg-gray-50" onClick={() => setFilters((f) => ({ ...f, page: Math.max(1, info.current_page - 1) }))} disabled={info.current_page <= 1}>Prev</button>
                {pages.map((p) => (
                  <button key={p} onClick={() => setFilters((f) => ({ ...f, page: p }))} className={`rounded-xl px-3 py-1 border ${p === info.current_page ? "bg-indigo-600 text-white border-indigo-600" : "hover:bg-gray-50"}`}>{p}</button>
                ))}
                <button className="rounded-xl border px-3 py-1 hover:bg-gray-50" onClick={() => setFilters((f) => ({ ...f, page: Math.min(info.total_pages, info.current_page + 1) }))} disabled={info.current_page >= info.total_pages}>Next</button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Create modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAddOpen(false)} />
          <div className="relative w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-5 shadow-lg">
            <h3 className="text-base font-semibold">Add Transaction</h3>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <label className="block text-gray-700 mb-1">Type</label>
                <select value={addForm.type} onChange={(e) => setAddForm((f) => ({ ...f, type: e.target.value }))} className="w-full rounded-xl border border-gray-300 px-3 py-2">
                  <option value="income">Addition (+)</option>
                  <option value="expense">Expense</option>
                  <option value="transfer">Transfer</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-700 mb-1">Amount</label>
                <input type="number" step="0.01" value={addForm.amount} onChange={(e) => setAddForm((f) => ({ ...f, amount: e.target.value }))} className="w-full rounded-xl border border-gray-300 px-3 py-2" />
              </div>
              <div>
                <label className="block text-gray-700 mb-1">Currency</label>
                <input value={addForm.currency}
                readOnly
                aria-readonly="true"
                onChange={(e) => setAddForm((f) => ({ ...f, currency: e.target.value.toUpperCase().slice(0,3) }))} className="w-full rounded-xl border border-gray-300 px-3 py-2" />
              </div>
              <div>
                <label className="block text-gray-700 mb-1">Date</label>
                <input type="datetime-local" value={addForm.date} onChange={(e) => setAddForm((f) => ({ ...f, date: e.target.value }))} className="w-full rounded-xl border border-gray-300 px-3 py-2" />
              </div>
              <div>
                <label className="block text-gray-700 mb-1">Account</label>
                <select value={addForm.account} onChange={(e) => setAddForm((f) => ({ ...f, account: e.target.value }))} className="w-full rounded-xl border border-gray-300 px-3 py-2">
                  <option value="">Select account</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              {addForm.type === "transfer" && (
                <div>
                  <label className="block text-gray-700 mb-1">To Account</label>
                  <select value={addForm.to_account} onChange={(e) => setAddForm((f) => ({ ...f, to_account: e.target.value }))} className="w-full rounded-xl border border-gray-300 px-3 py-2">
                    <option value="">Select destination</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              )}
              {addForm.type !== "transfer" && (
                <div>
                  <label className="block text-gray-700 mb-1">Category</label>
                  <select
                    value={addForm.category}
                    onChange={(e) => setAddForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2"
                    disabled={!categories.length}
                  >
                    <option value="">
                      {categories.length ? "Select category" : "Ask your admin to create categories"}
                    </option>
                    {categories
                      .filter((cat) => cat.kind === (addForm.type === "income" ? "income" : "expense"))
                      .map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-400">Managed by your admin</p>
                </div>
              )}
              <div className="sm:col-span-2">
                <label className="block text-gray-700 mb-1">Description</label>
                <input value={addForm.description} onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))} className="w-full rounded-xl border border-gray-300 px-3 py-2" placeholder="Optional" />
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button onClick={() => setAddOpen(false)} className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={onCreate} disabled={creating} className={`rounded-xl px-3 py-2 text-sm text-white ${creating ? "bg-indigo-300" : "bg-indigo-600 hover:bg-indigo-700"}`}>{creating ? "Creating..." : "Create"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditing(null)} />
          <div className="relative w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-5 shadow-lg">
            <h3 className="text-base font-semibold">Edit Transaction</h3>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <label className="block text-gray-700 mb-1">Type</label>
                <select value={editForm.type} onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value }))} className="w-full rounded-xl border border-gray-300 px-3 py-2">
                  <option value="income">Addition (+)</option>
                  <option value="expense">Expense</option>
                  <option value="transfer">Transfer</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-700 mb-1">Amount</label>
                <input type="number" step="0.01" value={editForm.amount} onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))} className="w-full rounded-xl border border-gray-300 px-3 py-2" />
              </div>
              <div>
                <label className="block text-gray-700 mb-1">Currency</label>
                <input value={editForm.currency} 
                readOnly
                aria-readonly="true"
                onChange={(e) => setEditForm((f) => ({ ...f, currency: e.target.value.toUpperCase().slice(0,3) }))} className="w-full rounded-xl border border-gray-300 px-3 py-2" />

              </div>
              <div>
                <label className="block text-gray-700 mb-1">Date</label>
                <input type="datetime-local" value={editForm.date} onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))} className="w-full rounded-xl border border-gray-300 px-3 py-2" />
              </div>
              <div>
                <label className="block text-gray-700 mb-1">Account</label>
                <select value={editForm.account} onChange={(e) => setEditForm((f) => ({ ...f, account: e.target.value }))} className="w-full rounded-xl border border-gray-300 px-3 py-2">
                  <option value="">Select account</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              {editForm.type === "transfer" && (
                <div>
                  <label className="block text-gray-700 mb-1">To Account</label>
                  <select value={editForm.to_account} onChange={(e) => setEditForm((f) => ({ ...f, to_account: e.target.value }))} className="w-full rounded-xl border border-gray-300 px-3 py-2">
                    <option value="">Select destination</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              )}
              {editForm.type !== "transfer" && (
                <div>
                  <label className="block text-gray-700 mb-1">Category</label>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2"
                    disabled={!categories.length}
                  >
                    <option value="">
                      {categories.length ? "Select category" : "Ask your admin to create categories"}
                    </option>
                    {categories
                      .filter((cat) => cat.kind === (editForm.type === "income" ? "income" : "expense"))
                      .map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-400">Managed by your admin</p>
                </div>
              )}
              <div className="sm:col-span-2">
                <label className="block text-gray-700 mb-1">Description</label>
                <input value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} className="w-full rounded-xl border border-gray-300 px-3 py-2" placeholder="Optional" />
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button onClick={() => setEditing(null)} className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={onSaveEdit} disabled={saving} className={`rounded-xl px-3 py-2 text-sm text-white ${saving ? "bg-indigo-300" : "bg-indigo-600 hover:bg-indigo-700"}`}>{saving ? "Saving..." : "Save"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Excel import modal */}
      {excelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => {
              setExcelModalOpen(false);
              setExcelRows([]);
              setExcelErrors([]);
              setExcelNotice("");
            }}
          />
          <div className="relative w-full max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Import transactions from Excel</h3>
                <p className="text-sm text-gray-500">Use the template columns: type, amount, currency, date, account, category.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setExcelModalOpen(false);
                  setExcelRows([]);
                  setExcelErrors([]);
                  setExcelNotice("");
                }}
                className="rounded-full border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 text-sm">
              <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/60 p-4">
                <label className="flex flex-col items-center justify-center gap-2 text-center cursor-pointer">
                  <span className="text-sm font-medium text-gray-700">Upload .xlsx file</span>
                  <span className="text-xs text-gray-500">Max 2MB · first sheet only</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="sr-only"
                    onChange={(e) => handleExcelFile(e.target.files?.[0])}
                  />
                </label>
              </div>

              {excelNotice && (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-2 text-sm text-indigo-700">
                  {excelNotice}
                </div>
              )}

              {!!excelErrors.length && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <div className="font-medium">Issues detected:</div>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {excelErrors.map((err, idx) => (
                      <li key={`${err.row}-${idx}`}>Row {err.row}: {err.message}</li>
                    ))}
                  </ul>
                </div>
              )}

              {excelRows.length > 0 && (
                <div className="rounded-2xl border border-gray-200">
                  <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2 text-sm text-gray-600">
                    <span>Preview ({Math.min(excelRows.length, 5)} of {excelRows.length} rows)</span>
                    <span className="text-xs text-gray-400">Only first 5 rows shown</span>
                  </div>
                  <div className="max-h-60 overflow-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 text-gray-500">
                        <tr>
                          {Object.keys(excelRows[0]).map((key) => (
                            <th key={key} className="px-3 py-2 capitalize">{key}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {excelRows.slice(0, 5).map((row, idx) => (
                          <tr key={idx} className="border-t border-gray-100">
                            {Object.keys(excelRows[0]).map((key) => (
                              <td key={key} className="px-3 py-2 text-gray-700">{String(row[key] ?? "")}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setExcelModalOpen(false);
                  setExcelRows([]);
                  setExcelErrors([]);
                  setExcelNotice("");
                }}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={processExcelRows}
                disabled={excelProcessing}
                className={`rounded-xl px-4 py-2 text-sm font-semibold text-white ${excelProcessing ? "bg-indigo-300" : "bg-indigo-600 hover:bg-indigo-700"}`}
              >
                {excelProcessing ? "Importing..." : "Import rows"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt import modal */}
      {receiptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => {
              setReceiptModalOpen(false);
              setReceiptForms([]);
              setReceiptNotice("");
            }}
          />
          <div className="relative w-full max-w-4xl rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Import from receipts</h3>
                <p className="text-sm text-gray-500">Upload receipt scans, verify the extracted data, then import.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setReceiptModalOpen(false);
                  setReceiptForms([]);
                  setReceiptNotice("");
                }}
                className="rounded-full border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 text-sm">
              <div
                className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/70 p-5 text-center"
              >
                <label className="flex flex-col items-center justify-center gap-2 cursor-pointer">
                  <span className="text-sm font-medium text-gray-700">Drop receipt images here</span>
                  <span className="text-xs text-gray-500">PNG · JPG · up to 5MB</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    onChange={(e) => handleReceiptFiles(e.target.files)}
                  />
                </label>
              </div>

              {receiptNotice && (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-2 text-sm text-indigo-700">
                  {receiptNotice}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {receiptForms.map((form) => (
                  <div key={form.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between text-sm font-semibold text-gray-700">
                      <span>{form.name}</span>
                      <button
                        type="button"
                        onClick={() => setReceiptForms((prev) => prev.filter((f) => f.id !== form.id))}
                        className="text-xs text-red-500 hover:text-red-600"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="mt-3 space-y-3 text-sm">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-500">Type</label>
                        <select
                          value={form.type}
                          onChange={(e) => updateReceiptForm(form.id, "type", e.target.value)}
                          className="rounded-xl border border-gray-300 px-3 py-2"
                        >
                          <option value="expense">Expense</option>
                          <option value="income">Addition</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-500">Amount</label>
                        <input
                          type="number"
                          step="0.01"
                          value={form.amount}
                          onChange={(e) => updateReceiptForm(form.id, "amount", e.target.value)}
                          className="rounded-xl border border-gray-300 px-3 py-2"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-500">Date</label>
                        <input
                          type="datetime-local"
                          value={form.date}
                          onChange={(e) => updateReceiptForm(form.id, "date", e.target.value)}
                          className="rounded-xl border border-gray-300 px-3 py-2"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-500">Account</label>
                        <select
                          value={form.account}
                          onChange={(e) => updateReceiptForm(form.id, "account", e.target.value)}
                          className="rounded-xl border border-gray-300 px-3 py-2"
                        >
                          <option value="">Select account</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-500">Description</label>
                        <input
                          value={form.description}
                          onChange={(e) => updateReceiptForm(form.id, "description", e.target.value)}
                          className="rounded-xl border border-gray-300 px-3 py-2"
                          placeholder="Optional"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {!receiptForms.length && (
                <p className="text-center text-sm text-gray-500">Upload receipt images to review them here.</p>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setReceiptModalOpen(false);
                  setReceiptForms([]);
                  setReceiptNotice("");
                }}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={processReceiptForms}
                disabled={receiptProcessing}
                className={`rounded-xl px-4 py-2 text-sm font-semibold text-white ${receiptProcessing ? "bg-indigo-300" : "bg-indigo-600 hover:bg-indigo-700"}`}
              >
                {receiptProcessing ? "Importing..." : "Import receipts"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
