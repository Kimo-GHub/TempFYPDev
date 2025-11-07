# core/middleware.py
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
