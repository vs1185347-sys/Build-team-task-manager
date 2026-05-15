# Team Task Manager

A production-ready Django + React team task management app built for a full-stack technical assessment. It includes JWT authentication, Admin/Member RBAC, projects, assigned tasks, Kanban status updates, analytics, polished responsive UI, and Railway deployment support.

## Features

- Email signup/login with Django password hashing and strong password validation
- HttpOnly JWT cookies via `djangorestframework-simplejwt`
- Admin and Member roles enforced by DRF permissions
- Project CRUD with due dates, members, progress, task counts, and activity feed
- Task CRUD with priorities, statuses, assignment, filters, search, overdue state, and drag-and-drop Kanban updates
- Modern SaaS dashboard with stat cards, Chart.js analytics, recent work, and activity
- Team role management for Admin users
- Dark/light mode, responsive sidebar, toasts, skeleton states, empty states, and glass-style cards
- PostgreSQL configuration with Railway `DATABASE_URL`
- Gunicorn, Whitenoise, static build collection, and Railway-ready config

## Screenshots

Run the app locally and capture:

- Dashboard: `http://localhost:5173/`
- Projects board: `http://localhost:5173/projects`
- Kanban tasks: `http://localhost:5173/tasks`

## Tech Stack

- Backend: Django 5, Django REST Framework, Simple JWT
- Database: PostgreSQL with Django ORM
- Frontend: React 18, TypeScript, Vite
- UI: Tailwind CSS, Framer Motion, Lucide icons, shadcn/ui-inspired primitives
- Charts: Chart.js + react-chartjs-2
- Deployment: Railway, Gunicorn, Whitenoise

## Project Structure

```text
backend/
  apps/
    accounts/
    dashboard/
    projects/
    tasks/
  config/
  manage.py
  requirements.txt
frontend/
  src/
    components/
    pages/
    services/
    types/
    utils/
Procfile
railway.json
requirements.txt
runtime.txt
```

## Local Setup

1. Create and activate a virtual environment.

   ```bash
   python -m venv .venv
   source .venv/bin/activate
   ```

2. Install backend dependencies.

   ```bash
   pip install -r backend/requirements.txt
   ```

3. Create `.env` from `.env.example` and set `DATABASE_URL`.

   ```bash
   cp .env.example .env
   ```

4. Create a PostgreSQL database named `team_task_manager`, then run migrations.

   ```bash
   cd backend
   python manage.py migrate
   python manage.py seed_demo
   python manage.py runserver
   ```

5. Install and run the React frontend in another terminal.

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

6. Open `http://localhost:5173`.

## Environment Variables

```text
SECRET_KEY=replace-with-a-long-random-secret
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1,.railway.app
CSRF_TRUSTED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,https://*.railway.app
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
DATABASE_URL=postgres://postgres:postgres@localhost:5432/team_task_manager
JWT_COOKIE_SECURE=False
JWT_COOKIE_SAMESITE=Lax
ACCESS_TOKEN_MINUTES=30
REFRESH_TOKEN_DAYS=7
```

Use `JWT_COOKIE_SECURE=True` in production.

## Demo Credentials

Create demo data with `python manage.py seed_demo`.

```text
Admin:  admin@taskmanager.dev  / AdminPass123!
Member: member@taskmanager.dev / MemberPass123!
```

## API Documentation

Auth:

- `POST /api/auth/register/`
- `POST /api/auth/login/`
- `POST /api/auth/logout/`
- `GET /api/auth/me/`
- `GET /api/auth/users/` Admin only
- `PUT /api/auth/users/{id}/role/` Admin only

Projects:

- `GET /api/projects/`
- `POST /api/projects/` Admin only
- `GET /api/projects/{id}/`
- `PATCH /api/projects/{id}/` Admin only
- `DELETE /api/projects/{id}/` Admin only
- `GET /api/projects/{id}/detail/`
- `POST /api/projects/{id}/members/` Admin only

Tasks:

- `GET /api/tasks/`
- `POST /api/tasks/` Admin only
- `GET /api/tasks/{id}/`
- `PATCH /api/tasks/{id}/` Admin all fields, Member status only for assigned tasks
- `DELETE /api/tasks/{id}/` Admin only

Dashboard:

- `GET /api/dashboard/`

## Railway Deployment

1. Push the repository to GitHub.
2. Create a Railway project from the repository.
3. Add a Railway PostgreSQL database.
4. Set environment variables from `.env.example`.
5. Ensure `DATABASE_URL` points to the Railway PostgreSQL service.
6. Deploy. `railway.json` builds the React app, installs Django dependencies, collects static files, and starts Gunicorn.

Production start command:

```bash
cd backend && python manage.py migrate --noinput && gunicorn config.wsgi:application --log-file -
```

After deploy, optionally run demo seeding from the Railway shell:

```bash
cd backend && python manage.py seed_demo
```

## Assessment Notes

- Users can choose Admin or Member during signup for assessment/demo workflows.
- Members can view assigned projects and update only their assigned task status.
- Admins can manage projects, task assignments, roles, and dashboard analytics.
- The React app stores auth in HttpOnly cookies, not local storage.
