# core/middleware.py
from django.contrib.auth.models import AnonymousUser
from core.models import User


class DevUserMiddleware:
    """
    Lightweight dev-only helper: if X-User-Id is present, attach that User
    to request.user (provided it exists and optionally matches X-Org-Id).
    This avoids touching existing auth/session behavior.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # If already authenticated, leave as-is
        if getattr(request, "user", None) and not isinstance(request.user, AnonymousUser):
            return self.get_response(request)

        user_id = request.headers.get("X-User-Id")
        if user_id:
            try:
                candidate = User.objects.select_related("org").get(id=int(user_id))
                # If org header is present, enforce consistency
                org_header = request.headers.get("X-Org-Id") or request.GET.get("org_id")
                if org_header and candidate.org_id and int(org_header) != candidate.org_id:
                    # Mismatch: do not attach user
                    pass
                else:
                    request.user = candidate
            except (User.DoesNotExist, ValueError, TypeError):
                pass  # leave request.user untouched

        return self.get_response(request)


class OrgScopeMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        org_id = request.headers.get('X-Org-Id') or request.GET.get('org_id')
        try:
            request.org_id = int(org_id) if org_id else None
        except (TypeError, ValueError):
            request.org_id = None
        return self.get_response(request)
