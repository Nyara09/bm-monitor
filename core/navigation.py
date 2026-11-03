"""The sidebar: every admin page, its icon, its group and where it lives.

A page is either a Django page (its own app, e.g. registry:mda_list) or a JavaScript screen that
is still built in the browser (pages:screen with a slug). To move a screen to Django, change its
url_name here and add the view in the app.
"""

from dataclasses import dataclass

from django.urls import reverse


@dataclass(frozen=True)
class NavItem:
    key: str  # the page key used by page permissions
    label: str
    icon: str  # a Boxicons class
    group: str
    url_name: str
    slug: str = ""  # only for JavaScript screens (pages:screen)

    def url(self):
        if self.slug:
            return reverse(self.url_name, kwargs={"slug": self.slug})
        return reverse(self.url_name)


DASHBOARDS = "Dashboards"
DATA_ENTRY = "Data entry & setup"
MAP_DATA = "Map data"
ADMINISTRATION = "Administration"

NAV_ITEMS = [
    # Dashboards (JavaScript screens)
    NavItem(
        "dash", "Daily dashboard", "bx-bar-chart-alt-2", DASHBOARDS, "pages:screen", "dashboard"
    ),
    NavItem(
        "supr",
        "Supervisor report",
        "bx-user-check",
        DASHBOARDS,
        "pages:screen",
        "supervisor-report",
    ),
    NavItem("dcar", "DCA report", "bx-id-card", DASHBOARDS, "pages:screen", "dca-report"),
    NavItem(
        "rep", "Daily reports", "bx-calendar-check", DASHBOARDS, "pages:screen", "daily-reports"
    ),
    NavItem("ana", "Daily analysis", "bx-line-chart", DASHBOARDS, "pages:screen", "daily-analysis"),
    NavItem("anl", "Analytics", "bx-pie-chart-alt-2", DASHBOARDS, "pages:screen", "analytics"),
    NavItem(
        "mda", "MDA registrations", "bx-buildings", DASHBOARDS, "pages:screen", "mda-registrations"
    ),
    NavItem(
        "msum", "Inventory report", "bx-package", DASHBOARDS, "pages:screen", "inventory-report"
    ),
    NavItem(
        "regt", "Incident log report", "bx-error-circle", DASHBOARDS, "pages:screen", "incident-log"
    ),
    NavItem("myrep", "My report", "bx-folder-open", DASHBOARDS, "pages:screen", "my-report"),
    # Data entry and setup
    NavItem(
        "new", "Enter daily report", "bx-edit-alt", DATA_ENTRY, "pages:screen", "enter-daily-report"
    ),
    NavItem("targets", "Site targets", "bx-target-lock", DATA_ENTRY, "registry:target_list"),
    NavItem("mdam", "MDAs", "bx-buildings", DATA_ENTRY, "registry:mda_list"),
    NavItem("inv", "Inventory", "bx-laptop", DATA_ENTRY, "inventory:item_list"),
    NavItem(
        "dplan", "Deployment plan", "bx-calculator", DATA_ENTRY, "pages:screen", "deployment-plan"
    ),
    NavItem("dca", "Data collectors", "bx-id-card", DATA_ENTRY, "registry:collector_list"),
    # Map data
    NavItem("counties", "Counties", "bx-map-alt", MAP_DATA, "geography:county_list"),
    NavItem("places", "Cities & towns", "bx-building-house", MAP_DATA, "geography:place_list"),
    NavItem("airports", "Airports", "bxs-plane-alt", MAP_DATA, "geography:airport_list"),
    NavItem("sites", "Registration sites", "bx-map-pin", MAP_DATA, "registry:site_list"),
    NavItem("roads", "Roads", "bx-trip", MAP_DATA, "geography:road_list"),
    # Administration
    NavItem("users", "Users & roles", "bx-group", ADMINISTRATION, "accounts:user_list"),
    NavItem("bak", "Backup & logo", "bx-data", ADMINISTRATION, "pages:screen", "backup-data"),
]
