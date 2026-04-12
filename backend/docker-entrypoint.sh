#!/bin/sh
set -e

echo "Running database migrations..."
php artisan migrate --force

echo "Running database seeders..."
php artisan db:seed --class=DownloadableSeeder --force

echo "Starting web server..."
exec php artisan serve --host=0.0.0.0 --port="${PORT:-8000}"
