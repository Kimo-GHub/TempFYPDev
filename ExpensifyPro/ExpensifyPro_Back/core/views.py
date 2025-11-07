import uuid
from typing import Optional
from django.db import IntegrityError
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
from django.db.models import Q
from decimal import Decimal
from django.contrib.auth.hashers import make_password
from ninja.errors import HttpError
from ninja import NinjaAPI, Query
from django.db.models import Sum, Count, Value, DecimalField
from django.utils import timezone
from datetime import datetime, date, timedelta
from django.db.models.functions import Coalesce, TruncDay, TruncMonth
from ninja import Router
from django.utils.timezone import now
import pandas as pd
import pandas as p  # (you had both; keeping as-is)
from ninja.security import APIKeyHeader

from .models import (
    User, Account, Project, Category, Budget, Transaction, Organization, UserRole
)

from .schemas import (
    # reports/basic
    TimeSeriesReport, SeriesPoint,
    BudgetVsActualReport, BudgetActual,
    CategoryReport, CategorySlice,
    # users/accounts/projects/categories/budgets/transactions schemas...
    PaginationInfo, MessageResponse, ErrorMessages,
    PaginatedUserResponse, UserSchema, UserCreateSchema, UserUpdateSchema, LoginIn, LoginOut,
    PaginatedAccountResponse, AccountSchema, AccountCreateSchema, AccountUpdateSchema,
    PaginatedProjectResponse, ProjectSchema, ProjectCreateSchema, ProjectUpdateSchema,
    PaginatedCategoryResponse, CategorySchema, CategoryCreateSchema, CategoryUpdateSchema,
    PaginatedBudgetResponse, BudgetSchema, BudgetCreateSchema, BudgetUpdateSchema,
    PaginatedTransactionResponse, TransactionSchema, TransactionCreateSchema, TransactionUpdateSchema,
    DashboardOverview, KPI, SlimTx, SlimAccount,

    # ---- Forecast schemas ----
    ForecastRequest, ForecastResponse, ForecastPoint, ForecastHistoryPoint,
)

api = NinjaAPI(title="ExpensifyPro API", version="1.0.0")




# --- Add this: optional security that just forwards X-Org-Id to request ---
class OptionalOrgHeader(APIKeyHeader):
    """
    Exposes an API-key style header 'X-Org-Id' to Swagger's Authorize dialog.
    It does NOT enforce auth by itself (always returns True), but if provided
    it copies the value into request.META so your _org_id() can read it.
    """
    param_name = "X-Org-Id"

    def authenticate(self, request, key):
        if key:                       # make the header visible to _org_id()
            request.META["HTTP_X_ORG_ID"] = key
        return True                   # never block here; real check is in _org_id()

org_auth = OptionalOrgHeader()
api = NinjaAPI(title="ExpensifyPro API", version="1.0.0", auth=org_auth)

# =========================
# Org helpers
# =========================

def _org_id(request) -> int:
    """
    Returns the current organization id.
    Prod: from authenticated request.user.org_id.
    Dev fallback: from ?org_id=... query or X-Org-Id header.
    """
    u = getattr(request, "user", None)
    if u and getattr(u, "org_id", None):
        return u.org_id

    # ---- DEV-ONLY fallback so you can test without auth ----
    q = getattr(request, "GET", None)
    oid = None
    if q:
        oid = q.get("org_id")
    if not oid:
        oid = request.headers.get("X-Org-Id")

    if oid:
        try:
            return int(oid)
        except ValueError:
            raise HttpError(401, "Invalid org_id format.")

    raise HttpError(401, "Authentication with organization required.")


def _fk_in_org_or_404(model, pk: Optional[int], org_id: int, label: str):
    if pk is None:
        return None
    try:
        obj = model.objects.get(id=pk)
    except model.DoesNotExist:
        raise HttpError(404, f"{label} not found")
    if getattr(obj, "org_id", None) != org_id:
        raise HttpError(403, f"{label} does not belong to your organization")
    return obj


# small helpers for response specs
RESP_401 = {401: MessageResponse}
RESP_STD = {400: ErrorMessages, 401: MessageResponse, 500: MessageResponse}
RESP_MSG = {401: MessageResponse, 404: MessageResponse, 500: MessageResponse}


# in your api module
from ninja.errors import HttpError
from core.models import Organization, User

@api.post("/auth/register_admin/", response={201: LoginOut, 409: MessageResponse, 500: MessageResponse}, tags=["Auth"])
def register_admin(request, payload: LoginIn):
    if User.objects.filter(email__iexact=payload.email).exists():
        return 409, {"message": "Email already exists"}

    org_name = payload.email.split("@")[0].capitalize() + " Org"
    org = Organization.objects.create(name=org_name)

    u = User.objects.create(email=payload.email, role=1, org=org)  # 1 = Admin
    u.set_password(payload.password); u.save()

    org.owner = u; org.save(update_fields=["owner"])

    # ---------- important: include org_id ----------
    return 201, LoginOut(id=u.id, email=u.email, name=u.name, role=u.role, org_id=u.org_id)

@api.post(
    "/auth/login/",
    response={200: LoginOut, 400: MessageResponse, 401: MessageResponse, 404: MessageResponse, 500: MessageResponse},
    tags=["Auth"],
)
def login(request, payload: LoginIn):
    try:
        email = payload.email.strip()
        try:
            u = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return 404, {"message": "User not found"}

        if not payload.password or not u.check_password(payload.password):
            return 401, {"message": "Invalid credentials"}

        return 200, LoginOut(
            id=u.id,
            email=u.email,
            name=u.name,
            role=u.role,
            org_id=u.org_id,   # ← important
        )
    except Exception as e:
        return 500, {"message": str(e)}



# =========================
# Users (int IDs)
# =========================

@api.get(
   "/users/", response={200: PaginatedUserResponse, **RESP_STD}, tags=["Users"],
)
def list_users(
    request,
    page: int = Query(1, description="Page number"),
    page_size: int = Query(10, description="Items per page"),
    q: Optional[str] = Query(None, description="Search in email/name"),
    email: Optional[str] = Query(None, description="Filter by exact email"),
    name: Optional[str] = Query(None, description="Filter name contains"),
    role: Optional[int] = Query(None, description="Filter by role (int)"),
    org_id: Optional[int] = Query(None, description="Filter by organization id"),  # ← add
):
    try:
        org = _org_id(request)
        qs = User.objects.filter(org_id=org).order_by("-created_at")

        if q:
            qs = qs.filter(Q(email__icontains=q) | Q(name__icontains=q))
        if email:
            qs = qs.filter(email__iexact=email)
        if name:
            qs = qs.filter(name__icontains=name)
        if role is not None:
            qs = qs.filter(role=role)

        paginator = Paginator(qs, page_size)
        try:
            page_obj = paginator.page(page)
        except PageNotAnInteger:
            return 400, {"message": "Invalid page number", "code": "paginationError"}
        except EmptyPage:
            return 400, {"message": "Page number out of range", "code": "paginationError"}

        results = [
            UserSchema(
                id=u.id,
                email=u.email,
                name=u.name,
                role=u.role,
                org_id=u.org_id,
                created_at=u.created_at,
                updated_at=u.updated_at,
            )
            for u in page_obj.object_list
        ]

        payload = {
            "info": PaginationInfo(
                current_page=page,
                total_pages=paginator.num_pages,
                total_items=paginator.count,
            ),
            "results": results,
        }
        return 200, payload

    except HttpError as he:
        return he.status_code, {"message": he.message}
    except Exception as e:
        return 500, {"message": str(e)}

@api.post("/users/", response={201: UserSchema, **RESP_STD, 409: ErrorMessages}, tags=["Users"])
def create_user(request, payload: UserCreateSchema):
    try:
        org = _org_id(request)

        # prefer org-scoped uniqueness (model still has global unique on email; IntegrityError will catch)
        if User.objects.filter(email__iexact=payload.email, org_id=org).exists():
            return 409, {"message": "Email already exists in your organization", "code": "uniqueViolation"}

        obj = User.objects.create(
            email=payload.email,
            name=payload.name,
            role=payload.role if payload.role is not None else UserRole.EMPLOYEE,
            org_id=org,
        )
        obj.set_password(payload.password)
        obj.save()

        return 201, UserSchema(
            id=obj.id,
            email=obj.email,
            name=obj.name,
            role=obj.role,
            org_id=obj.org_id,
            created_at=getattr(obj, "created_at", None),
            updated_at=getattr(obj, "updated_at", None),
        )
    except HttpError as he:
        return he.status_code, {"message": he.message}
    except IntegrityError:
        return 409, {"message": "Email already exists", "code": "uniqueViolation"}
    except Exception as e:
        return 500, {"message": str(e)}

@api.get("/users/{user_id}/", response={200: UserSchema, **RESP_MSG}, tags=["Users"])
def get_user(request, user_id: int):
    try:
        org = _org_id(request)
        try:
            u = User.objects.get(id=user_id, org_id=org)
        except User.DoesNotExist:
            return 404, {"message": "User not found"}

        return 200, UserSchema(
            id=u.id,
            email=u.email,
            name=u.name,
            role=u.role,
            org_id=u.org_id,
            created_at=u.created_at,
            updated_at=u.updated_at,
        )
    except HttpError as he:
        return he.status_code, {"message": he.message}
    except Exception as e:
        return 500, {"message": str(e)}

@api.patch("/users/{user_id}/", response={200: UserSchema, **RESP_STD, 404: MessageResponse, 409: ErrorMessages}, tags=["Users"])
def update_user(request, user_id: int, payload: UserUpdateSchema):
    try:
        org = _org_id(request)
        try:
            u = User.objects.get(id=user_id, org_id=org)
        except User.DoesNotExist:
            return 404, {"message": "User not found"}

        data = payload.dict(exclude_unset=True)

        if "email" in data and data["email"] and data["email"] != u.email:
            if User.objects.filter(email__iexact=data["email"], org_id=org).exclude(id=u.id).exists():
                return 409, {"message": "Email already exists", "code": "uniqueViolation"}

        if "password" in data and data["password"]:
            u.set_password(data["password"])
            del data["password"]

        for k, v in data.items():
            setattr(u, k, v)
        u.save()

        return 200, UserSchema(
            id=u.id,
            email=u.email,
            name=u.name,
            role=u.role,
            org_id=u.org_id,
            created_at=u.created_at,
            updated_at=u.updated_at,
        )
    except HttpError as he:
        return he.status_code, {"message": he.message}
    except Exception as e:
        return 500, {"message": str(e)}

@api.delete("/users/{user_id}/", response={200: MessageResponse, **RESP_MSG}, tags=["Users"])
def delete_user(request, user_id: int):
    try:
        org = _org_id(request)
        try:
            u = User.objects.get(id=user_id, org_id=org)
        except User.DoesNotExist:
            return 404, {"message": "User not found"}

        u.delete()
        return 200, {"message": "User deleted", "code": "UserDeleted"}

    except HttpError as he:
        return he.status_code, {"message": he.message}
    except Exception as e:
        return 500, {"message": str(e)}


# =========================
# Accounts (int IDs)
# =========================

def _serialize_account(a: Account) -> AccountSchema:
    return AccountSchema(
        id=a.id,
        name=a.name,
        type=a.type,
        currency=a.currency,
        balance=a.balance,
        is_default=a.is_default,
        user_id=a.user_id,
        org_id=a.org_id,
        created_at=a.created_at,
        updated_at=a.updated_at,
    )

@api.get("/accounts/", response={200: PaginatedAccountResponse, **RESP_STD}, tags=["Accounts"])
def list_accounts(
    request,
    page: int = Query(1, description="Page number"),
    page_size: int = Query(10, description="Items per page"),
    q: Optional[str] = Query(None, description="Search by name"),
    user_id: Optional[int] = Query(None, description="Filter by user id"),
    type: Optional[str] = Query(None, description="Filter by account type"),
    currency: Optional[str] = Query(None, description="Filter by currency (e.g., USD)"),
    is_default: Optional[bool] = Query(None, description="Filter by default flag"),
    
):
    """Paginated accounts with filters (org-scoped)."""
    try:
        org = _org_id(request)
        qs = Account.objects.select_related("user").filter(org_id=org).order_by("name")

        if q:
            qs = qs.filter(name__icontains=q)
        if user_id is not None:
            qs = qs.filter(user_id=user_id)
        if type:
            qs = qs.filter(type=type)
        if currency:
            qs = qs.filter(currency__iexact=currency)
        if is_default is not None:
            qs = qs.filter(is_default=is_default)
    

        paginator = Paginator(qs, page_size)
        try:
            page_obj = paginator.page(page)
        except PageNotAnInteger:
            return 400, {"message": "Invalid page number", "code": "paginationError"}
        except EmptyPage:
            return 400, {"message": "Page number out of range", "code": "paginationError"}

        payload = {
            "info": PaginationInfo(
                current_page=page,
                total_pages=paginator.num_pages,
                total_items=paginator.count,
            ),
            "results": [_serialize_account(a) for a in page_obj.object_list],
        }
        return 200, payload

    except HttpError as he:
        return he.status_code, {"message": he.message}
    except Exception as e:
        return 500, {"message": str(e)}

@api.post("/accounts/", response={201: AccountSchema, **RESP_STD, 404: MessageResponse, 409: ErrorMessages}, tags=["Accounts"])
def create_account(request, payload: AccountCreateSchema):
    """
    Create an account. `user` must be an existing User id (int) in the same org.
    """
    try:
        org = _org_id(request)
        # default to current user if omitted
        user_pk = payload.user if payload.user is not None else request.user.id
        u = _fk_in_org_or_404(User, user_pk, org, "User")

        obj = Account.objects.create(
            name=payload.name,
            type=payload.type,
            currency=payload.currency,
            balance=payload.balance,
            is_default=payload.is_default or False,
            user_id=u.id,
            org_id=org,
        )
        return 201, _serialize_account(obj)

    except HttpError as he:
        return he.status_code, {"message": he.message}
    except IntegrityError as e:
        return 409, {"message": str(e), "code": "integrityError"}
    except Exception as e:
        return 500, {"message": str(e)}

@api.get("/accounts/{account_id}/", response={200: AccountSchema, **RESP_MSG}, tags=["Accounts"])
def get_account(request, account_id: int):
    """Retrieve a single account by id (org-scoped)."""
    try:
        org = _org_id(request)
        try:
            a = Account.objects.get(id=account_id, org_id=org)
        except Account.DoesNotExist:
            return 404, {"message": "Account not found"}

        return 200, _serialize_account(a)

    except HttpError as he:
        return he.status_code, {"message": he.message}
    except Exception as e:
        return 500, {"message": str(e)}

@api.patch("/accounts/{account_id}/", response={200: AccountSchema, **RESP_STD, 404: MessageResponse, 409: ErrorMessages}, tags=["Accounts"])
def update_account(request, account_id: int, payload: AccountUpdateSchema):
    """
    Partial update of an account. You may also move it to another user by passing `user` (int in same org).
    """
    try:
        org = _org_id(request)
        try:
            a = Account.objects.get(id=account_id, org_id=org)
        except Account.DoesNotExist:
            return 404, {"message": "Account not found"}

        data = payload.dict(exclude_unset=True)

        if "user" in data and data["user"] is not None:
            u = _fk_in_org_or_404(User, data["user"], org, "User")
            a.user_id = u.id
            del data["user"]

        for k, v in data.items():
            setattr(a, k, v)

        a.save()
        return 200, _serialize_account(a)

    except HttpError as he:
        return he.status_code, {"message": he.message}
    except IntegrityError as e:
        return 409, {"message": str(e), "code": "integrityError"}
    except Exception as e:
        return 500, {"message": str(e)}

@api.delete("/accounts/{account_id}/", response={200: MessageResponse, **RESP_MSG}, tags=["Accounts"])
def delete_account(request, account_id: int):
    """Delete an account by id (org-scoped)."""
    try:
        org = _org_id(request)
        try:
            a = Account.objects.get(id=account_id, org_id=org)
        except Account.DoesNotExist:
            return 404, {"message": "Account not found"}

        a.delete()
        return 200, {"message": "Account deleted", "code": "AccountDeleted"}

    except HttpError as he:
        return he.status_code, {"message": he.message}
    except Exception as e:
        return 500, {"message": str(e)}



# =========================
# Projects (int IDs)
# =========================

def _serialize_project(p: Project) -> ProjectSchema:
    return ProjectSchema(
        id=p.id,
        name=p.name,
        code=p.code,
        description=p.description,
        is_active=p.is_active,
        user_id=p.user_id,
        org_id=p.org_id,
        created_at=p.created_at,
        updated_at=p.updated_at,
    )

@api.get("/projects/", response={200: PaginatedProjectResponse, **RESP_STD, 404: MessageResponse}, tags=["Projects"])
def list_projects(
    request,
    page: int = Query(1, description="Page number"),
    page_size: int = Query(10, description="Number of items per page"),
    q: Optional[str] = Query(None, description="Search by project name or code"),
    user_id: Optional[int] = Query(None, description="Filter by user id"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
):
    """Retrieve paginated list of projects with filters (org-scoped)."""
    try:
        org = _org_id(request)
        qs = Project.objects.select_related("user").filter(org_id=org).order_by("name")

        if q:
            qs = qs.filter(Q(name__icontains=q) | Q(code__icontains=q))
        if user_id is not None:
            qs = qs.filter(user_id=user_id)
        if is_active is not None:
            qs = qs.filter(is_active=is_active)
      

        paginator = Paginator(qs, page_size)
        try:
            page_obj = paginator.page(page)
        except PageNotAnInteger:
            return 400, {"message": "Invalid page number", "code": "paginationError"}
        except EmptyPage:
            return 400, {"message": "Page out of range", "code": "paginationError"}

        payload = {
            "info": PaginationInfo(
                current_page=page,
                total_pages=paginator.num_pages,
                total_items=paginator.count,
            ),
            "results": [_serialize_project(p) for p in page_obj.object_list],
        }
        return 200, payload

    except HttpError as he:
        return he.status_code, {"message": he.message}
    except Exception as e:
        return 500, {"message": str(e)}

@api.post("/projects/", response={201: ProjectSchema, **RESP_STD, 404: MessageResponse, 409: ErrorMessages}, tags=["Projects"])
def create_project(request, payload: ProjectCreateSchema):
    """Create a new project for a specific user (int id), in your org."""
    try:
        org = _org_id(request)
        u = _fk_in_org_or_404(User, payload.user, org, "User")

        project = Project.objects.create(
            name=payload.name,
            code=payload.code,
            description=payload.description,
            is_active=payload.is_active,
            user_id=u.id,
            org_id=org,
        )
        return 201, _serialize_project(project)

    except HttpError as he:
        return he.status_code, {"message": he.message}
    except IntegrityError as e:
        return 409, {"message": str(e), "code": "integrityError"}
    except Exception as e:
        return 500, {"message": str(e)}

@api.get("/projects/{project_id}/", response={200: ProjectSchema, **RESP_MSG}, tags=["Projects"])
def get_project(request, project_id: int):
    """Retrieve a project by its ID (org-scoped)."""
    try:
        org = _org_id(request)
        try:
            p = Project.objects.get(id=project_id, org_id=org)
        except Project.DoesNotExist:
            return 404, {"message": "Project not found"}

        return 200, _serialize_project(p)

    except HttpError as he:
        return he.status_code, {"message": he.message}
    except Exception as e:
        return 500, {"message": str(e)}

@api.patch("/projects/{project_id}/", response={200: ProjectSchema, **RESP_STD, 404: MessageResponse, 409: ErrorMessages}, tags=["Projects"])
def update_project(request, project_id: int, payload: ProjectUpdateSchema):
    """Update an existing project (org-scoped)."""
    try:
        org = _org_id(request)
        try:
            p = Project.objects.get(id=project_id, org_id=org)
        except Project.DoesNotExist:
            return 404, {"message": "Project not found"}

        data = payload.dict(exclude_unset=True)

        if "user" in data:
            u = _fk_in_org_or_404(User, data["user"], org, "User")
            p.user_id = u.id
            del data["user"]

        for k, v in data.items():
            setattr(p, k, v)

        p.save()
        return 200, _serialize_project(p)

    except HttpError as he:
        return he.status_code, {"message": he.message}
    except IntegrityError as e:
        return 409, {"message": str(e), "code": "integrityError"}
    except Exception as e:
        return 500, {"message": str(e)}

@api.delete("/projects/{project_id}/", response={200: MessageResponse, **RESP_MSG}, tags=["Projects"])
def delete_project(request, project_id: int):
    """Delete a project by ID (org-scoped)."""
    try:
        org = _org_id(request)
        try:
            p = Project.objects.get(id=project_id, org_id=org)
        except Project.DoesNotExist:
            return 404, {"message": "Project not found"}

        p.delete()
        return 200, {"message": "Project deleted successfully", "code": "ProjectDeleted"}

    except HttpError as he:
        return he.status_code, {"message": he.message}
    except Exception as e:
        return 500, {"message": str(e)}


# =========================
# Categories (int IDs)
# =========================

def _serialize_category(c: Category) -> CategorySchema:
    return CategorySchema(
        id=c.id,
        name=c.name,
        kind=c.kind,
        user_id=c.user_id,
        org_id=c.org_id,
        created_at=c.created_at,
        updated_at=c.updated_at,
    )

@api.get("/categories/", response={200: PaginatedCategoryResponse, **RESP_STD}, tags=["Categories"])
def list_categories(
    request,
    page: int = Query(1, description="Page number"),
    page_size: int = Query(10, description="Items per page"),
    q: Optional[str] = Query(None, description="Search by name"),
    user_id: Optional[int] = Query(None, description="Filter by user id"),
    kind: Optional[str] = Query(None, description="Filter by kind: income | expense"),
):
    """Paginated categories with filters (org-scoped)."""
    try:
        org = _org_id(request)
        qs = Category.objects.select_related("user").filter(org_id=org).order_by("name")

        if q:
            qs = qs.filter(name__icontains=q)
        if user_id is not None:
            qs = qs.filter(user_id=user_id)
        if kind:
            qs = qs.filter(kind=kind)
   

        paginator = Paginator(qs, page_size)
        try:
            page_obj = paginator.page(page)
        except PageNotAnInteger:
            return 400, {"message": "Invalid page number", "code": "paginationError"}
        except EmptyPage:
            return 400, {"message": "Page number out of range", "code": "paginationError"}

        payload = {
            "info": PaginationInfo(
                current_page=page,
                total_pages=paginator.num_pages,
                total_items=paginator.count,
            ),
            "results": [_serialize_category(c) for c in page_obj.object_list],
        }
        return 200, payload

    except HttpError as he:
        return he.status_code, {"message": he.message}
    except Exception as e:
        return 500, {"message": str(e)}

@api.post("/categories/", response={201: CategorySchema, **RESP_STD, 404: MessageResponse, 409: ErrorMessages}, tags=["Categories"])
def create_category(request, payload: CategoryCreateSchema):
    """Create a category for a user. Unique per (org, user, kind, name)."""
    try:
        org = _org_id(request)
        u = _fk_in_org_or_404(User, payload.user, org, "User")

        # enforce uniqueness before hitting DB (org-scoped)
        if Category.objects.filter(
            org_id=org, user_id=u.id, kind=payload.kind, name__iexact=payload.name
        ).exists():
            return 409, {"message": "Category already exists for this user/kind/name in your org", "code": "uniqueViolation"}

        c = Category.objects.create(
            name=payload.name,
            kind=payload.kind,
            user_id=u.id,
            org_id=org,
        )
        return 201, _serialize_category(c)

    except HttpError as he:
        return he.status_code, {"message": he.message}
    except IntegrityError as e:
        return 409, {"message": str(e), "code": "integrityError"}
    except Exception as e:
        return 500, {"message": str(e)}

@api.get("/categories/{category_id}/", response={200: CategorySchema, **RESP_MSG}, tags=["Categories"])
def get_category(request, category_id: int):
    """Retrieve a category by ID (org-scoped)."""
    try:
        org = _org_id(request)
        try:
            c = Category.objects.get(id=category_id, org_id=org)
        except Category.DoesNotExist:
            return 404, {"message": "Category not found"}

        return 200, _serialize_category(c)

    except HttpError as he:
        return he.status_code, {"message": he.message}
    except Exception as e:
        return 500, {"message": str(e)}

@api.patch("/categories/{category_id}/", response={200: CategorySchema, **RESP_STD, 404: MessageResponse, 409: ErrorMessages}, tags=["Categories"])
def update_category(request, category_id: int, payload: CategoryUpdateSchema):
    """Partial update of a category (org-scoped)."""
    try:
        org = _org_id(request)
        try:
            c = Category.objects.get(id=category_id, org_id=org)
        except Category.DoesNotExist:
            return 404, {"message": "Category not found"}

        data = payload.dict(exclude_unset=True)

        # handle moving to another user (same org)
        if "user" in data and data["user"] is not None:
            u = _fk_in_org_or_404(User, data["user"], org, "User")
            c.user_id = u.id
            del data["user"]

        # if name/kind changed, enforce uniqueness (org, user, kind, name)
        new_name = data.get("name", c.name)
        new_kind = data.get("kind", c.kind)
        if Category.objects.filter(
            org_id=org, user_id=c.user_id, kind=new_kind, name__iexact=new_name
        ).exclude(id=c.id).exists():
            return 409, {"message": "Category already exists for this user/kind/name in your org", "code": "uniqueViolation"}

        for k, v in data.items():
            setattr(c, k, v)

        c.save()
        return 200, _serialize_category(c)

    except HttpError as he:
        return he.status_code, {"message": he.message}
    except IntegrityError as e:
        return 409, {"message": str(e), "code": "integrityError"}
    except Exception as e:
        return 500, {"message": str(e)}

@api.delete("/categories/{category_id}/", response={200: MessageResponse, **RESP_MSG}, tags=["Categories"])
def delete_category(request, category_id: int):
    """Delete a category by id (org-scoped)."""
    try:
        org = _org_id(request)
        try:
            c = Category.objects.get(id=category_id, org_id=org)
        except Category.DoesNotExist:
            return 404, {"message": "Category not found"}

        c.delete()
        return 200, {"message": "Category deleted", "code": "CategoryDeleted"}

    except HttpError as he:
        return he.status_code, {"message": he.message}
    except Exception as e:
        return 500, {"message": str(e)}


# =========================
# Budgets (int IDs)
# =========================

def _serialize_budget(b: Budget) -> BudgetSchema:
    return BudgetSchema(
        id=b.id,
        name=b.name,
        description=b.description,
        amount=b.amount,
        warn_at_percent=b.warn_at_percent,
        max_per_txn=b.max_per_txn,
        category_id=b.category_id if b.category_id else None,
        account_id=b.account_id if b.account_id else None,
        project_id=b.project_id if b.project_id else None,
        user_id=b.user_id,
        period_start=b.period_start,
        period_end=b.period_end,
        last_alert_sent=b.last_alert_sent,
        is_active=b.is_active,
        org_id=b.org_id,
        created_at=b.created_at,
        updated_at=b.updated_at,
    )

@api.get("/budgets/", response={200: PaginatedBudgetResponse, **RESP_STD}, tags=["Budgets"])
def list_budgets(
    request,
    page: int = Query(1, description="Page number"),
    page_size: int = Query(10, description="Items per page"),
    q: Optional[str] = Query(None, description="Search by name/description"),
    user_id: Optional[int] = Query(None, description="Filter by user id"),
    project_id: Optional[int] = Query(None, description="Filter by project id"),
    account_id: Optional[int] = Query(None, description="Filter by account id"),
    category_id: Optional[int] = Query(None, description="Filter by category id"),
    is_active: Optional[bool] = Query(None, description="Filter by active flag"),
    starts_on_or_after: Optional[date] = Query(None, description="Period start on/after"),
    ends_on_or_before: Optional[date] = Query(None, description="Period end on/before"),
):
    """Paginated budgets with filters (org-scoped)."""
    try:
        org = _org_id(request)
        qs = Budget.objects.select_related("user", "project", "account", "category")\
            .filter(org_id=org).order_by("-period_start", "name")

        if q:
            qs = qs.filter(Q(name__icontains=q) | Q(description__icontains=q))
        if user_id is not None:
            qs = qs.filter(user_id=user_id)
        if project_id is not None:
            qs = qs.filter(project_id=project_id)
        if account_id is not None:
            qs = qs.filter(account_id=account_id)
        if category_id is not None:
            qs = qs.filter(category_id=category_id)
        if is_active is not None:
            qs = qs.filter(is_active=is_active)
        if starts_on_or_after:
            qs = qs.filter(period_start__gte=starts_on_or_after)
        if ends_on_or_before:
            qs = qs.filter(period_end__lte=ends_on_or_before)
     

        paginator = Paginator(qs, page_size)
        try:
            page_obj = paginator.page(page)
        except PageNotAnInteger:
            return 400, {"message": "Invalid page number", "code": "paginationError"}
        except EmptyPage:
            return 400, {"message": "Page number out of range", "code": "paginationError"}

        payload = {
            "info": PaginationInfo(
                current_page=page,
                total_pages=paginator.num_pages,
                total_items=paginator.count,
            ),
            "results": [_serialize_budget(b) for b in page_obj.object_list],
        }
        return 200, payload

    except HttpError as he:
        return he.status_code, {"message": he.message}
    except Exception as e:
        return 500, {"message": str(e)}

@api.post("/budgets/", response={201: BudgetSchema, **RESP_STD, 404: MessageResponse, 409: ErrorMessages}, tags=["Budgets"])
def create_budget(request, payload: BudgetCreateSchema):
    """Create a budget (unique per org/user/project/account/category/period)."""
    try:
        org = _org_id(request)

        u = _fk_in_org_or_404(User, payload.user, org, "User")
        pid = payload.project if payload.project else None
        aid = payload.account if payload.account else None
        cid = payload.category if payload.category else None

        # Validate FKs belong to org
        p = _fk_in_org_or_404(Project, pid, org, "Project") if pid else None
        a = _fk_in_org_or_404(Account, aid, org, "Account") if aid else None
        c = _fk_in_org_or_404(Category, cid, org, "Category") if cid else None

        # Enforce uniqueness before DB constraint (org-scoped)
        if Budget.objects.filter(
            org_id=org,
            user_id=u.id,
            project_id=pid,
            account_id=aid,
            category_id=cid,
            period_start=payload.period_start,
            period_end=payload.period_end,
        ).exists():
            return 409, {"message": "A budget with the same scope & period already exists", "code": "uniqueViolation"}

        b = Budget.objects.create(
            name=payload.name,
            description=payload.description,
            amount=payload.amount,
            warn_at_percent=payload.warn_at_percent,
            max_per_txn=payload.max_per_txn,
            project_id=pid,
            account_id=aid,
            category_id=cid,
            user_id=u.id,
            period_start=payload.period_start,
            period_end=payload.period_end,
            is_active=payload.is_active if payload.is_active is not None else True,
            org_id=org,
        )
        return 201, _serialize_budget(b)

    except HttpError as he:
        return he.status_code, {"message": he.message}
    except IntegrityError as e:
        return 409, {"message": str(e), "code": "integrityError"}
    except Exception as e:
        return 500, {"message": str(e)}

@api.get("/budgets/{budget_id}/", response={200: BudgetSchema, **RESP_MSG}, tags=["Budgets"])
def get_budget(request, budget_id: int):
    """Retrieve a budget by ID (org-scoped)."""
    try:
        org = _org_id(request)
        try:
            b = Budget.objects.get(id=budget_id, org_id=org)
        except Budget.DoesNotExist:
            return 404, {"message": "Budget not found"}

        return 200, _serialize_budget(b)

    except HttpError as he:
        return he.status_code, {"message": he.message}
    except Exception as e:
        return 500, {"message": str(e)}

@api.patch("/budgets/{budget_id}/", response={200: BudgetSchema, **RESP_STD, 404: MessageResponse, 409: ErrorMessages}, tags=["Budgets"])
def update_budget(request, budget_id: int, payload: BudgetUpdateSchema):
    """Partial update of a budget; enforces org and unique scope."""
    try:
        org = _org_id(request)
        try:
            b = Budget.objects.get(id=budget_id, org_id=org)
        except Budget.DoesNotExist:
            return 404, {"message": "Budget not found"}

        data = payload.dict(exclude_unset=True)

        if "user" in data:
            u = _fk_in_org_or_404(User, data["user"], org, "User")
            b.user_id = u.id
            del data["user"]

        if "project" in data:
            pid = data["project"]
            if pid is None:
                b.project_id = None
            else:
                _fk_in_org_or_404(Project, pid, org, "Project")
                b.project_id = pid
            del data["project"]

        if "account" in data:
            aid = data["account"]
            if aid is None:
                b.account_id = None
            else:
                _fk_in_org_or_404(Account, aid, org, "Account")
                b.account_id = aid
            del data["account"]

        if "category" in data:
            cid = data["category"]
            if cid is None:
                b.category_id = None
            else:
                _fk_in_org_or_404(Category, cid, org, "Category")
                b.category_id = cid
            del data["category"]

        for k, v in data.items():
            setattr(b, k, v)

        if Budget.objects.filter(
            org_id=org,
            user_id=b.user_id,
            project_id=b.project_id,
            account_id=b.account_id,
            category_id=b.category_id,
            period_start=b.period_start,
            period_end=b.period_end,
        ).exclude(id=b.id).exists():
            return 409, {"message": "A budget with the same scope & period already exists", "code": "uniqueViolation"}

        b.save()
        return 200, _serialize_budget(b)

    except HttpError as he:
        return he.status_code, {"message": he.message}
    except IntegrityError as e:
        return 409, {"message": str(e), "code": "integrityError"}
    except Exception as e:
        return 500, {"message": str(e)}

@api.delete("/budgets/{budget_id}/", response={200: MessageResponse, **RESP_MSG}, tags=["Budgets"])
def delete_budget(request, budget_id: int):
    """Delete a budget by ID (org-scoped)."""
    try:
        org = _org_id(request)
        try:
            b = Budget.objects.get(id=budget_id, org_id=org)
        except Budget.DoesNotExist:
            return 404, {"message": "Budget not found"}

        b.delete()
        return 200, {"message": "Budget deleted", "code": "BudgetDeleted"}

    except HttpError as he:
        return he.status_code, {"message": he.message}
    except Exception as e:
        return 500, {"message": str(e)}


# =========================
# Transactions (int IDs)
# =========================

def _serialize_transaction(t: Transaction) -> TransactionSchema:
    return TransactionSchema(
        id=t.id,
        type=t.type,
        amount=t.amount,
        currency=t.currency,
        description=t.description,
        date=t.date,
        status=t.status,
        receipt_url=t.receipt_url,
        category_id=t.category_id if t.category_id else None,
        project_id=t.project_id if t.project_id else None,
        is_recurring=t.is_recurring,
        recurring_interval=t.recurring_interval,
        next_recurring_date=t.next_recurring_date,
        last_processed=t.last_processed,
        reimbursed_at=t.reimbursed_at,
        user_id=t.user_id,
        account_id=t.account_id,
        to_account_id=t.to_account_id if t.to_account_id else None,
        org_id=t.org_id,
        created_at=t.created_at,
        updated_at=t.updated_at,
    )

@api.get("/transactions/", response={200: PaginatedTransactionResponse, **RESP_STD}, tags=["Transactions"])
def list_transactions(
    request,
    page: int = Query(1, description="Page number"),
    page_size: int = Query(10, description="Items per page"),
    q: Optional[str] = Query(None, description="Search in description"),
    user_id: Optional[int] = Query(None),
    account_id: Optional[int] = Query(None),
    to_account_id: Optional[int] = Query(None),
    project_id: Optional[int] = Query(None),
    category_id: Optional[int] = Query(None),
    type: Optional[str] = Query(None, description="income | expense | transfer"),
    status: Optional[str] = Query(None, description="pending | cleared | reconciled | void"),
    is_recurring: Optional[bool] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    min_amount: Optional[Decimal] = Query(None),
    max_amount: Optional[Decimal] = Query(None),
):
    """Paginated transactions with rich filters (org-scoped)."""
    try:
        org = _org_id(request)
        qs = (Transaction.objects
              .select_related("user", "account", "to_account", "project", "category")
              .filter(org_id=org)
              .order_by("-date", "-created_at"))

        if q:
            qs = qs.filter(description__icontains=q)

        if user_id is not None:
            qs = qs.filter(user_id=user_id)
        if account_id is not None:
            qs = qs.filter(account_id=account_id)
        if to_account_id is not None:
            qs = qs.filter(to_account_id=to_account_id)
        if project_id is not None:
            qs = qs.filter(project_id=project_id)
        if category_id is not None:
            qs = qs.filter(category_id=category_id)


        if type:
            qs = qs.filter(type=type)
        if status:
            qs = qs.filter(status=status)
        if is_recurring is not None:
            qs = qs.filter(is_recurring=is_recurring)
        if date_from:
            qs = qs.filter(date__gte=date_from)
        if date_to:
            qs = qs.filter(date__lte=date_to)
        if min_amount is not None:
            qs = qs.filter(amount__gte=min_amount)
        if max_amount is not None:
            qs = qs.filter(amount__lte=max_amount)

        paginator = Paginator(qs, page_size)
        try:
            page_obj = paginator.page(page)
        except PageNotAnInteger:
            return 400, {"message": "Invalid page number", "code": "paginationError"}
        except EmptyPage:
            return 400, {"message": "Page number out of range", "code": "paginationError"}

        payload = {
            "info": PaginationInfo(
                current_page=page,
                total_pages=paginator.num_pages,
                total_items=paginator.count,
            ),
            "results": [_serialize_transaction(t) for t in page_obj.object_list],
        }
        return 200, payload

    except HttpError as he:
        return he.status_code, {"message": he.message}
    except Exception as e:
        return 500, {"message": str(e)}

@api.post(
    "/transactions/",
    response={201: TransactionSchema, **RESP_STD, 404: MessageResponse, 409: ErrorMessages},
    tags=["Transactions"],
)
def create_transaction(request, payload: TransactionCreateSchema):
    """
    Create a transaction (org-scoped).
    - If type=transfer -> `to_account` is REQUIRED and `category` must be NULL.
    - For income/expense -> `category` optional; `to_account` must be NULL.
    """
    try:
        org = _org_id(request)
        # Required FKs (must be in same org)
        u = _fk_in_org_or_404(User, payload.user, org, "User")
        a = _fk_in_org_or_404(Account, payload.account, org, "Account")

        # Optional FKs
        pid = payload.project if payload.project is not None else None
        cid = payload.category if payload.category is not None else None
        tid = payload.to_account if payload.to_account is not None else None

        if pid is not None:
            _fk_in_org_or_404(Project, pid, org, "Project")
        if cid is not None:
            _fk_in_org_or_404(Category, cid, org, "Category")
        if tid is not None:
            _fk_in_org_or_404(Account, tid, org, "Destination account")

        # Business rules
        if payload.type == "transfer":
            if tid is None:
                return 400, {"message": "to_account is required for transfer", "code": "validationError"}
            if cid is not None:
                return 400, {"message": "category must be null for transfer", "code": "validationError"}
            if payload.account == tid:
                return 400, {"message": "account and to_account must be different", "code": "validationError"}
        else:
            if tid is not None:
                return 400, {"message": "to_account not allowed unless type=transfer", "code": "validationError"}

        t = Transaction.objects.create(
            type=payload.type,
            amount=payload.amount,
            currency=payload.currency,
            description=payload.description,
            date=payload.date,
            status=payload.status,
            receipt_url=payload.receipt_url,
            category_id=cid,
            project_id=pid,
            is_recurring=payload.is_recurring or False,
            recurring_interval=payload.recurring_interval,
            next_recurring_date=payload.next_recurring_date,
            last_processed=payload.last_processed,
            reimbursed_at=payload.reimbursed_at,
            user_id=u.id,
            account_id=a.id,
            to_account_id=tid,
            org_id=org,
        )
        return 201, _serialize_transaction(t)

    except HttpError as he:
        return he.status_code, {"message": he.message}
    except IntegrityError as e:
        return 409, {"message": str(e), "code": "integrityError"}
    except Exception as e:
        return 500, {"message": str(e)}

@api.get("/transactions/{transaction_id}/", response={200: TransactionSchema, **RESP_MSG}, tags=["Transactions"])
def get_transaction(request, transaction_id: int):
    """Retrieve a transaction by ID (org-scoped)."""
    try:
        org = _org_id(request)
        try:
            t = Transaction.objects.get(id=transaction_id, org_id=org)
        except Transaction.DoesNotExist:
            return 404, {"message": "Transaction not found"}

        return 200, _serialize_transaction(t)

    except HttpError as he:
        return he.status_code, {"message": he.message}
    except Exception as e:
        return 500, {"message": str(e)}

@api.patch("/transactions/{transaction_id}/", response={200: TransactionSchema, **RESP_STD, 404: MessageResponse, 409: ErrorMessages}, tags=["Transactions"])
def update_transaction(request, transaction_id: int, payload: TransactionUpdateSchema):
    """
    Partial update (org-scoped).
    - Enforces transfer rules.
    - Allows moving between accounts/projects/categories/users via integer IDs in same org.
    """
    try:
        org = _org_id(request)
        try:
            t = Transaction.objects.get(id=transaction_id, org_id=org)
        except Transaction.DoesNotExist:
            return 404, {"message": "Transaction not found"}

        data = payload.dict(exclude_unset=True)

        if "user" in data:
            u = _fk_in_org_or_404(User, data["user"], org, "User")
            t.user_id = u.id
            del data["user"]

        if "account" in data:
            a = _fk_in_org_or_404(Account, data["account"], org, "Account")
            t.account_id = a.id
            del data["account"]

        if "to_account" in data:
            if data["to_account"] is None:
                t.to_account_id = None
            else:
                _fk_in_org_or_404(Account, data["to_account"], org, "Destination account")
                t.to_account_id = data["to_account"]
            del data["to_account"]

        if "project" in data:
            if data["project"] is None:
                t.project_id = None
            else:
                _fk_in_org_or_404(Project, data["project"], org, "Project")
                t.project_id = data["project"]
            del data["project"]

        if "category" in data:
            if data["category"] is None:
                t.category_id = None
            else:
                _fk_in_org_or_404(Category, data["category"], org, "Category")
                t.category_id = data["category"]
            del data["category"]

        for k, v in data.items():
            setattr(t, k, v)

        if t.type == "transfer":
            if not t.to_account_id:
                return 400, {"message": "to_account is required for transfer", "code": "validationError"}
            if t.category_id is not None:
                return 400, {"message": "category must be null for transfer", "code": "validationError"}
            if t.account_id == t.to_account_id:
                return 400, {"message": "account and to_account must be different", "code": "validationError"}
        else:
            if t.to_account_id is not None:
                return 400, {"message": "to_account not allowed unless type=transfer", "code": "validationError"}

        t.save()
        return 200, _serialize_transaction(t)

    except HttpError as he:
        return he.status_code, {"message": he.message}
    except IntegrityError as e:
        return 409, {"message": str(e), "code": "integrityError"}
    except Exception as e:
        return 500, {"message": str(e)}

@api.delete("/transactions/{transaction_id}/", response={200: MessageResponse, **RESP_MSG}, tags=["Transactions"])
def delete_transaction(request, transaction_id: int):
    """Delete a transaction by ID (org-scoped)."""
    try:
        org = _org_id(request)
        try:
            t = Transaction.objects.get(id=transaction_id, org_id=org)
        except Transaction.DoesNotExist:
            return 404, {"message": "Transaction not found"}

        t.delete()
        return 200, {"message": "Transaction deleted", "code": "TransactionDeleted"}

    except HttpError as he:
        return he.status_code, {"message": he.message}
    except Exception as e:
        return 500, {"message": str(e)}


# =========================
# Admin Dashboard Overview (ORG-SCOPED)
# =========================

from decimal import Decimal
from datetime import date, timedelta
from django.utils import timezone
from django.db.models import Q, Sum, Value, DecimalField
from django.db.models.functions import Coalesce, TruncDay, TruncMonth

# assumes _org_id(request) helper already exists in this module
# def _org_id(request) -> int: ...

def _fmt_money(v: Decimal, currency: str = "USD") -> str:
    # return a preformatted string (client wants strings)
    try:
        from babel.numbers import format_currency  # optional if you use Babel
        return format_currency(v or Decimal("0"), currency)
    except Exception:
        # plain fallback
        return f"{currency} {Decimal(v or 0):,.2f}"
@api.get("/dashboard/overview/",response={200: DashboardOverview, 401: MessageResponse, 500: MessageResponse},
    tags=["Dashboard"],)
def dashboard_overview(request, currency: str = "USD", recent_limit: int = 5, accounts_limit: int = 3,
                       org_id: Optional[int] = Query(None, description="Organization id")):
    try:
        now = timezone.now()
        today = now.date()
        start_30 = today - timedelta(days=30)
        prev_start_30 = start_30 - timedelta(days=30)

        tx_qs = Transaction.objects.filter(currency=currency)
        acc_qs = Account.objects.all()
        if org_id is not None:
            tx_qs = tx_qs.filter(org_id=org_id)
            acc_qs = acc_qs.filter(org_id=org_id)

        total_spend = tx_qs.filter(type="expense").aggregate(s=Sum("amount")).get("s") or Decimal("0")

        first_of_month = date(today.year, today.month, 1)
        prev_month_end = first_of_month - timedelta(days=1)
        prev_first = date(prev_month_end.year, prev_month_end.month, 1)

        this_month_spend = tx_qs.filter(type="expense", date__date__gte=first_of_month)\
                                .aggregate(s=Sum("amount")).get("s") or Decimal("0")
        prev_month_spend = tx_qs.filter(type="expense", date__date__gte=prev_first, date__date__lte=prev_month_end)\
                                .aggregate(s=Sum("amount")).get("s") or Decimal("0")

        def pct_change(curr: Decimal, prev: Decimal):
            if prev and prev != 0:
                pct = (curr - prev) / prev * Decimal("100")
            else:
                pct = Decimal("100") if curr else Decimal("0")
            pct = pct.quantize(Decimal("0.1"))
            up = pct >= 0
            sign = "+" if up and pct != 0 else ""
            return f"{sign}{pct}%", up

        this_delta_str, this_up = pct_change(this_month_spend, prev_month_spend)

        tx_last_30 = tx_qs.filter(date__date__gt=start_30).count()
        tx_prev_30 = tx_qs.filter(date__date__gt=prev_start_30, date__date__lte=start_30).count()
        tx_delta_str, tx_up = pct_change(Decimal(tx_last_30), Decimal(tx_prev_30))

        users_last_30 = tx_qs.filter(date__date__gt=start_30).values("user_id").distinct().count()
        users_prev_30 = tx_qs.filter(date__date__gt=prev_start_30, date__date__lte=start_30).values("user_id").distinct().count()
        users_delta_str, users_up = pct_change(Decimal(users_last_30), Decimal(users_prev_30))

        kpis = [
            KPI(label="Total Spend", value=_fmt_money(total_spend, currency), delta="+0.0%", up=True),
            KPI(label="This Month", value=_fmt_money(this_month_spend, currency), delta=this_delta_str, up=this_up),
            KPI(label="Transactions (30d)", value=f"{tx_last_30:,}", delta=tx_delta_str, up=tx_up),
            KPI(label="Active Users (30d)", value=f"{users_last_30:,}", delta=users_delta_str, up=users_up),
        ]

        recent_qs = tx_qs.select_related("account").order_by("-date","-created_at")[:max(1, recent_limit)]
        recent = [
            SlimTx(
                id=t.id,
                date=t.date.isoformat(),
                description=t.description or "",
                account=(t.account.name if getattr(t, "account", None) else f"#{t.account_id}"),
                amount=float(t.amount) if t.type != "expense" else float(-t.amount),
            ) for t in recent_qs
        ]

        acc_top = acc_qs.order_by("-balance")[:max(1, accounts_limit)]
        top_accounts = [SlimAccount(id=a.id, name=a.name, type=a.type, balance=float(a.balance or 0)) for a in acc_top]

        return 200, {"kpis": kpis, "recent": recent, "top_accounts": top_accounts}
    except Exception as e:
        return 500, {"message": str(e)}


# =========================
# Reports in the Admin Dashboard (ORG-SCOPED)
# =========================

def _resolve_range(date_from: Optional[date], date_to: Optional[date], default_days: int = 30):
    """Return a sane date range. Defaults to last `default_days` up to today."""
    today = timezone.now().date()
    end = date_to or today
    start = date_from or (end - timedelta(days=default_days))
    if start > end:
        start, end = end, start
    return start, end


@api.get("/reports/time-series/", response={200: TimeSeriesReport, 400: MessageResponse, 401: MessageResponse, 500: MessageResponse}, tags=["Reports"])
def report_time_series(
    request,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    currency: str = "USD",
    granularity: str = "month",  # "day" | "month"
):
    try:
        org = _org_id(request)
        date_from, date_to = _resolve_range(date_from, date_to)

        granularity = (granularity or "month").lower()
        if granularity not in ("day", "month"):
            return 400, {"message": "granularity must be 'day' or 'month'"}

        period_fn = TruncDay if granularity == "day" else TruncMonth

        qs = (
            Transaction.objects
            .filter(
                org_id=org,
                currency=currency,
                date__date__gte=date_from,
                date__date__lte=date_to,
            )
            .annotate(period=period_fn("date"))
            .values("period")
            .annotate(
                income=Coalesce(
                    Sum("amount", filter=Q(type="income")),
                    Value(0, output_field=DecimalField(max_digits=18, decimal_places=2)),
                ),
                expense=Coalesce(
                    Sum("amount", filter=Q(type="expense")),
                    Value(0, output_field=DecimalField(max_digits=18, decimal_places=2)),
                ),
            )
            .order_by("period")
        )

        points = []
        for row in qs:
            inc = float(row["income"] or 0)
            exp = float(row["expense"] or 0)
            net = inc - exp
            p = row["period"]
            period_str = p.strftime("%Y-%m-%d") if granularity == "day" else p.strftime("%Y-%m")
            points.append(SeriesPoint(period=period_str, income=inc, expense=exp, net=net))

        return 200, {"granularity": granularity, "points": points}
    except HttpError as he:
        return he.status_code, {"message": he.message}
    except Exception as e:
        return 500, {"message": str(e)}


@api.get("/reports/by-category/", response={200: CategoryReport, 400: MessageResponse, 401: MessageResponse, 500: MessageResponse}, tags=["Reports"])
def report_by_category(
    request,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    kind: str = "expense",   # "expense" | "income"
    currency: str = "USD",
    top_n: int = 8,
):
    try:
        org = _org_id(request)
        kind = (kind or "").lower()
        if kind not in ("expense", "income"):
            return 400, {"message": "kind must be 'expense' or 'income'"}

        date_from, date_to = _resolve_range(date_from, date_to)

        qs = (
            Transaction.objects
            .filter(
                org_id=org,
                type=kind,
                currency=currency,
                date__date__gte=date_from,
                date__date__lte=date_to,
            )
            .values("category_id", "category__name")
            .annotate(
                total=Coalesce(
                    Sum("amount"),
                    Value(0, output_field=DecimalField(max_digits=18, decimal_places=2)),
                )
            )
            .order_by("-total")
        )

        rows = list(qs)
        slices: list[CategorySlice] = []
        other_total = 0.0

        for i, r in enumerate(rows):
            entry = CategorySlice(
                id=r["category_id"] or 0,
                name=r["category__name"] or "Uncategorized",
                total=float(r["total"] or 0),
            )
            if i < max(1, top_n):
                slices.append(entry)
            else:
                other_total += entry.total

        if other_total > 0:
            slices.append(CategorySlice(id=0, name="Other", total=float(other_total)))

        return 200, {"kind": kind, "slices": slices, "other_total": float(other_total)}
    except HttpError as he:
        return he.status_code, {"message": he.message}
    except Exception as e:
        return 500, {"message": str(e)}


@api.get("/reports/budget-vs-actual/", response={200: BudgetVsActualReport, 400: MessageResponse, 401: MessageResponse, 500: MessageResponse}, tags=["Reports"])
def report_budget_vs_actual(
    request,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    currency: str = "USD",
    include_inactive: bool = False,
):
    try:
        org = _org_id(request)
        date_from, date_to = _resolve_range(date_from, date_to)

        # Only budgets in org
        bqs = Budget.objects.filter(org_id=org)
        if not include_inactive:
            bqs = bqs.filter(is_active=True)
        bqs = bqs.filter(
            period_start__lte=date_to,
            period_end__gte=date_from,
        ).order_by("name")

        rows = []
        for b in bqs:
            # intersect window
            win_start = max(date_from, b.period_start)
            win_end = min(date_to, b.period_end)

            # sum actuals for this budget's scope within org
            tq = Transaction.objects.filter(
                org_id=org,
                type="expense",
                currency=currency,
                date__date__gte=win_start,
                date__date__lte=win_end,
                user_id=b.user_id,
            )
            if b.project_id is not None:
                tq = tq.filter(project_id=b.project_id)
            if b.account_id is not None:
                tq = tq.filter(account_id=b.account_id)
            if b.category_id is not None:
                tq = tq.filter(category_id=b.category_id)

            actual = float(
                tq.aggregate(
                    s=Coalesce(
                        Sum("amount"),
                        Value(0, output_field=DecimalField(max_digits=18, decimal_places=2)),
                    )
                )["s"] or 0.0
            )

            budgeted = float(b.amount or 0.0)
            percent_used = 0.0 if budgeted == 0 else min(100.0, (actual / budgeted) * 100.0)

            rows.append(BudgetActual(
                budget_id=b.id,
                name=b.name,
                budgeted=budgeted,
                actual=actual,
                percent_used=round(percent_used, 1),
            ))

        return 200, {"rows": rows}
    except HttpError as he:
        return he.status_code, {"message": he.message}
    except Exception as e:
        return 500, {"message": str(e)}


# =========================
# Forecasts (ARIMA / Prophet) — ORG-SCOPED
# =========================
from ninja.errors import HttpError
import pandas as pd
from statsmodels.tsa.arima.model import ARIMA

from core.models import Transaction
from .schemas import (
    ForecastRequest,
    ForecastResponse,
    ForecastHistoryPoint,
    ForecastPoint,
)

# ---- helper: aggregate queryset to monthly series ----
def monthly_series(qs):
    """
    Aggregates a Transaction queryset to monthly totals.
    Expects fields: date, amount, type ('income' | 'expense').
    Returns DataFrame with columns ['period','signed'] where period is 'YYYY-MM'.
    """
    df = pd.DataFrame.from_records(qs.values("date", "amount", "type"))
    if df.empty:
        return pd.DataFrame(columns=["period", "signed"])
    df["period"] = pd.to_datetime(df["date"]).dt.to_period("M").astype(str)
    df["signed"] = df.apply(
        lambda r: r["amount"] * (1 if r["type"] == "income" else -1), axis=1
    )
    agg = df.groupby("period", as_index=False)["signed"].sum()
    return agg


# ---- endpoint: attaches directly to your existing 'api' ----
@api.post("/forecast/", response={200: ForecastResponse, 400: MessageResponse, 401: MessageResponse, 500: MessageResponse})
def forecast(request, payload: ForecastRequest):
    # always-init to avoid NameError
    history: list = []
    forecast: list = []
    model_info: dict = {}

    # validate range
    if payload.date_from and payload.date_to and payload.date_from > payload.date_to:
        raise HttpError(400, "date_from must be <= date_to")

    # ORG SCOPE
    org = _org_id(request)

    # base queryset (ORG-SCOPED)
    qs = Transaction.objects.filter(org_id=org)
    if payload.date_from:
        qs = qs.filter(date__gte=payload.date_from)
    if payload.date_to:
        qs = qs.filter(date__lte=payload.date_to)
    if payload.currency:
        qs = qs.filter(currency=payload.currency)

    # build target series
    if payload.target == "income":
        agg = monthly_series(qs.filter(type="income"))
    elif payload.target == "expense":
        agg = monthly_series(qs.filter(type="expense"))
        if not agg.empty:
            agg["signed"] = agg["signed"].abs()  # positive magnitudes
    else:  # net
        inc = monthly_series(qs.filter(type="income")).rename(columns={"signed": "inc"})
        exp = monthly_series(qs.filter(type="expense")).rename(columns={"signed": "exp"})
        agg = pd.merge(inc, exp, on="period", how="outer").fillna(0)
        if not agg.empty:
            agg["signed"] = agg["inc"] - agg["exp"]
            agg = agg[["period", "signed"]]
        else:
            agg = pd.DataFrame(columns=["period", "signed"])

    if agg.empty:
        raise HttpError(400, "No data available for the selected filters.")

    # complete monthly range (fill gaps with 0.0)
    agg = agg.copy()
    agg["dt"] = pd.to_datetime(agg["period"] + "-01")  # month starts
    agg = agg.sort_values("dt").set_index("dt")
    full_idx = pd.date_range(agg.index.min(), agg.index.max(), freq="MS")
    y = agg["signed"].reindex(full_idx, fill_value=0.0).astype(float)

    # history points for response
    history = [
        ForecastHistoryPoint(period=idx.strftime("%Y-%m"), value=float(val))
        for idx, val in y.items()
    ]

    # length guards
    model = (payload.model or "arima").lower()
    n = int(y.notna().sum())
    if model == "prophet" and n < 2:
        raise HttpError(400, "Not enough monthly points for Prophet (need ≥ 2). Widen date range.")
    if model == "arima" and n < 3:
        raise HttpError(400, "Not enough monthly points for ARIMA (need ≥ 3). Widen date range.")

    # fit + predict
    if model == "prophet":
        try:
            from prophet import Prophet  # optional, only if installed
        except Exception:
            raise HttpError(500, "Prophet is not installed on the server.")
        df_fit = pd.DataFrame({"ds": y.index, "y": y.values})
        m = Prophet(interval_width=0.8)
        m.fit(df_fit)
        future = m.make_future_dataframe(periods=payload.horizon, freq="MS", include_history=False)
        fc = m.predict(future)
        model_info = {"model": "prophet"}
        for r in fc.itertuples(index=False):
            forecast.append(ForecastPoint(
                period=r.ds.to_period("M").strftime("%Y-%m"),
                yhat=float(r.yhat),
                yhat_lower=float(r.yhat_lower),
                yhat_upper=float(r.yhat_upper),
            ))
    else:
        # ---- statsmodels ARIMA with a tiny AIC search over common orders ----
        candidate_orders = [(1,1,0), (1,1,1), (0,1,1), (2,1,1)]
        best_aic = float("inf")
        best_fit = None
        best_order = None

        for order in candidate_orders:
            try:
                model_obj = ARIMA(y, order=order)
                fit = model_obj.fit(method_kwargs={"warn_convergence": False})
                if fit.aic < best_aic:
                    best_aic = fit.aic
                    best_fit = fit
                    best_order = order
            except Exception:
                # some orders may fail for short/flat series; skip
                continue

        if best_fit is None:
            best_order = (1, 1, 1)
            best_fit = ARIMA(y, order=best_order).fit(method_kwargs={"warn_convergence": False})

        fc_res = best_fit.get_forecast(steps=payload.horizon)
        mean = fc_res.predicted_mean
        conf = fc_res.conf_int(alpha=0.2)  # ~80% CI

        future_idx = pd.date_range(y.index[-1] + pd.offsets.MonthBegin(), periods=payload.horizon, freq="MS")
        model_info = {"model": "arima", "impl": "statsmodels", "order": list(best_order)}

        for i in range(payload.horizon):
            forecast.append(ForecastPoint(
                period=future_idx[i].to_period("M").strftime("%Y-%m"),
                yhat=float(mean.iloc[i]),
                yhat_lower=float(conf.iloc[i, 0]),
                yhat_upper=float(conf.iloc[i, 1]),
            ))

    return {"history": history, "forecast": forecast, "model_info": model_info}
