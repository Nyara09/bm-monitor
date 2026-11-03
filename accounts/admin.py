from django.contrib import admin

from .models import PagePermission, UserProfile


class PagePermissionInline(admin.TabularInline):
    model = PagePermission
    extra = 0


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "role", "phone", "status", "must_change_password")
    list_filter = ("role", "status")
    search_fields = ("user__username", "user__first_name", "user__last_name")
    inlines = [PagePermissionInline]
