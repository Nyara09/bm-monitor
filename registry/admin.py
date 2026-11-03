from django.contrib import admin

from .models import DataCollector, Mda, RegistrationSite, SiteDataCollector


class SiteDataCollectorInline(admin.TabularInline):
    model = SiteDataCollector
    extra = 0


@admin.register(Mda)
class MdaAdmin(admin.ModelAdmin):
    search_fields = ("name",)


@admin.register(DataCollector)
class DataCollectorAdmin(admin.ModelAdmin):
    list_display = ("name", "phone", "status")
    list_filter = ("status",)
    search_fields = ("name", "phone")


@admin.register(RegistrationSite)
class RegistrationSiteAdmin(admin.ModelAdmin):
    list_display = ("name", "mda", "state", "county", "status", "is_target", "target_total")
    list_filter = ("status", "is_target", "state")
    search_fields = ("name", "mda__name", "code")
    autocomplete_fields = ("mda",)
    inlines = [SiteDataCollectorInline]
