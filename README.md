# BM Monitor — Django project

Built only from the `bioreg-site` template folder. The tables are normal Django screens (models, forms, function views, templates). The map, charts, dashboards and the daily-report wizard are still the template's JavaScript pages, which read and save through the storage bridge.

## Run it

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py load_reference_data   # states, counties, places, roads, MDAs, 475 sites
python manage.py createsuperuser      # this user signs in as an Admin
python manage.py runserver
```

- Sign in: http://127.0.0.1:8000/accounts/sign-in/ (the Django screens) or the sign-in on the map page
- Django admin (every model): http://127.0.0.1:8000/django-admin/
- Tests: `python manage.py test`

## Layout: one app per topic

```
config/        settings.py, urls.py
core/          shared pieces: base template, sidebar, forms mixin, paging, activity log, settings models
accounts/      sign in/out, Users & roles screen, roles and page permissions
geography/     counties, cities & towns, airports, roads (+ states)
registry/      MDAs, data collectors, registration sites, site targets
inventory/     inventory items and categories
reports/       daily reports and their models (screens are still JavaScript)
pages/         map page, JavaScript screens, storage bridge (/data/)
static/        css/, js/, fonts/
```

Inside each screen app the same four files are always there:

```
models.py      the tables
forms.py       the add/edit forms (what fields, what checks)
views.py       list, create, edit, delete — plain functions
urls.py        addresses
templates/<app>/<screen>_list.html    the table you see
```

## Where do I edit…?

| I want to change… | Screen address | Table (HTML) | Form | View | Model |
| --- | --- | --- | --- | --- | --- |
| MDAs | `/screens/mdas/` | `registry/templates/registry/mda_list.html` | `registry/forms.py` MdaForm | `registry/views.py` mda_* | `registry/models.py` Mda |
| Data collectors | `/screens/data-collectors/` | `registry/templates/registry/collector_list.html` | DataCollectorForm | collector_* | DataCollector |
| Registration sites | `/screens/registration-sites/` | `registry/templates/registry/site_list.html` | RegistrationSiteForm | site_* | RegistrationSite |
| Site targets | `/screens/site-targets/` | `registry/templates/registry/target_list.html` | SiteTargetForm | target_* | RegistrationSite (target fields) |
| Inventory | `/screens/inventory/` | `inventory/templates/inventory/item_list.html` | `inventory/forms.py` | `inventory/views.py` item_* | InventoryItem |
| Inventory categories | `/screens/inventory/categories/` | `category_list.html` | InventoryCategoryForm | category_* | InventoryCategory |
| Counties | `/screens/counties/` | `geography/templates/geography/county_list.html` | `geography/forms.py` CountyForm | `geography/views.py` county_* | County |
| Cities & towns | `/screens/cities-towns/` | `place_list.html` | PlaceForm | place_* | Place |
| Airports | `/screens/airports/` | `airport_list.html` | AirportForm | airport_* | Place (kind airport) |
| Roads | `/screens/roads/` | `road_list.html` | RoadForm | road_* | Road |
| Users & roles | `/screens/users-roles/` | `accounts/templates/accounts/user_list.html`, `user_form.html` | `accounts/forms.py` UserForm | `accounts/views.py` user_* | User + UserProfile + PagePermission |

- Add a column: add a `<th>` and a `<td>` in the `_list.html` table.
- Add a field to the form: add it to `fields` in the form class (and to the model if it is new).
- The sidebar (names, icons, groups, which screen is Django or JavaScript): `core/navigation.py`.
- Look of the Django screens: `static/css/django-screens.css`. Page frame: `core/templates/core/base.html`.
- Search and filters: the GET parameters read at the top of each `*_list` view. Paging: `core/pagination.py` (25 rows).

Every screen uses `@screen_permission("<page key>", "view" | "edit" | "delete")` from `accounts/permissions.py`, writes a line to the activity log, and deletes only with POST.

## Roles

Admin: everything. Sub admin: everything except Users & roles. Supervisor: view Supervisor report, DCA report, Incident log, My report and Enter daily report (edit only on Enter daily report). Reader: view the dashboards. On the Users & roles screen, "Choose pages by hand" replaces the role's defaults with the ticked boxes.

## Opening the map from a screen

The map is its own page (`/`). Django table screens and the JavaScript admin screens link to it with `/?map=<action>`, and `static/js/map-intent.js` runs the action once the person is inside the map view:

| Link | What happens | Where the button is |
| --- | --- | --- |
| `?map=locate&lon=..&lat=..` | Zoom to the point and flash it | Show on map: sites, cities and towns, airports, counties |
| `?map=reshape&road=<code>` | Select the road and show its handles | Reshape on map: roads |
| `?map=add&kind=site/town/city/airport/county` | Click on the map to place a new item | Add on map: the same screens |
| `?map=road` | Draw a new road | Draw road on map: roads |
| `?map=state&si=<index>` | Show one state | Show state on map: Analytics (JavaScript screen) |

Links are made with `{% load map_links %}` and `{% map_link "locate" lon=row.longitude lat=row.latitude as map_url %}` (`core/templatetags/map_links.py`). A row without a position gets no button. Items placed on the map are saved by the storage bridge into the same tables the Django screens show.

## Screens that are still JavaScript

Daily dashboard, Supervisor report, DCA report, Daily reports, Daily analysis, Analytics, MDA registrations, Inventory report, Incident log, My report, Enter daily report, Deployment plan, Backup & logo, and the map page. They live in `pages/templates/pages/` and `static/js/`. Their data goes through `static/js/django-storage.js` and `pages/storage/*` (one module per data set, e.g. `pages/storage/mdas.py`), into the same models the Django screens use. Moving one of them to a normal Django screen means: add a view, form and template in its app, then change its line in `core/navigation.py`.

## Known limits

- The JavaScript screens save a whole list per key; the last save wins when two people edit the same list at the same moment. The Django screens save one row at a time.
- The Django screens and the JavaScript screens use separate page frames (sidebar) until all screens are moved.
- A road's map points (`points`) are entered as JSON; draw tools are not part of the table screen.
- SQLite is the default database. For production change `DATABASES` in `config/settings.py` and set `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=0` and `DJANGO_ALLOWED_HOSTS`.

## Loading spinner

When a page takes longer than a quarter of a second to open, a small spinner covers the page.
It also shows on form submits (the button gets `is-loading`), during the sign-in request, and when a
script moves to another page (Administration, Map overview and Supervisor screens). It never shows
for pages that open in under a quarter of a second.

- Code: `static/js/loading-spinner.js` and `static/css/loading-spinner.css`.
- Change the delay with `SHOW_AFTER_MS` at the top of the script.
- A link that should never show it: add `data-no-spinner`.
- From your own code: `BioregSpinner.show()` and `BioregSpinner.hide()`.

## Brand colours and fonts

- Fonts: Roboto for body text and the interface, Montserrat for headings. Files are in `static/fonts`.
- Colours: black `#000000`, white `#FFFFFF`, Horizon Gold `#C5A059`, Earth Terracotta `#A0522D`,
  Steel Slate `#2F353B`.
- To change them, edit the variables at the top of `static/css/brand-fonts-colors.css` (and the
  matching blocks in `static/css/base-theme.css` and `static/css/map-controls-and-panels.css`):
  `--v` gold accent, `--vt` accent used for text, `--c` terracotta, `--b` slate,
  `--g` / `--a` / `--r` green, amber and red for status.
