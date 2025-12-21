from django.contrib import admin
from .models import User, Account, Project, Category, Budget, Transaction, Security, MarketDataSnapshot, SimulatedPosition, TradingRuleSim

# Register your models here.

admin.site.register(User)
admin.site.register(Account)
admin.site.register(Project)
admin.site.register(Category)
admin.site.register(Budget)
admin.site.register(Transaction)

admin.site.register(Security)
admin.site.register(MarketDataSnapshot)
admin.site.register(SimulatedPosition)
admin.site.register(TradingRuleSim)
