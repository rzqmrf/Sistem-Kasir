# Stage 1: Build Frontend Assets (React + TypeScript + Vite)
FROM node:22-alpine AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY resources ./resources
COPY public ./public
COPY tsconfig.json vite.config.js tailwind.config.js postcss.config.js ./
RUN npm run build

# Stage 2: PHP 8.4 Runtime + Composer Dependencies
FROM php:8.4-cli-alpine
WORKDIR /var/www/html

RUN apk add --no-cache \
        icu-dev \
        libpq-dev \
        libzip-dev \
        sqlite-dev \
        unzip \
    && docker-php-ext-install \
        bcmath \
        intl \
        pcntl \
        pdo_pgsql \
        pdo_sqlite \
        zip

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

COPY composer.json composer.lock ./
RUN composer install --no-dev --optimize-autoloader --no-interaction --no-scripts

COPY . .
COPY --from=frontend /app/public/build ./public/build

RUN mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

EXPOSE 8000

CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000"]
