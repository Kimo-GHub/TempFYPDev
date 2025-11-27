from calendar import monthrange
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from core.models import Transaction
from core.views import _apply_balance_effect


def _advance(dt, interval):
    """Advance datetime by the given recurring interval."""
    if not dt:
        dt = timezone.now()
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt)

    interval = (interval or "").lower()
    if interval == "daily":
        return dt + timedelta(days=1)
    if interval == "weekly":
        return dt + timedelta(weeks=1)
    if interval == "monthly":
        y, m = dt.year, dt.month + 1
        if m > 12:
            y += 1
            m = 1
        day = min(dt.day, monthrange(y, m)[1])
        return dt.replace(year=y, month=m, day=day)
    if interval == "yearly":
        try:
            return dt.replace(year=dt.year + 1)
        except ValueError:
            # Feb 29 -> Feb 28
            return dt.replace(month=2, day=28, year=dt.year + 1)
    # Fallback: push far into the future to avoid tight loops
    return dt + timedelta(days=3650)


class Command(BaseCommand):
    help = "Process recurring transactions and post their occurrences."

    def handle(self, *args, **options):
        now = timezone.now()
        templates = Transaction.objects.filter(is_recurring=True, next_recurring_date__lte=now)
        created = 0
        for template in templates:
            run_at = template.next_recurring_date or now
            if timezone.is_naive(run_at):
                run_at = timezone.make_aware(run_at)

            occurrences = 0
            safety = 0
            while run_at <= now and safety < 50:  # safety guard to prevent infinite loops
                safety += 1
                occ = Transaction.objects.create(
                    type=template.type,
                    amount=template.amount,
                    currency=template.currency,
                    description=template.description,
                    date=run_at,
                    status=template.status,
                    receipt_url=template.receipt_url,
                    category_id=template.category_id,
                    project_id=template.project_id,
                    is_recurring=False,
                    recurring_interval=None,
                    next_recurring_date=None,
                    last_processed=None,
                    reimbursed_at=template.reimbursed_at,
                    user_id=template.user_id,
                    account_id=template.account_id,
                    to_account_id=template.to_account_id,
                    org_id=template.org_id,
                )
                _apply_balance_effect(occ, +1)
                occurrences += 1
                created += 1
                run_at = _advance(run_at, template.recurring_interval)

            if occurrences:
                template.last_processed = now
                template.next_recurring_date = run_at
                template.save(update_fields=["last_processed", "next_recurring_date"])

        self.stdout.write(
            self.style.SUCCESS(f"Recurring runner complete: created {created} occurrence(s).")
        )
