#!/bin/bash
set -e

echo "=========================================================="
echo "    FIBER-UNMS ENTERPRISE - AUTO DEPLOYMENT SCRIPT        "
echo "=========================================================="

DB_NAME="fiber_unms_enterprise"
DB_USER="fiber_user"
DB_PASS="FiberUNMS2026Secure!"
APP_DIR="/var/www/fiber-unms"
DEPLOY_TAR="/home/jasenardian/fiber-unms-deploy.tar.gz"

echo ">>> 1. Updating System Packages..."
export DEBIAN_FRONTEND=noninteractive
sudo apt update -y && sudo apt upgrade -y

echo ">>> 2. Setting up 2GB Swap Memory..."
if [ ! -f /swapfile ]; then
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    echo "Swap memory activated successfully."
else
    echo "Swap memory already exists."
fi

echo ">>> 3. Installing Nginx, PHP 8.3, PostgreSQL, Redis, Supervisor & Utilities..."
sudo apt install -y nginx git curl unzip ufw supervisor redis-server \
    postgresql postgresql-contrib \
    php8.3-fpm php8.3-cli php8.3-pgsql php8.3-curl php8.3-mbstring \
    php8.3-xml php8.3-zip php8.3-bcmath php8.3-intl php8.3-snmp php8.3-redis

echo ">>> 4. Installing Composer..."
if ! command -v composer &> /dev/null; then
    curl -sS https://getcomposer.org/installer | php
    sudo mv composer.phar /usr/local/bin/composer
    sudo chmod +x /usr/local/bin/composer
fi

echo ">>> 5. Configuring PostgreSQL Database..."
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create Database and User if not exists
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname = '${DB_USER}'" | grep -q 1 || \
sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'" | grep -q 1 || \
sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"
sudo -u postgres psql -d ${DB_NAME} -c "GRANT ALL ON SCHEMA public TO ${DB_USER};"

echo ">>> 6. Deploying Project Files to ${APP_DIR}..."
sudo mkdir -p ${APP_DIR}
if [ -f "$DEPLOY_TAR" ]; then
    sudo tar -xzf "$DEPLOY_TAR" -C ${APP_DIR}
else
    echo "ERROR: Deploy archive $DEPLOY_TAR not found!"
    exit 1
fi

cd ${APP_DIR}

echo ">>> 7. Configuring Environment (.env)..."
if [ ! -f .env ]; then
    sudo cp .env.example .env
fi

# Set production env variables
sudo sed -i "s|^APP_ENV=.*|APP_ENV=production|" .env
sudo sed -i "s|^APP_DEBUG=.*|APP_DEBUG=false|" .env
sudo sed -i "s|^APP_URL=.*|APP_URL=http://103.89.6.125|" .env

# Configure PostgreSQL
sudo sed -i "s|^DB_CONNECTION=.*|DB_CONNECTION=pgsql|" .env
sudo sed -i "s|^DB_HOST=.*|DB_HOST=127.0.0.1|" .env
sudo sed -i "s|^DB_PORT=.*|DB_PORT=5432|" .env
sudo sed -i "s|^DB_DATABASE=.*|DB_DATABASE=${DB_NAME}|" .env
sudo sed -i "s|^DB_USERNAME=.*|DB_USERNAME=${DB_USER}|" .env
sudo sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=${DB_PASS}|" .env

# Configure Cache & Queue to Redis / database
sudo sed -i "s|^CACHE_STORE=.*|CACHE_STORE=redis|" .env
sudo sed -i "s|^QUEUE_CONNECTION=.*|QUEUE_CONNECTION=database|" .env
sudo sed -i "s|^SESSION_DRIVER=.*|SESSION_DRIVER=database|" .env

echo ">>> 8. Installing Composer Dependencies..."
sudo composer install --no-dev --optimize-autoloader --no-interaction

echo ">>> 9. Running Laravel Setup Commands..."
sudo php artisan key:generate --force
sudo php artisan storage:link --force || true
sudo php artisan migrate --force
sudo php artisan db:seed --force || true

sudo php artisan config:cache
sudo php artisan route:cache
sudo php artisan view:cache

echo ">>> 10. Setting Permissions..."
sudo chown -R www-data:www-data ${APP_DIR}
sudo chmod -R 755 ${APP_DIR}
sudo chmod -R 775 ${APP_DIR}/storage ${APP_DIR}/bootstrap/cache

echo ">>> 11. Configuring Nginx..."
sudo tee /etc/nginx/sites-available/fiber-unms > /dev/null << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name 103.89.6.125;
    root /var/www/fiber-unms/public;

    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";

    index index.php index.html;

    charset utf-8;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location = /favicon.ico { access_log off; log_not_found off; }
    location = /robots.txt  { access_log off; log_not_found off; }

    error_page 404 /index.php;

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.3-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
        fastcgi_hide_header X-Powered-By;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }

    client_max_body_size 64M;
}
EOF

sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf /etc/nginx/sites-available/fiber-unms /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl restart php8.3-fpm

echo ">>> 12. Configuring Supervisor Queue Worker..."
sudo tee /etc/supervisor/conf.d/fiber-unms-worker.conf > /dev/null << 'EOF'
[program:fiber-unms-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/fiber-unms/artisan queue:work --sleep=3 --tries=3 --max-time=3600
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=www-data
numprocs=2
redirect_stderr=true
stdout_logfile=/var/www/fiber-unms/storage/logs/worker.log
stopwaitsecs=3600
EOF

sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start fiber-unms-worker:* || true

echo ">>> 13. Configuring Laravel Scheduler Cron..."
(crontab -l 2>/dev/null | grep -v "php /var/www/fiber-unms/artisan schedule:run"; echo "* * * * * cd /var/www/fiber-unms && php artisan schedule:run >> /dev/null 2>&1") | crontab -

echo ">>> 14. Configuring UFW Firewall..."
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
echo "y" | sudo ufw enable

echo "=========================================================="
echo "    DEPLOYMENT SELESAI DENGAN SUKSES!                     "
echo "    Buka browser di: http://103.89.6.125                  "
echo "=========================================================="
