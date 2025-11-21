// src/utils/expensiActions.js
import { apiService } from "../api";

const currentUserId = (() => {
  try {
    return JSON.parse(localStorage.getItem("exp_user") || "{}").id || null;
  } catch {
    return null;
  }
})();

const fmtMoney = (value, currency = "USD") =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

// --- Helper: adjust account balances after a transaction ---
async function adjustAccountsForTx(tx, mult = 1) {
  if (!tx) return;
  const type = tx.type;
  const amount = Number(tx.amount || 0);
  if (!amount) return;

  const bump = async (accountId, delta) => {
    if (!accountId) return;
    try {
      const acc = await apiService.getAccountById(accountId);
      const before = Number(acc?.balance || 0);
      const after = before + delta;
      await apiService.updateAccount(accountId, { balance: after });
    } catch (e) {
      console.warn("Failed to bump account balance", accountId, e);
    }
  };

  if (type === "income") {
    await bump(tx.account, amount * mult);
  } else if (type === "expense") {
    await bump(tx.account, -amount * mult);
  } else if (type === "transfer") {
    const fromId = tx.account;
    const toId = tx.to_account;
    await bump(fromId, -amount * mult);
    await bump(toId, amount * mult);
  }
}

// --- Budget types localStorage helper (keep in sync with Budgets.jsx) ---
const BUDGET_TYPES_KEY = "exp_budget_types";

function persistBudgetType(budgetId, type) {
  if (!budgetId) return;
  const clean = type === "income" ? "income" : "expense";
  try {
    const raw = window.localStorage.getItem(BUDGET_TYPES_KEY);
    const data = raw ? JSON.parse(raw) : {};
    data[budgetId] = clean;
    window.localStorage.setItem(BUDGET_TYPES_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn("Failed to persist budget type", err);
  }
}

// --- Main action router used by Expensi ---
export async function runExpensiAction(action, params) {
  try {
    switch (action) {
      // ===== categories =====
      case "create_category": {
        await apiService.createCategory({
          name: params.name,
          kind: params.kind,
          user: params.user,
        });
        return `✅ Category '${params.name}' created successfully.`;
      }

      // ===== projects =====
      case "create_project": {
        const userId = params.user ?? params.user_id ?? currentUserId;
        if (!userId) {
          return "❌ To create a project I need a valid user id.";
        }

        await apiService.createProject({
          name: params.name,
          description: params.description || "",
          user: userId,
        });
        return `✅ Project '${params.name}' was created for user ${userId}.`;
      }

      // ===== accounts =====
      case "create_account": {
        const userId = params.user ?? params.user_id ?? currentUserId;
        const payload = {
          name: params.name?.trim(),
          type: params.type,
          currency: (params.currency || "USD").toUpperCase().slice(0, 3),
          balance:
            params.balance === "" || params.balance == null
              ? null
              : Number(params.balance),
          is_default: !!params.is_default,
          user: userId,
        };

        if (!payload.name || !payload.user) {
          return "❌ To create an account I need at least a name and user id.";
        }

        await apiService.createAccount(payload);
        return `✅ Account '${payload.name}' created for user ${payload.user}.`;
      }

      case "update_account": {
        const id = params.account_id ?? params.id;
        if (!id) {
          return "❌ I need an account_id to update an account.";
        }

        const payload = {};
        if (params.name != null) payload.name = params.name.trim();
        if (params.type != null) payload.type = params.type;
        if (params.currency != null)
          payload.currency = params.currency.toUpperCase().slice(0, 3);
        if (params.balance != null) payload.balance = Number(params.balance);
        if (params.is_default != null) payload.is_default = !!params.is_default;

        await apiService.updateAccount(id, payload);
        return `✅ Account #${id} updated.`;
      }

      // ===== transactions =====
      case "create_transaction": {
        const userId = params.user ?? params.user_id ?? currentUserId;
        const accountId = params.account ?? params.account_id ?? null;

        if (!userId) {
          return "❌ I need a valid user id to create a transaction.";
        }
        if (!accountId) {
          return "❌ I need an account id to attach this transaction to.";
        }
        if (!params.type) {
          return "❌ Please tell me whether this is income, expense, or transfer.";
        }
        if (params.amount == null || Number(params.amount) === 0) {
          return "❌ Please provide a non-zero amount for the transaction.";
        }

        const payload = {
          type: params.type,
          amount: Number(params.amount),
          currency: (params.currency || "USD").toUpperCase().slice(0, 3),
          description: params.description,
          date: params.date || new Date().toISOString(),
          user: userId,
          account: Number(accountId),
          to_account:
            params.to_account != null
              ? Number(params.to_account)
              : undefined,
          category:
            params.category != null ? Number(params.category) : undefined,
          project: params.project != null ? Number(params.project) : undefined,
          is_recurring: !!params.is_recurring,
          recurring_interval: params.recurring_interval || undefined,
          next_recurring_date:
            params.next_run || params.next_recurring_date || undefined,
        };

        const created = await apiService.createTransaction(payload);

        // update account balances for non-recurring 'real' movement
        await adjustAccountsForTx(created, +1);

        return `✅ Transaction created (${fmtMoney(
          created.amount,
          created.currency || "USD"
        )}) on account #${created.account}.`;
      }

      case "update_transaction": {
        const id = params.transaction_id ?? params.id;
        if (!id) return "❌ I need the transaction id to update it.";

        // For balance adjustment, we should fetch the old transaction first
        const existing = await apiService.getTransactionById(id);

        const payload = {};

        if (params.type != null) payload.type = params.type;
        if (params.amount != null) payload.amount = Number(params.amount);
        if (params.currency != null)
          payload.currency = params.currency.toUpperCase().slice(0, 3);
        if (params.description != null)
          payload.description = params.description;
        if (params.date != null) payload.date = params.date;
        if (params.account != null)
          payload.account = params.account ? Number(params.account) : null;
        if (params.to_account != null)
          payload.to_account = params.to_account
            ? Number(params.to_account)
            : null;
        if (params.category != null)
          payload.category = params.category ? Number(params.category) : null;
        if (params.project != null)
          payload.project = params.project ? Number(params.project) : null;

        const updated = await apiService.updateTransaction(id, payload);

        // Reconcile balances: remove old effect, then apply new one
        await adjustAccountsForTx(existing, -1);
        await adjustAccountsForTx(updated, +1);

        return `✅ Transaction #${id} updated.`;
      }

      case "archive_transaction": {
        const id = params.transaction_id ?? params.id;
        if (!id) return "❌ I need the transaction id to archive it.";
        await apiService.updateTransaction(id, { is_archived: true });
        return `✅ Transaction #${id} archived.`;
      }

      case "unarchive_transaction": {
        const id = params.transaction_id ?? params.id;
        if (!id) return "❌ I need the transaction id to unarchive it.";
        await apiService.updateTransaction(id, { is_archived: false });
        return `✅ Transaction #${id} unarchived.`;
      }

      // ===== budgets =====
      case "create_budget": {
        const userId = params.user ?? params.user_id ?? currentUserId;
        if (!userId || !params.name || !params.amount) {
          return "❌ To create a budget I need user id, name, and a positive amount.";
        }

        const payload = {
          user: userId,
          name: params.name.trim(),
          amount: Number(params.amount),
          account: params.account ? Number(params.account) : undefined,
          project: params.project ? Number(params.project) : undefined,
          description: params.description?.trim() || undefined,
          period_start: params.period_start || undefined,
          period_end: params.period_end || undefined,
          warn_at_percent:
            params.warn_at_percent != null
              ? Number(params.warn_at_percent)
              : undefined,
          is_active: params.is_active != null ? !!params.is_active : true,
          category: params.category ? Number(params.category) : undefined,
        };

        const created = await apiService.createBudget(payload);

        if (created?.id && params.type) {
          persistBudgetType(created.id, params.type);
        }

        return `✅ Budget '${payload.name}' created for user ${payload.user} with amount ${payload.amount}.`;
      }

      case "update_budget": {
        const id = params.budget_id ?? params.id;
        if (!id) {
          return "❌ I need a budget_id to update a budget.";
        }

        const payload = {};

        if (params.name != null) payload.name = params.name.trim();
        if (params.amount != null) payload.amount = Number(params.amount);
        if (params.account != null)
          payload.account = params.account ? Number(params.account) : null;
        if (params.project != null)
          payload.project = params.project ? Number(params.project) : null;
        if (params.description != null)
          payload.description = params.description.trim() || null;
        if (params.period_start != null)
          payload.period_start = params.period_start || null;
        if (params.period_end != null)
          payload.period_end = params.period_end || null;
        if (params.warn_at_percent != null)
          payload.warn_at_percent = Number(params.warn_at_percent);
        if (params.is_active != null)
          payload.is_active = !!params.is_active;
        if (params.category != null)
          payload.category = params.category ? Number(params.category) : null;

        await apiService.updateBudget(id, payload);

        if (params.type) {
          persistBudgetType(id, params.type);
        }

        return `✅ Budget #${id} updated.`;
      }

      // ===== automations (recurring transactions) =====
      case "create_automation": {
        const userId = params.user ?? params.user_id ?? currentUserId;
        const accountId = params.account ?? params.account_id ?? null;

        if (!userId) return "❌ I need a user id for this automation.";
        if (!accountId) return "❌ I need an account id for this automation.";

        const payload = {
          type: params.type || "expense",
          amount: Number(params.amount),
          currency: (params.currency || "USD").toUpperCase().slice(0, 3),
          description: params.description,
          date: params.next_run || params.date || new Date().toISOString(),
          account: Number(accountId),
          category:
            params.category != null ? Number(params.category) : undefined,
          is_recurring: true,
          recurring_interval: params.interval || params.recurring_interval || "monthly",
          next_recurring_date:
            params.next_run || params.next_recurring_date || new Date().toISOString(),
          user: userId,
        };

        const created = await apiService.createTransaction(payload);
        return `✅ Automation created: ${payload.type} ${fmtMoney(
          payload.amount,
          payload.currency
        )} every ${payload.recurring_interval} on account #${payload.account}.`;
      }

      case "update_automation": {
        const id = params.automation_id ?? params.transaction_id ?? params.id;
        if (!id) return "❌ I need the automation / transaction id to update it.";

        const payload = {};

        if (params.type != null) payload.type = params.type;
        if (params.amount != null) payload.amount = Number(params.amount);
        if (params.currency != null)
          payload.currency = params.currency.toUpperCase().slice(0, 3);
        if (params.description != null)
          payload.description = params.description;
        if (params.account != null)
          payload.account = params.account ? Number(params.account) : null;
        if (params.category != null)
          payload.category = params.category ? Number(params.category) : null;
        if (params.interval != null || params.recurring_interval != null)
          payload.recurring_interval =
            params.interval || params.recurring_interval;
        if (params.next_run != null || params.next_recurring_date != null) {
          payload.next_recurring_date =
            params.next_run || params.next_recurring_date;
          payload.date = payload.next_recurring_date;
        }

        payload.is_recurring = true;

        await apiService.updateTransaction(id, payload);
        return `✅ Automation #${id} updated.`;
      }

      case "delete_automation": {
        const id = params.automation_id ?? params.transaction_id ?? params.id;
        if (!id) return "❌ I need the automation / transaction id to delete it.";
        await apiService.deleteTransaction(id);
        return `✅ Automation #${id} deleted.`;
      }

      // ===== listing helpers =====
      case "list_accounts": {
        const pageSize =
          params.limit && Number(params.limit) > 0 ? Number(params.limit) : 50;

        const res = await apiService.getAccounts({
          user_id: params.user ?? params.user_id ?? currentUserId,
          page: 1,
          page_size: pageSize,
        });

        const accounts = res?.results ?? [];
        if (!accounts.length) {
          return "I couldn't find any accounts for this user.";
        }

        const lines = accounts.map((a) => {
          const label = a.name || "Untitled account";
          const cur = a.currency || "USD";
          const balance = fmtMoney(a.balance, cur);
          const def = a.is_default ? " (default)" : "";
          return `• ${label}${def} — ${balance}`;
        });

        return `Here are the accounts I found:\n${lines.join("\n")}`;
      }

      case "list_budgets": {
        const pageSize =
          params.limit && Number(params.limit) > 0 ? Number(params.limit) : 20;

        let isActive;
        if (params.status === "active") isActive = true;
        else if (params.status === "archived") isActive = false;
        else isActive = undefined; // "all"

        const res = await apiService.getBudgets({
          user_id: params.user ?? params.user_id ?? currentUserId,
          is_active: isActive,
          page: 1,
          page_size: pageSize,
        });

        const budgets = res?.results ?? [];
        if (!budgets.length) {
          return "No budgets found for this user with the requested filter.";
        }

        const lines = budgets.map((b) => {
          const name = b.name || "Untitled budget";
          const amount = fmtMoney(b.amount, b.currency || "USD");
          const status = b.is_active ? "Active" : "Archived";
          const scopeParts = [];

          if (b.account_name) scopeParts.push(`Account: ${b.account_name}`);
          else if (b.account_id) scopeParts.push(`Account #${b.account_id}`);

          if (b.project_name) scopeParts.push(`Project: ${b.project_name}`);
          else if (b.project_id) scopeParts.push(`Project #${b.project_id}`);

          if (b.category_name) scopeParts.push(`Category: ${b.category_name}`);
          else if (b.category_id) scopeParts.push(`Category #${b.category_id}`);

          const scope = scopeParts.length ? ` (${scopeParts.join(", ")})` : "";
          return `• ${name} — ${amount} [${status}]${scope}`;
        });

        return `Here are the budgets I found:\n${lines.join("\n")}`;
      }

      case "list_transactions": {
        const pageSize =
          params.limit && Number(params.limit) > 0 ? Number(params.limit) : 5;

        const res = await apiService.getTransactions({
          user_id: params.user ?? params.user_id ?? currentUserId,
          type: params.type || undefined,
          page: 1,
          page_size: pageSize,
        });

        const txs = res?.results ?? [];
        if (!txs.length) {
          return "No transactions found for this user with the requested filter.";
        }

        const lines = txs.map((t) => {
          const typeLabel =
            t.type === "income"
              ? "Income"
              : t.type === "expense"
              ? "Expense"
              : t.type === "transfer"
              ? "Transfer"
              : t.type || "Transaction";

          const cur = t.currency || "USD";
          const amount = fmtMoney(t.amount, cur);
          const desc = t.description || "(no description)";
          const date = t.date
            ? new Date(t.date).toLocaleString()
            : "no date";

          const account =
            t.account_name ||
            (t.account_id ? `Account #${t.account_id}` : "Unassigned account");

          return `• [${date}] ${typeLabel} — ${amount} — ${account} — ${desc}`;
        });

        return `Here are the latest transactions I found:\n${lines.join("\n")}`;
      }

      // ===== default =====
      default:
        return "⚠️ Action recognized but not implemented yet.";
    }
  } catch (error) {
    console.error("Action error:", error);
    return "❌ Failed to run action. Please provide more details.";
  }
}
