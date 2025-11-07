# core/schemas.py
from typing import Optional, List, Literal, Dict, Any
from decimal import Decimal
from datetime import date, datetime
from ninja import Schema
from pydantic import Field

# =========================
# Common / Utilities
# =========================

class PaginationInfo(Schema):
    current_page: int
    total_pages: int
    total_items: int

# Optional auth-style schemas
class LoginSchema(Schema):
    email: str
    password: str

class LoginSchemaOutput(Schema):
    username: str
    role: str


# =========================
# Enums (mirror models.*Choices)
# =========================
AccountTypeLiteral = Literal["cash", "bank", "credit_card", "wallet", "other"]
TransactionTypeLiteral = Literal["income", "expense", "transfer"]
TransactionStatusLiteral = Literal["pending", "cleared", "reconciled", "void"]
RecurringIntervalLiteral = Literal["daily", "weekly", "monthly", "yearly"]
CategoryKindLiteral = Literal["income", "expense"]


# =========================
# Org-aware base (READ)
# =========================
class OrgOwnedRead(Schema):
    org_id: int


# =========================
# Users
# =========================
class UserSchema(OrgOwnedRead):  # READ
    id: int
    email: str
    name: Optional[str] = None
    role: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class UserCreateSchema(Schema):  # CREATE (server will set org from request.user or during admin signup)
    email: str
    name: Optional[str] = None
    role: Optional[int] = 2   # default EMPLOYEE (Admin=1, Employee=2, Guest=3)
    password: str

class UserUpdateSchema(Schema):  # UPDATE (partial)
    email: Optional[str] = None
    name: Optional[str] = None
    role: Optional[int] = None
    password: Optional[str] = None

class PaginatedUserResponse(Schema):
    info: PaginationInfo
    results: List[UserSchema]


# =========================
# Login Logout
# =========================
class LoginIn(Schema):
    email: str
    password: str


class LoginOut(Schema):
    id: int
    email: str
    name: Optional[str] = None
    role: int
    org_id: int   # NEW

# =========================
# Accounts
# =========================
class AccountSchema(OrgOwnedRead):  # READ
    id: int
    name: str
    type: AccountTypeLiteral
    currency: Optional[str] = None  # char(3)
    balance: Optional[Decimal] = None
    is_default: Optional[bool] = False
    user_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class AccountCreateSchema(Schema):  # CREATE
    name: str
    type: AccountTypeLiteral
    currency: Optional[str] = None
    balance: Optional[Decimal] = None
    is_default: Optional[bool] = False
    # TIP: Let server default this to request.user if omitted
    user: Optional[int] = None

class AccountUpdateSchema(Schema):  # UPDATE
    name: Optional[str] = None
    type: Optional[AccountTypeLiteral] = None
    currency: Optional[str] = None
    balance: Optional[Decimal] = None
    is_default: Optional[bool] = None
    user: Optional[int] = None

class PaginatedAccountResponse(Schema):
    info: PaginationInfo
    results: List[AccountSchema]


# =========================
# Projects
# =========================
class ProjectSchema(OrgOwnedRead):  # READ
    id: int
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = True
    user_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class ProjectCreateSchema(Schema):  # CREATE
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = True
    user: Optional[int] = None

class ProjectUpdateSchema(Schema):  # UPDATE
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    user: Optional[int] = None

class PaginatedProjectResponse(Schema):
    info: PaginationInfo
    results: List[ProjectSchema]


# =========================
# Categories
# =========================
class CategorySchema(OrgOwnedRead):  # READ
    id: int
    name: str
    kind: CategoryKindLiteral
    user_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class CategoryCreateSchema(Schema):  # CREATE
    name: str
    kind: CategoryKindLiteral
    user: Optional[int] = None

class CategoryUpdateSchema(Schema):  # UPDATE
    name: Optional[str] = None
    kind: Optional[CategoryKindLiteral] = None
    user: Optional[int] = None

class PaginatedCategoryResponse(Schema):
    info: PaginationInfo
    results: List[CategorySchema]


# =========================
# Budgets
# =========================
class BudgetSchema(OrgOwnedRead):
    id: int
    name: Optional[str]
    description: Optional[str]
    amount: Decimal
    warn_at_percent: Optional[Decimal]   # Decimal in model
    max_per_txn: Optional[Decimal]
    category_id: Optional[int]
    account_id: Optional[int]
    project_id: Optional[int]
    user_id: int
    period_start: Optional[date]         # model allows NULL
    period_end: Optional[date]           # model allows NULL
    last_alert_sent: Optional[datetime]
    is_active: bool
    created_at: datetime
    updated_at: datetime

class BudgetCreateSchema(Schema):
    name: Optional[str] = None
    description: Optional[str] = None
    amount: Decimal
    warn_at_percent: Optional[Decimal] = None
    max_per_txn: Optional[Decimal] = None
    user: Optional[int] = None
    project: Optional[int] = None
    account: Optional[int] = None
    category: Optional[int] = None
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    is_active: Optional[bool] = True

class BudgetUpdateSchema(Schema):
    name: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[Decimal] = None
    warn_at_percent: Optional[Decimal] = None
    max_per_txn: Optional[Decimal] = None
    user: Optional[int] = None
    project: Optional[Optional[int]] = None
    account: Optional[Optional[int]] = None
    category: Optional[Optional[int]] = None
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    is_active: Optional[bool] = None

class PaginatedBudgetResponse(Schema):
    info: PaginationInfo
    results: List[BudgetSchema]


# =========================
# Transactions
# =========================
class TransactionSchema(OrgOwnedRead):
    id: int
    type: TransactionTypeLiteral
    amount: Decimal
    currency: Optional[str] = None
    description: Optional[str]
    date: datetime
    status: Optional[TransactionStatusLiteral] = None
    receipt_url: Optional[str]
    category_id: Optional[int]
    project_id: Optional[int]
    is_recurring: bool
    recurring_interval: Optional[RecurringIntervalLiteral]
    next_recurring_date: Optional[datetime]  # model is DateTimeField
    last_processed: Optional[datetime]
    reimbursed_at: Optional[datetime]
    user_id: int
    account_id: int
    to_account_id: Optional[int]
    created_at: datetime
    updated_at: datetime

class TransactionCreateSchema(Schema):
    type: TransactionTypeLiteral
    amount: Decimal
    currency: Optional[str] = None
    description: Optional[str] = None
    date: datetime
    status: Optional[TransactionStatusLiteral] = None
    receipt_url: Optional[str] = None
    category: Optional[int] = None
    project: Optional[int] = None
    is_recurring: Optional[bool] = False
    recurring_interval: Optional[RecurringIntervalLiteral] = None
    next_recurring_date: Optional[datetime] = None
    last_processed: Optional[datetime] = None
    reimbursed_at: Optional[datetime] = None
    # TIP: Let server default these to request.user / request.user.org context
    user: Optional[int] = None
    account: int
    to_account: Optional[int] = None

class TransactionUpdateSchema(Schema):
    type: Optional[TransactionTypeLiteral] = None
    amount: Optional[Decimal] = None
    currency: Optional[str] = None
    description: Optional[str] = None
    date: Optional[datetime] = None
    status: Optional[TransactionStatusLiteral] = None
    receipt_url: Optional[str] = None
    category: Optional[Optional[int]] = None
    project: Optional[Optional[int]] = None
    to_account: Optional[Optional[int]] = None
    is_recurring: Optional[bool] = None
    recurring_interval: Optional[RecurringIntervalLiteral] = None
    next_recurring_date: Optional[datetime] = None
    last_processed: Optional[datetime] = None
    reimbursed_at: Optional[datetime] = None
    user: Optional[int] = None
    account: Optional[int] = None

class PaginatedTransactionResponse(Schema):
    info: PaginationInfo
    results: List[TransactionSchema]


# =========================
# Admin Overview / Reports
# =========================
class KPI(Schema):
    label: str
    value: str       # pre-formatted (e.g., "$6,120")
    delta: str       # "+8.1%" or "-2.3%"
    up: bool

class SlimTx(Schema):
    id: int
    date: str
    description: Optional[str]
    account: str
    amount: float

class SlimAccount(Schema):
    id: int
    name: str
    type: str
    balance: float

class DashboardOverview(Schema):
    kpis: List[KPI]
    recent: List[SlimTx]
    top_accounts: List[SlimAccount]

class SeriesPoint(Schema):
    period: str          # "2025-10" or "2025-10-28"
    income: float
    expense: float
    net: float

class TimeSeriesReport(Schema):
    granularity: str     # "month" or "day"
    points: List[SeriesPoint]

class CategorySlice(Schema):
    id: int
    name: str
    total: float

class CategoryReport(Schema):
    kind: str            # "expense" or "income"
    slices: List[CategorySlice]
    other_total: float

class BudgetActual(Schema):
    budget_id: int
    name: str
    budgeted: float
    actual: float
    percent_used: float  # 0-100

class BudgetVsActualReport(Schema):
    rows: List[BudgetActual]

# (ARIMA/Prophet-ready)
class ForecastHistoryPoint(Schema):
    period: str
    value: float

class ForecastPoint(Schema):
    period: str
    yhat: float
    yhat_lower: float
    yhat_upper: float

class ForecastRequest(Schema):
    target: Literal["net", "expense", "income"]
    model: Literal["arima", "prophet"]
    horizon: int = Field(..., ge=1, le=36)
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    currency: Optional[str] = "USD"

class ForecastResponse(Schema):
    history: List[ForecastHistoryPoint]
    forecast: List[ForecastPoint]
    model_info: Dict[str, Any]

# =========================
# Error Messages
# =========================
class MessageResponse(Schema):
    message: str
    code: Optional[str] = None

class ErrorMessages(Schema):
    message: str
    code: Optional[str] = None
