# CFUjam Backend API (Multi-Tenant Game Jam Platform)

Бэкенд-сервис для платформы проведения геймджемов (аналог itch.io) с поддержкой мульти-арендности: вузы, компании и сообщества могут создавать и администрировать свои собственные джемы.

## 🚀 Стек технологий

- **Среда выполнения:** Node.js (TypeScript)
- **Веб-фреймворк:** [Fastify](https://fastify.dev/) (высокая производительность, schema validation)
- **База данных & ORM:** PostgreSQL + [Prisma ORM](https://www.prisma.io/)
- **Аутентификация:** JWT (с разделением ролей: `USER`, `ORGANIZER`, `ADMIN`) + `bcryptjs`
- **Документация API:** Swagger / OpenAPI UI по адресу `/docs`
- **Очереди & Кэш:** Redis (для фоновой обработки и таймеров фаз)
- **Хранилище сборок:** S3-совместимое хранилище (MinIO локально / S3 в проде)

---

## 📂 Структура проекта

```text
server/
├── prisma/
│   ├── schema.prisma       # Схема БД (Users, Organizations, Jams, Teams, Submissions, Votes)
│   └── seed.ts             # Начальные данные (КФУ, CFU Game Jam 2026, админ, критерии)
├── src/
│   ├── config/             # Конфигурация (.env)
│   ├── lib/                # Prisma client, хеширование паролей, JWT утилиты
│   ├── middlewares/        # requireAuth, requireRole, optionalAuth
│   ├── modules/
│   │   ├── auth/           # /api/auth (регистрация, вход, профиль /me)
│   │   ├── organizations/  # /api/organizations (вузы, компании)
│   │   ├── jams/           # /api/jams (создание, каталог, текущий джем, участники)
│   │   ├── teams/          # /api/teams (команды, инвайты, набор участников)
│   │   ├── submissions/    # /api/submissions (загрузка сборок, игры, лайки)
│   │   └── votes/          # /api/votes (оценка по критериям, лидерборд)
│   └── server.ts           # Точка входа Fastify
├── docker-compose.yml      # PostgreSQL, Redis, MinIO
├── .env.example            # Пример переменных окружения
└── package.json
```

---

## 🌐 Мульти-арендность по поддоменам (Subdomain Multi-Tenancy)

Каждая организация или вуз работает на своём поддомене:
* `cfu.morejam.ru` — Крымский федеральный университет
* `hse.morejam.ru` — Высшая школа экономики
* `itmo.morejam.ru` — ИТМО
* `morejam.ru` — Корневая витрина платформы (все публичные джемы и каталог вузов)
* Поддержка CNAME (собственный домен вуза): `jam.cfuv.ru`

### Как это работает в API:
Бэкенд автоматически определяет организацию из заголовка `Host` (или `X-Org-Slug` в тестах):
1. **На поддомене организации (`cfu.morejam.ru`)**:
   - `GET /api/org` $\rightarrow$ информация о КФУ (название, логотип, контакты, тема оформления).
   - `GET /api/jams` $\rightarrow$ список всех джемов КФУ (прошедшие, активные, запланированные).
   - `GET /api/jams/current` $\rightarrow$ **текущий выбранный/активный джем этой организации** (без хардкода!).
   - `GET /api/jams/cfu-pixel-jam-2025` $\rightarrow$ архивный джем КФУ.
   - `GET /api/jams/:slug/teams` $\rightarrow$ команды этого конкретного джема.
2. **На главном домене платформы (`morejam.ru`)**:
   - `GET /api/jams` $\rightarrow$ все публичные джемы всех вузов и сообществ.
   - `GET /api/organizations` $\rightarrow$ каталог всех вузов и компаний.

### 🧪 Как тестировать поддомены локально:
1. Через браузер: обращаться к `cfu.localhost:4000/api/jams/current` (современные браузеры автоматически резолвят `*.localhost` на `127.0.0.1`).
2. Через Swagger / Postman: передать заголовок `X-Org-Slug: cfu` или query-параметр `?org=cfu`.

---

## 🛠 Запуск в разработке

### 1. Запуск инфраструктуры (БД, Redis, MinIO)
Если установлен Docker:
```bash
docker compose up -d
```
Запустится:
- **PostgreSQL**: порт `5432`
- **Redis**: порт `6379`
- **MinIO Console**: `http://localhost:9001` (логин/пароль: `minioadmin` / `minioadmin`)

### 2. Генерация Prisma Client и применение миграций
```bash
npm run prisma:generate
npm run prisma:push      # или npm run prisma:migrate
npm run seed             # заполнит БД вузом КФУ и джемом по умолчанию
```

### 3. Запуск сервера в режиме разработки
```bash
npm run dev
```
Сервер будет доступен на `http://localhost:4000`.
Интерактивная документация Swagger: `http://localhost:4000/docs`.

---

## 🌐 Ключевые эндпоинты API

| Метод | URL | Описание |
|---|---|---|
| `POST` | `/api/auth/register` | Регистрация участника / организатора |
| `POST` | `/api/auth/login` | Вход (получение JWT токена) |
| `GET` | `/api/auth/me` | Личные данные, уровень, опыт, команды |
| `GET` | `/api/jams/current` | Дефолтный джем (КФУ Jam для текущего фронтенда) |
| `GET` | `/api/jams` | Каталог всех джемов платформы |
| `POST` | `/api/jams` | Создание нового джема (для вуза или компании) |
| `GET` | `/api/jams/:slug/teams` | Команды конкретного джема |
| `POST` | `/api/jams/:slug/teams` | Регистрация команды |
| `GET` | `/api/jams/:slug/submissions` | Игры, поданные на джем |
| `POST` | `/api/jams/:slug/submissions` | Публикация сборки игры |
| `POST` | `/api/submissions/:id/vote` | Оценка работы по критериям джема |
| `GET` | `/api/jams/:slug/leaderboard` | Таблица лидеров и средние баллы |
