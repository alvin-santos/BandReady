# Frontend assets (welcome page uses @vite)
FROM node:22-bookworm-slim AS assets

WORKDIR /app

COPY package.json ./
RUN npm install

COPY vite.config.js ./vite.config.js
COPY resources ./resources
COPY public ./public

RUN npm run build

# API runtime
FROM php:8.2-cli-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    unzip \
    libsqlite3-dev \
    libzip-dev \
    libpng-dev \
    libonig-dev \
    libxml2-dev \
    libpq-dev \
    && docker-php-ext-install -j"$(nproc)" \
        pdo_mysql \
        pdo_pgsql \
        pdo_sqlite \
        mbstring \
        exif \
        pcntl \
        bcmath \
        gd \
        zip \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

COPY . .

COPY --from=assets /app/public/build ./public/build

RUN cp .env.example .env \
    && php artisan key:generate --force --no-interaction \
    && composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader \
    && rm -f .env \
    && mkdir -p storage/framework/sessions storage/framework/views storage/framework/cache/data storage/logs bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

EXPOSE 8000

# Render sets PORT; default matches local `docker run -p 8000:8000`
CMD ["sh", "-c", "php artisan serve --host=0.0.0.0 --port=${PORT:-8000}"]
