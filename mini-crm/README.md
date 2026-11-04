# Мини-CRM «Объекты и задачи»

Тестовое задание на позицию Fullstack-разработчик (React / TypeScript / Supabase).

## 🚀 Быстрый старт

### 1. Установка зависимостей
```bash
npm install
```

### 2. Настройка Supabase

1. Создайте проект на [Supabase](https://supabase.com)
2. Перейдите в SQL Editor и выполните миграции по порядку:
   - `supabase/migrations/20240101000001_initial_schema.sql`
   - `supabase/migrations/20240101000002_rls_policies.sql`
   - `supabase/migrations/20240101000003_functions.sql`
   - `supabase/migrations/20240101000004_seed_data.sql` (опционально, для тестовых данных)

3. В Authentication → Settings отключите "Enable email confirmations" для упрощения тестирования

4. Создайте пользователей через Authentication → Users:
   - `setter@test.com` / `password123` (role: setter)
   - `executor1@test.com` / `password123` (role: executor)
   - `executor2@test.com` / `password123` (role: executor)
   
   В raw_user_meta_data укажите:
   ```json
   {"full_name": "Иван Иванов", "role": "setter"}
   ```

### 3. Настройка переменных окружения
```bash
cp .env.example .env
```
Заполните `.env` данными из Supabase Project Settings → API.

### 4. Запуск
```bash
npm run dev
```

Приложение откроется на http://localhost:5173

## 🏗 Архитектура

### Стек
- **Frontend**: React 18, TypeScript, Vite
- **UI**: Tailwind CSS, Radix UI, shadcn/ui компоненты
- **State**: TanStack Query (React Query)
- **Forms**: React Hook Form + Zod
- **Routing**: React Router v6
- **Backend**: Supabase (PostgreSQL, Auth, RLS, Realtime)
- **Icons**: Lucide React

### Структура проекта
```
src/
├── components/
│   ├── ui/           # Базовые UI компоненты (Button, Input, Card, etc.)
│   ├── auth/         # AuthContext, хуки авторизации
│   ├── layout/       # Header, MainLayout
│   ├── objects/      # Компоненты объектов
│   └── tasks/        # Компоненты задач
├── pages/            # Страницы приложения
├── hooks/            # Кастомные хуки
├── lib/              # Клиенты (Supabase)
├── types/            # TypeScript типы
├── utils/            # Утилиты (cn, formatDate)
└── App.tsx           # Роутинг и провайдеры
```

### База данных (Supabase)

#### Таблицы
- **profiles** — профили пользователей (роли: setter, executor)
- **objects** — строительные объекты
- **tasks** — задачи с цикл статусов
- **task_status_history** — неизменяемая история изменений статусов

#### Роли и права (RLS)
- **Постановщик (setter)**: полный доступ ко всем объектам и задачам, создание/удаление
- **Исполнитель (executor)**: видит только свои задачи и объекты, где у него есть задачи

#### Цикл статусов задачи
```
Новая → В работе → На проверке → Принята
                    ↘ На доработке → В работе
```
Переходы проверяются на уровне БД через функцию `validate_status_transition()`.

## 🔐 Безопасность

- RLS политики на всех таблицах
- Проверка переходов статусов на уровне БД
- История статусов неизменяема (нет UPDATE/DELETE политик)
- Service role ключ не используется во фронтенде
- Открытая регистрация отключена

## 📱 Функционал

### Для Постановщика
- ✅ Создание/редактирование/удаление объектов
- ✅ Создание задач с назначением исполнителя
- ✅ Просмотр всех задач и объектов
- ✅ Принятие задач / возврат на доработку (с обязательным комментарием)
- ✅ История изменений по каждой задаче

### Для Исполнителя
- ✅ Список «Мои задачи» с фильтрами по статусам
- ✅ Просмотр своих задач и объектов
- ✅ Взятие задачи в работу
- ✅ Отправка на проверку
- ✅ Просмотр истории изменений

## 🚢 Деплой

### Vercel (рекомендуется)
1. Подключите репозиторий к Vercel
2. Добавьте переменные окружения из `.env`
3. Деплой произойдет автоматически

### Docker
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0"]
```

## 📝 Решения и допущения

1. **Авторизация**: Используется Supabase Auth с email/password. Профили создаются триггером при регистрации.
2. **RLS**: Все права доступа реализованы на уровне БД, фронтенд только отображает доступные действия.
3. **Статусы**: Переходы валидируются PostgreSQL функцией, невозможно обойти через API.
4. **История**: Неизменяемая — нет политик UPDATE/DELETE для task_status_history.
5. **UI**: Использован shadcn/ui + Tailwind для быстрой разработки качественного интерфейса.
6. **Состояние**: TanStack Query для кэширования и синхронизации с сервером.
7. **Тестовые пользователи**: Создаются вручную в Supabase Dashboard для контроля.

## 🎯 Что не успели / можно улучшить

- [ ] Автотесты (Vitest + Playwright)
- [ ] Realtime обновления (Supabase Realtime)
- [ ] Push-уведомления
- [ ] Экспорт отчетов (PDF/Excel)
- [ ] Темная тема
- [ ] Пагинация для больших списков
- [ ] Поиск по задачам
- [ ] Вложения к задачам

## 📄 Лицензия

MIT