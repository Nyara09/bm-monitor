from django.contrib import admin

from .models import ActivityLog, BackupRecord, CompanySetting, Notification, NotificationRead


@admin.register(CompanySetting)
class CompanySettingAdmin(admin.ModelAdmin):
    list_display = ("company_name", "backdate_mode", "backdate_days")


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("title", "recipient_username", "sender_username", "sent_at")
    search_fields = ("title", "text")


@admin.register(NotificationRead)
class NotificationReadAdmin(admin.ModelAdmin):
    list_display = ("notification", "username", "read_at")


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ("at", "username", "action", "kind", "detail")
    list_filter = ("action", "kind")
    search_fields = ("username", "detail")


@admin.register(BackupRecord)
class BackupRecordAdmin(admin.ModelAdmin):
    list_display = ("created_at", "kind", "size_bytes", "created_by")
    list_filter = ("kind",)
