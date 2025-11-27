from decimal import Decimal
from typing import Optional

from core.models import Account, Transaction


def apply_balance_effect(tx: Transaction, mult: int = 1):
    """
    Adjust account balances for a transaction. Best-effort; swallow failures.
    mult = +1 to apply, -1 to rollback a previously applied effect.
    """
    try:
        amt = Decimal(tx.amount or 0)
    except Exception:
        return
    if not amt:
        return

    def adjust(acc_id: Optional[int], delta: Decimal):
        if not acc_id:
            return
        try:
            acc = Account.objects.get(id=acc_id, org_id=tx.org_id)
        except Account.DoesNotExist:
            return
        before = acc.balance or Decimal("0")
        acc.balance = before + delta
        try:
            acc.save(update_fields=["balance"])
        except Exception:
            pass

    if tx.type == "expense":
        adjust(tx.account_id, -(amt * mult))
    elif tx.type == "income":
        adjust(tx.account_id, +(amt * mult))
    elif tx.type == "transfer":
        adjust(tx.account_id, -(amt * mult))
        adjust(tx.to_account_id, +(amt * mult))
