from django.contrib import admin
from .models import User, Account, Project, Category, Budget, Transaction

# Register your models here.

admin.site.register(User)
admin.site.register(Account)
admin.site.register(Project)
admin.site.register(Category)
admin.site.register(Budget)
admin.site.register(Transaction)
