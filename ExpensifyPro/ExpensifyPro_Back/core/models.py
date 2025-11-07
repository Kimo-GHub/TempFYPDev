from django.db import models
import uuid
from django.contrib.auth.hashers import make_password, check_password
# -----------------------------
# Mixins
# -----------------------------

class TimestampedModel(models.Model):
    """Maps createdAt / updatedAt."""
    created_at = models.DateTimeField(db_column="createdAt", auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(db_column="updatedAt", auto_now=True, null=True, blank=True)

    class Meta:
        abstract = True


# -----------------------------
# Enums (choices)
# -----------------------------

class UserRole(models.IntegerChoices):
    ADMIN = 1, "Admin"
    EMPLOYEE = 2, "Employee"
    GUEST = 3, "Guest"

class AccountType(models.TextChoices):
    CASH = "cash", "Cash"
    BANK = "bank", "Bank"
    CREDIT_CARD = "credit_card", "Credit Card"
    WALLET = "wallet", "Wallet"
    OTHER = "other", "Other"


class TransactionType(models.TextChoices):
    INCOME = "income", "Income"
    EXPENSE = "expense", "Expense"
    TRANSFER = "transfer", "Transfer"


class TransactionStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    CLEARED = "cleared", "Cleared"
    RECONCILED = "reconciled", "Reconciled"
    VOID = "void", "Void"


class RecurringInterval(models.TextChoices):
    DAILY = "daily", "Daily"
    WEEKLY = "weekly", "Weekly"
    MONTHLY = "monthly", "Monthly"
    YEARLY = "yearly", "Yearly"


class CategoryKind(models.TextChoices):
    INCOME = "income", "Income"
    EXPENSE = "expense", "Expense"


# -----------------------------
# Organization & Org-owned base
# -----------------------------
class Organization(TimestampedModel):
    name = models.CharField(max_length=255, unique=True)
    # Optional: who “owns”/created this org (useful for admin UX & guard rails)
    owner = models.ForeignKey(
        "User", on_delete=models.PROTECT, null=True, blank=True, related_name="owned_orgs"
        
    )

    class Meta:
        db_table = "organizations"

    def __str__(self):
        return self.name


class OrgOwnedModel(TimestampedModel):
    """
    Every business row belongs to exactly one Organization.
    """
    org = models.ForeignKey("Organization", on_delete=models.CASCADE, related_name="%(class)ss", null=True, blank=True)


    class Meta:
        abstract = True

        
# -----------------------------
# Tables
# -----------------------------

class User(OrgOwnedModel):
    """
    CREATE TABLE users (...)
    """
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=255, null=True, blank=True)
    role = models.IntegerField(choices=UserRole.choices, default=UserRole.EMPLOYEE)
    password = models.CharField(max_length=128, blank=True, null=True)
    

    def set_password(self, raw_password: str):
        """Hash & store the password."""
        self.password = make_password(raw_password)

    def check_password(self, raw_password: str) -> bool:
        """Return True if raw_password matches hash."""
        if not self.password:
            return False
        return check_password(raw_password, self.password)


    class Meta:
        db_table = "users"

    def __str__(self):
        return self.email


class Account(OrgOwnedModel):
    """
    CREATE TABLE accounts (...)
    """
    name = models.CharField(max_length=255)
    type = models.CharField(max_length=32, choices=AccountType.choices)
    currency = models.CharField(max_length=3, null=True, blank=True)
    balance = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)  # optional cache
    is_default = models.BooleanField(db_column="isDefault", default=False)

    user = models.ForeignKey("User", on_delete=models.CASCADE, related_name="accounts", db_column="userId")

    class Meta:
        db_table = "accounts"
        indexes = [
            models.Index(fields=["user", "is_default"], name="accounts_user_isdefault_idx"),
        ]

    def __str__(self):
        return f"{self.name} ({self.currency or '-'})"


class Project(OrgOwnedModel):
    """
    CREATE TABLE projects (...)
    """
    name = models.CharField(max_length=255)
    code = models.TextField(null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(db_column="isActive", default=True)

    user = models.ForeignKey("User", on_delete=models.CASCADE, related_name="projects", db_column="userId")

    class Meta:
        db_table = "projects"
        constraints = [
            models.UniqueConstraint(fields=["user", "name"], name="projects_user_name_unique"),
        ]

    def __str__(self):
        return self.name


class Category(OrgOwnedModel):
    """
    CREATE TABLE categories (...)
    """
    name = models.CharField(max_length=255)
    kind = models.CharField(max_length=16, choices=CategoryKind.choices)

    user = models.ForeignKey("User", on_delete=models.CASCADE, related_name="categories", db_column="userId")

    class Meta:
        db_table = "categories"
        constraints = [
            models.UniqueConstraint(fields=["user", "kind", "name"], name="categories_user_kind_name_unique"),
        ]

    def __str__(self):
        return f"{self.name} ({self.kind})"


class Budget(OrgOwnedModel):
    """
    CREATE TABLE budgets (...)
    """

    name = models.CharField(max_length=255, null=True, blank=True)
    description = models.TextField(null=True, blank=True)

    amount = models.DecimalField(max_digits=18, decimal_places=2)
    warn_at_percent = models.DecimalField(db_column="warnAtPercent", max_digits=5, decimal_places=2,
                                          null=True, blank=True)  # e.g., 0.80
    max_per_txn = models.DecimalField(db_column="maxPerTxn", max_digits=18, decimal_places=2,
                                      null=True, blank=True)

    # Optional scope FKs
    category = models.ForeignKey("Category", on_delete=models.SET_NULL, null=True, blank=True,
                                 related_name="budgets", db_column="categoryId")
    account = models.ForeignKey("Account", on_delete=models.SET_NULL, null=True, blank=True,
                                related_name="budgets", db_column="accountId")
    project = models.ForeignKey("Project", on_delete=models.SET_NULL, null=True, blank=True,
                                related_name="budgets", db_column="projectId")

    user = models.ForeignKey("User", on_delete=models.CASCADE, related_name="budgets", db_column="userId")

    period_start = models.DateField(db_column="periodStart", null=True, blank=True)
    period_end = models.DateField(db_column="periodEnd", null=True, blank=True)
    last_alert_sent = models.DateTimeField(db_column="lastAlertSent", null=True, blank=True)
    is_active = models.BooleanField(db_column="isActive", default=True)

    class Meta:
        db_table = "budgets"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "project", "account", "category", "period_start", "period_end"],
                name="budgets_scope_period_unique",
            ),
        ]

    def __str__(self):
        return self.name or f"Budget {self.id}"


class Transaction(OrgOwnedModel):
    """
    CREATE TABLE transactions (...)
    """
    type = models.CharField(max_length=16, choices=TransactionType.choices)
    amount = models.DecimalField(max_digits=18, decimal_places=2)
    currency = models.CharField(max_length=3, null=True, blank=True)  # defaults to account currency if null
    description = models.TextField(null=True, blank=True)
    date = models.DateTimeField()
    status = models.CharField(max_length=16, choices=TransactionStatus.choices, null=True, blank=True)
    receipt_url = models.TextField(db_column="receiptUrl", null=True, blank=True)

    # Categorization
    category = models.ForeignKey("Category", on_delete=models.SET_NULL, null=True, blank=True,
                                 related_name="transactions", db_column="categoryId")
    project = models.ForeignKey("Project", on_delete=models.SET_NULL, null=True, blank=True,
                                related_name="transactions", db_column="projectId")

    # Recurrence
    is_recurring = models.BooleanField(db_column="isRecurring", default=False)
    recurring_interval = models.CharField(db_column="recurringInterval",
                                          max_length=16, choices=RecurringInterval.choices,
                                          null=True, blank=True)
    next_recurring_date = models.DateTimeField(db_column="nextRecurringDate", null=True, blank=True)
    last_processed = models.DateTimeField(db_column="lastProcessed", null=True, blank=True)

    # Reimbursement
    reimbursed_at = models.DateTimeField(db_column="reimbursedAt", null=True, blank=True)

    # Accounting
    user = models.ForeignKey("User", on_delete=models.CASCADE, related_name="transactions", db_column="userId")
    account = models.ForeignKey("Account", on_delete=models.CASCADE, related_name="transactions", db_column="accountId")
    to_account = models.ForeignKey("Account", on_delete=models.SET_NULL, null=True, blank=True,
                                   related_name="incoming_transfers", db_column="toAccountId")

    class Meta:
        db_table = "transactions"
        indexes = [
            models.Index(fields=["user", "date"], name="transactions_user_date_idx"),
            models.Index(fields=["account", "date"], name="transactions_account_date_idx"),
            models.Index(fields=["project", "date"], name="transactions_project_date_idx"),
        ]

    def __str__(self):
        return f"{self.type}: {self.amount} {self.currency or ''} @ {self.date:%Y-%m-%d}"
