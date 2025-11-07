from django.contrib import admin
from django.urls import path
from django.http import HttpResponseRedirect
from django.conf import settings
from django.conf.urls.static import static

from core.views import api

def root_redirect(request):
    return HttpResponseRedirect("/api/docs")

urlpatterns = [
    path("", root_redirect),          # <— redirect / to docs
    path("admin/", admin.site.urls),
    path("api/", api.urls),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
