from django.core.management.base import BaseCommand
from core.recurring import run_due_recurring


class Command(BaseCommand):
    help = "Process recurring transactions and post their occurrences."

    def handle(self, *args, **options):
        created, processed = run_due_recurring()
        self.stdout.write(
            self.style.SUCCESS(
                f"Recurring runner complete: created {created} occurrence(s) from {processed} template(s)."
            )
        )
