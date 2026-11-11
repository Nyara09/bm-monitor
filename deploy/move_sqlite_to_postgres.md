# Moving your existing SQLite data to PostgreSQL

1. Back up first: `python manage.py backup_db`
2. Export from SQLite (DATABASE_URL **not** set):
   `python manage.py dumpdata --natural-foreign --exclude contenttypes --exclude auth.permission --exclude sessions -o data.json`
3. Set `DATABASE_URL=postgres://...` and create the tables: `python manage.py migrate`
4. Import: `python manage.py loaddata data.json`
5. Rebuild costs: `python manage.py recalculate_costs`
6. Log in and compare a few balances and reports with the old system before switching over.
