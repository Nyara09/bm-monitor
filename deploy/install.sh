#!/usr/bin/env bash
# One-time setup on Ubuntu 22.04/24.04. Run as root from the project folder:  sudo bash deploy/install.sh
set -euo pipefail
APP=/opt/forex
apt-get update
apt-get install -y python3-venv python3-pip postgresql nginx
id forex >/dev/null 2>&1 || useradd --system --home "$APP" --shell /usr/sbin/nologin forex
mkdir -p "$APP" /etc/forex /var/backups/forex
rsync -a --exclude venv --exclude '*.pyc' ./ "$APP/"
python3 -m venv "$APP/venv"
"$APP/venv/bin/pip" install -r "$APP/requirements.txt" gunicorn "psycopg[binary]"
[ -f /etc/forex/forex.env ] || cp "$APP/deploy/env.example" /etc/forex/forex.env
echo ">> Edit /etc/forex/forex.env now (secret key, hosts, DATABASE_URL), then press Enter"; read -r
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='forex'" | grep -q 1 || \
  echo ">> Create the database:  sudo -u postgres createuser -P forex && sudo -u postgres createdb -O forex forex"
chown -R forex:www-data "$APP" /var/backups/forex
set -a; . /etc/forex/forex.env; set +a
sudo -E -u forex "$APP/venv/bin/python" "$APP/manage.py" migrate
sudo -E -u forex "$APP/venv/bin/python" "$APP/manage.py" collectstatic --noinput
cp "$APP/deploy/forex.service" "$APP/deploy/forex-backup.service" "$APP/deploy/forex-backup.timer" /etc/systemd/system/
cp "$APP/deploy/nginx-forex.conf" /etc/nginx/sites-available/forex
ln -sf /etc/nginx/sites-available/forex /etc/nginx/sites-enabled/forex
systemctl daemon-reload
systemctl enable --now forex forex-backup.timer
nginx -t && systemctl reload nginx
echo "Done. Open http://<this-server-ip>/  -  create an admin with: sudo -E -u forex $APP/venv/bin/python $APP/manage.py createsuperuser"
