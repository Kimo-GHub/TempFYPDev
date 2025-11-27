import threading
import time

from django.apps import AppConfig
from django.conf import settings


class CoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "core"

    _recurring_worker_started = False

    def ready(self):
        """
        Start a lightweight recurring runner loop when enabled via env.
        Avoids external schedulers for near-real-time posting of automations.
        """
        if self._recurring_worker_started:
            return

        enabled = getattr(settings, "RECURRING_WORKER_ENABLED", False)
        if not enabled:
            return

        # Prevent double-start under the runserver autoreloader unless explicitly forced
        import os

        run_main = os.environ.get("RUN_MAIN") == "true"
        leader = os.environ.get("RECURRING_WORKER_LEADER") == "1"
        if not (run_main or leader):
            return

        interval = float(getattr(settings, "RECURRING_WORKER_INTERVAL", 60))

        def loop():
            # Import inside the thread start to avoid AppRegistryNotReady during app loading
            from core.recurring import run_due_recurring  # noqa: WPS433
            while True:
                try:
                    run_due_recurring()
                except Exception:
                    # Silently continue; avoid crashing the loop
                    pass
                time.sleep(interval)

        t = threading.Thread(target=loop, name="recurring-runner", daemon=True)
        t.start()
        self._recurring_worker_started = True
