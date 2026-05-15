from __future__ import annotations

import hashlib
import hmac
import json
import mimetypes
import os
import re
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse


BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
VOLUME_DIR = os.getenv("RAILWAY_VOLUME_MOUNT_PATH")
DEFAULT_DB_PATH = Path(VOLUME_DIR) / "team_task_manager.db" if VOLUME_DIR else BASE_DIR / "data" / "team_task_manager.db"
DB_PATH = Path(os.getenv("DATABASE_PATH", str(DEFAULT_DB_PATH)))
SESSION_DAYS = int(os.getenv("SESSION_DAYS", "7"))
COOKIE_NAME = "ttm_session"
PASSWORD_ITERATIONS = 260_000

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
PROJECT_STATUSES = {"planned", "active", "completed", "archived"}
TASK_STATUSES = {"todo", "in_progress", "done"}
PRIORITIES = {"low", "medium", "high"}


def now_utc() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)


def now_iso() -> str:
    return now_utc().isoformat()


def today_iso() -> str:
    return now_utc().date().isoformat()


def row_to_dict(row: sqlite3.Row | None) -> dict | None:
    return dict(row) if row else None


def get_db() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def query(sql: str, params: tuple = (), one: bool = False):
    with get_db() as conn:
        rows = conn.execute(sql, params).fetchall()
    if one:
        return rows[0] if rows else None
    return rows


def execute(sql: str, params: tuple = ()) -> int:
    with get_db() as conn:
        cur = conn.execute(sql, params)
        conn.commit()
        return cur.lastrowid


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PASSWORD_ITERATIONS)
    return f"pbkdf2_sha256${PASSWORD_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, iterations, salt_hex, digest_hex = stored.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        candidate = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            bytes.fromhex(salt_hex),
            int(iterations),
        ).hex()
        return hmac.compare_digest(candidate, digest_hex)
    except (ValueError, TypeError):
        return False


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def public_user(user: sqlite3.Row | dict | None) -> dict | None:
    if not user:
        return None
    return {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
        "created_at": user["created_at"],
    }


def validate_required_text(data: dict, field: str, label: str, *, min_len: int = 1, max_len: int = 160) -> str:
    value = str(data.get(field, "")).strip()
    if len(value) < min_len:
        raise ValueError(f"{label} is required.")
    if len(value) > max_len:
        raise ValueError(f"{label} must be {max_len} characters or fewer.")
    return value


def validate_optional_text(data: dict, field: str, label: str, *, max_len: int = 1000) -> str:
    value = str(data.get(field, "") or "").strip()
    if len(value) > max_len:
        raise ValueError(f"{label} must be {max_len} characters or fewer.")
    return value


def validate_date(value, label: str, *, required: bool = False) -> str | None:
    if value in (None, ""):
        if required:
            raise ValueError(f"{label} is required.")
        return None
    value = str(value).strip()
    if not DATE_RE.match(value):
        raise ValueError(f"{label} must use YYYY-MM-DD.")
    try:
        datetime.strptime(value, "%Y-%m-%d")
    except ValueError as exc:
        raise ValueError(f"{label} must be a valid calendar date.") from exc
    return value


def require_choice(data: dict, field: str, label: str, choices: set[str], default: str | None = None) -> str:
    value = data.get(field, default)
    if value is None:
        raise ValueError(f"{label} is required.")
    value = str(value).strip()
    if value not in choices:
        raise ValueError(f"{label} must be one of: {', '.join(sorted(choices))}.")
    return value


def init_db() -> None:
    with get_db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('admin', 'member')),
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                token_hash TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL CHECK(status IN ('planned', 'active', 'completed', 'archived')) DEFAULT 'active',
                due_date TEXT,
                owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS project_members (
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                joined_at TEXT NOT NULL,
                PRIMARY KEY (project_id, user_id)
            );

            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                status TEXT NOT NULL CHECK(status IN ('todo', 'in_progress', 'done')) DEFAULT 'todo',
                priority TEXT NOT NULL CHECK(priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
                due_date TEXT,
                created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
            CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
            CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
            CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
            CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
            """
        )
        conn.commit()


class ApiError(Exception):
    def __init__(self, status: int, message: str):
        self.status = status
        self.message = message
        super().__init__(message)


class TeamTaskHandler(BaseHTTPRequestHandler):
    server_version = "TeamTaskManager/1.0"

    def log_message(self, format: str, *args) -> None:
        print(f"{self.address_string()} - {format % args}")

    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header("Access-Control-Allow-Origin", self.headers.get("Origin", "*"))
        self.send_header("Access-Control-Allow-Credentials", "true")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
        self.end_headers()

    def do_GET(self) -> None:
        self.route("GET")

    def do_POST(self) -> None:
        self.route("POST")

    def do_PATCH(self) -> None:
        self.route("PATCH")

    def do_DELETE(self) -> None:
        self.route("DELETE")

    def route(self, method: str) -> None:
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            try:
                body = self.read_json() if method in {"POST", "PATCH", "DELETE"} else {}
                response = self.handle_api(method, parsed.path, parse_qs(parsed.query), body)
                if response is not None:
                    self.send_json(HTTPStatus.OK, response)
            except ApiError as exc:
                self.send_json(exc.status, {"error": exc.message})
            except ValueError as exc:
                self.send_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
            except sqlite3.IntegrityError as exc:
                message = "That record conflicts with existing data."
                if "users.email" in str(exc):
                    message = "An account with that email already exists."
                self.send_json(HTTPStatus.CONFLICT, {"error": message})
            except Exception as exc:
                print(f"Unhandled error: {exc}")
                self.send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "Something went wrong."})
            return

        self.serve_static(parsed.path)

    def read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0") or 0)
        if length <= 0:
            return {}
        if length > 1_000_000:
            raise ApiError(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, "Request body is too large.")
        raw = self.rfile.read(length)
        try:
            data = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError as exc:
            raise ValueError("Request body must be valid JSON.") from exc
        if not isinstance(data, dict):
            raise ValueError("Request body must be a JSON object.")
        return data

    def send_json(self, status: int, payload: dict | list, extra_headers: dict | None = None) -> None:
        encoded = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Cache-Control", "no-store")
        if extra_headers:
            for key, value in extra_headers.items():
                self.send_header(key, value)
        self.end_headers()
        self.wfile.write(encoded)

    def serve_static(self, path: str) -> None:
        if path in {"", "/"}:
            file_path = STATIC_DIR / "index.html"
        elif path.startswith("/static/"):
            relative = path.removeprefix("/static/")
            file_path = (STATIC_DIR / relative).resolve()
            if not str(file_path).startswith(str(STATIC_DIR.resolve())):
                self.send_error(HTTPStatus.NOT_FOUND)
                return
        else:
            file_path = STATIC_DIR / "index.html"

        if not file_path.exists() or not file_path.is_file():
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        content = file_path.read_bytes()
        mime_type = mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", mime_type)
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def handle_api(self, method: str, path: str, query_params: dict, body: dict):
        if path == "/api/health" and method == "GET":
            return {"ok": True, "database": str(DB_PATH)}

        if path == "/api/signup" and method == "POST":
            return self.signup(body)
        if path == "/api/login" and method == "POST":
            return self.login(body)
        if path == "/api/logout" and method == "POST":
            return self.logout()
        if path == "/api/me" and method == "GET":
            return {"user": public_user(self.current_user())}

        user = self.require_user()

        if path == "/api/dashboard" and method == "GET":
            return self.dashboard(user)
        if path == "/api/users" and method == "GET":
            return self.list_users(user)

        role_match = re.fullmatch(r"/api/users/(\d+)/role", path)
        if role_match and method == "PATCH":
            return self.update_role(user, int(role_match.group(1)), body)

        if path == "/api/projects" and method == "GET":
            return {"projects": self.projects_for_user(user)}
        if path == "/api/projects" and method == "POST":
            return self.create_project(user, body)

        project_match = re.fullmatch(r"/api/projects/(\d+)", path)
        if project_match:
            project_id = int(project_match.group(1))
            if method == "GET":
                return self.project_detail(user, project_id)
            if method == "PATCH":
                return self.update_project(user, project_id, body)
            if method == "DELETE":
                return self.delete_project(user, project_id)

        member_collection_match = re.fullmatch(r"/api/projects/(\d+)/members", path)
        if member_collection_match and method == "POST":
            return self.add_member(user, int(member_collection_match.group(1)), body)

        member_match = re.fullmatch(r"/api/projects/(\d+)/members/(\d+)", path)
        if member_match and method == "DELETE":
            return self.remove_member(user, int(member_match.group(1)), int(member_match.group(2)))

        if path == "/api/tasks" and method == "GET":
            project_id = None
            if "project_id" in query_params:
                project_id = int(query_params["project_id"][0])
            return {"tasks": self.tasks_for_user(user, project_id)}
        if path == "/api/tasks" and method == "POST":
            return self.create_task(user, body)

        task_match = re.fullmatch(r"/api/tasks/(\d+)", path)
        if task_match:
            task_id = int(task_match.group(1))
            if method == "PATCH":
                return self.update_task(user, task_id, body)
            if method == "DELETE":
                return self.delete_task(user, task_id)

        raise ApiError(HTTPStatus.NOT_FOUND, "API route not found.")

    def current_user(self) -> sqlite3.Row | None:
        cookie_header = self.headers.get("Cookie", "")
        cookie = SimpleCookie(cookie_header)
        morsel = cookie.get(COOKIE_NAME)
        if not morsel:
            return None
        hashed = token_hash(morsel.value)
        user = query(
            """
            SELECT users.*
            FROM sessions
            JOIN users ON users.id = sessions.user_id
            WHERE sessions.token_hash = ? AND sessions.expires_at > ?
            """,
            (hashed, now_iso()),
            one=True,
        )
        return user

    def require_user(self) -> sqlite3.Row:
        user = self.current_user()
        if not user:
            raise ApiError(HTTPStatus.UNAUTHORIZED, "Please log in.")
        return user

    def require_admin(self, user: sqlite3.Row) -> None:
        if user["role"] != "admin":
            raise ApiError(HTTPStatus.FORBIDDEN, "Admin access required.")

    def issue_session(self, user_id: int) -> tuple[str, str]:
        token = secrets.token_urlsafe(32)
        expires = now_utc() + timedelta(days=SESSION_DAYS)
        execute(
            "INSERT INTO sessions (user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?)",
            (user_id, token_hash(token), now_iso(), expires.replace(microsecond=0).isoformat()),
        )
        cookie = SimpleCookie()
        cookie[COOKIE_NAME] = token
        cookie[COOKIE_NAME]["httponly"] = True
        cookie[COOKIE_NAME]["path"] = "/"
        cookie[COOKIE_NAME]["samesite"] = "Lax"
        cookie[COOKIE_NAME]["max-age"] = str(SESSION_DAYS * 24 * 60 * 60)
        if os.getenv("COOKIE_SECURE", "").lower() in {"1", "true", "yes"}:
            cookie[COOKIE_NAME]["secure"] = True
        return token, cookie.output(header="").strip()

    def clear_session_cookie(self) -> str:
        cookie = SimpleCookie()
        cookie[COOKIE_NAME] = ""
        cookie[COOKIE_NAME]["httponly"] = True
        cookie[COOKIE_NAME]["path"] = "/"
        cookie[COOKIE_NAME]["samesite"] = "Lax"
        cookie[COOKIE_NAME]["max-age"] = "0"
        return cookie.output(header="").strip()

    def signup(self, data: dict):
        name = validate_required_text(data, "name", "Name", min_len=2, max_len=80)
        email = validate_required_text(data, "email", "Email", max_len=120).lower()
        password = str(data.get("password", ""))
        if not EMAIL_RE.match(email):
            raise ValueError("Email must be valid.")
        if len(password) < 8:
            raise ValueError("Password must be at least 8 characters.")

        user_count = query("SELECT COUNT(*) AS count FROM users", one=True)["count"]
        role = "admin" if user_count == 0 else "member"
        user_id = execute(
            "INSERT INTO users (name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)",
            (name, email, hash_password(password), role, now_iso()),
        )
        user = query("SELECT * FROM users WHERE id = ?", (user_id,), one=True)
        _token, cookie = self.issue_session(user_id)
        self.send_json(HTTPStatus.CREATED, {"user": public_user(user)}, {"Set-Cookie": cookie})
        return None

    def login(self, data: dict):
        email = validate_required_text(data, "email", "Email", max_len=120).lower()
        password = str(data.get("password", ""))
        user = query("SELECT * FROM users WHERE email = ?", (email,), one=True)
        if not user or not verify_password(password, user["password_hash"]):
            raise ApiError(HTTPStatus.UNAUTHORIZED, "Invalid email or password.")
        _token, cookie = self.issue_session(user["id"])
        self.send_json(HTTPStatus.OK, {"user": public_user(user)}, {"Set-Cookie": cookie})
        return None

    def logout(self):
        cookie_header = self.headers.get("Cookie", "")
        cookie = SimpleCookie(cookie_header)
        morsel = cookie.get(COOKIE_NAME)
        if morsel:
            execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash(morsel.value),))
        self.send_json(HTTPStatus.OK, {"ok": True}, {"Set-Cookie": self.clear_session_cookie()})
        return None

    def list_users(self, user: sqlite3.Row):
        users = query("SELECT id, name, email, role, created_at FROM users ORDER BY name COLLATE NOCASE")
        return {"users": [dict(row) for row in users], "current_user_id": user["id"]}

    def update_role(self, user: sqlite3.Row, target_id: int, data: dict):
        self.require_admin(user)
        role = require_choice(data, "role", "Role", {"admin", "member"})
        target = query("SELECT * FROM users WHERE id = ?", (target_id,), one=True)
        if not target:
            raise ApiError(HTTPStatus.NOT_FOUND, "User not found.")
        if target["role"] == "admin" and role != "admin":
            admin_count = query("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'", one=True)["count"]
            if admin_count <= 1:
                raise ApiError(HTTPStatus.BAD_REQUEST, "At least one admin is required.")
        execute("UPDATE users SET role = ? WHERE id = ?", (role, target_id))
        updated = query("SELECT * FROM users WHERE id = ?", (target_id,), one=True)
        return {"user": public_user(updated)}

    def project_row(self, project_id: int) -> sqlite3.Row | None:
        return query(
            """
            SELECT projects.*, users.name AS owner_name
            FROM projects
            JOIN users ON users.id = projects.owner_id
            WHERE projects.id = ?
            """,
            (project_id,),
            one=True,
        )

    def user_can_view_project(self, user: sqlite3.Row, project_id: int) -> bool:
        if user["role"] == "admin":
            return True
        membership = query(
            "SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?",
            (project_id, user["id"]),
            one=True,
        )
        return bool(membership)

    def projects_for_user(self, user: sqlite3.Row) -> list[dict]:
        params: tuple = ()
        membership_filter = ""
        if user["role"] != "admin":
            membership_filter = "JOIN project_members pm ON pm.project_id = projects.id AND pm.user_id = ?"
            params = (user["id"],)
        rows = query(
            f"""
            SELECT
                projects.*,
                owners.name AS owner_name,
                COUNT(DISTINCT tasks.id) AS task_count,
                COALESCE(SUM(CASE WHEN tasks.status = 'done' THEN 1 ELSE 0 END), 0) AS done_count,
                COUNT(DISTINCT project_members.user_id) AS member_count
            FROM projects
            {membership_filter}
            JOIN users owners ON owners.id = projects.owner_id
            LEFT JOIN tasks ON tasks.project_id = projects.id
            LEFT JOIN project_members ON project_members.project_id = projects.id
            GROUP BY projects.id
            ORDER BY projects.updated_at DESC, projects.created_at DESC
            """,
            params,
        )
        return [dict(row) for row in rows]

    def project_detail(self, user: sqlite3.Row, project_id: int):
        project = self.project_row(project_id)
        if not project:
            raise ApiError(HTTPStatus.NOT_FOUND, "Project not found.")
        if not self.user_can_view_project(user, project_id):
            raise ApiError(HTTPStatus.FORBIDDEN, "You do not have access to this project.")
        members = query(
            """
            SELECT users.id, users.name, users.email, users.role, project_members.joined_at
            FROM project_members
            JOIN users ON users.id = project_members.user_id
            WHERE project_members.project_id = ?
            ORDER BY users.name COLLATE NOCASE
            """,
            (project_id,),
        )
        tasks = self.tasks_for_user(user, project_id)
        return {"project": dict(project), "members": [dict(row) for row in members], "tasks": tasks}

    def create_project(self, user: sqlite3.Row, data: dict):
        self.require_admin(user)
        name = validate_required_text(data, "name", "Project name", min_len=2, max_len=120)
        description = validate_optional_text(data, "description", "Project description", max_len=1000)
        status = require_choice(data, "status", "Project status", PROJECT_STATUSES, "active")
        due_date = validate_date(data.get("due_date"), "Project due date")
        created = now_iso()
        with get_db() as conn:
            cur = conn.execute(
                """
                INSERT INTO projects (name, description, status, due_date, owner_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (name, description, status, due_date, user["id"], created, created),
            )
            project_id = cur.lastrowid
            conn.execute(
                "INSERT INTO project_members (project_id, user_id, joined_at) VALUES (?, ?, ?)",
                (project_id, user["id"], created),
            )
            conn.commit()
        return {"project": dict(self.project_row(project_id))}

    def update_project(self, user: sqlite3.Row, project_id: int, data: dict):
        self.require_admin(user)
        if not self.project_row(project_id):
            raise ApiError(HTTPStatus.NOT_FOUND, "Project not found.")
        updates = []
        params = []
        if "name" in data:
            updates.append("name = ?")
            params.append(validate_required_text(data, "name", "Project name", min_len=2, max_len=120))
        if "description" in data:
            updates.append("description = ?")
            params.append(validate_optional_text(data, "description", "Project description", max_len=1000))
        if "status" in data:
            updates.append("status = ?")
            params.append(require_choice(data, "status", "Project status", PROJECT_STATUSES))
        if "due_date" in data:
            updates.append("due_date = ?")
            params.append(validate_date(data.get("due_date"), "Project due date"))
        if updates:
            updates.append("updated_at = ?")
            params.append(now_iso())
            params.append(project_id)
            execute(f"UPDATE projects SET {', '.join(updates)} WHERE id = ?", tuple(params))
        return {"project": dict(self.project_row(project_id))}

    def delete_project(self, user: sqlite3.Row, project_id: int):
        self.require_admin(user)
        if not self.project_row(project_id):
            raise ApiError(HTTPStatus.NOT_FOUND, "Project not found.")
        execute("DELETE FROM projects WHERE id = ?", (project_id,))
        return {"ok": True}

    def add_member(self, user: sqlite3.Row, project_id: int, data: dict):
        self.require_admin(user)
        if not self.project_row(project_id):
            raise ApiError(HTTPStatus.NOT_FOUND, "Project not found.")
        try:
            user_id = int(data.get("user_id"))
        except (TypeError, ValueError) as exc:
            raise ValueError("User is required.") from exc
        if not query("SELECT id FROM users WHERE id = ?", (user_id,), one=True):
            raise ApiError(HTTPStatus.NOT_FOUND, "User not found.")
        execute(
            """
            INSERT OR IGNORE INTO project_members (project_id, user_id, joined_at)
            VALUES (?, ?, ?)
            """,
            (project_id, user_id, now_iso()),
        )
        return self.project_detail(user, project_id)

    def remove_member(self, user: sqlite3.Row, project_id: int, user_id: int):
        self.require_admin(user)
        project = self.project_row(project_id)
        if not project:
            raise ApiError(HTTPStatus.NOT_FOUND, "Project not found.")
        if project["owner_id"] == user_id:
            raise ApiError(HTTPStatus.BAD_REQUEST, "Project owner cannot be removed.")
        assigned = query(
            "SELECT COUNT(*) AS count FROM tasks WHERE project_id = ? AND assignee_id = ? AND status != 'done'",
            (project_id, user_id),
            one=True,
        )["count"]
        if assigned:
            raise ApiError(HTTPStatus.BAD_REQUEST, "Reassign or complete this member's open tasks first.")
        execute("DELETE FROM project_members WHERE project_id = ? AND user_id = ?", (project_id, user_id))
        return self.project_detail(user, project_id)

    def task_row(self, task_id: int) -> sqlite3.Row | None:
        return query(
            """
            SELECT
                tasks.*,
                projects.name AS project_name,
                assignees.name AS assignee_name,
                assignees.email AS assignee_email,
                creators.name AS creator_name
            FROM tasks
            JOIN projects ON projects.id = tasks.project_id
            LEFT JOIN users assignees ON assignees.id = tasks.assignee_id
            JOIN users creators ON creators.id = tasks.created_by
            WHERE tasks.id = ?
            """,
            (task_id,),
            one=True,
        )

    def tasks_for_user(self, user: sqlite3.Row, project_id: int | None = None) -> list[dict]:
        params: list = []
        project_clause = ""
        if project_id is not None:
            project_clause = "AND tasks.project_id = ?"
            params.append(project_id)
            if not self.user_can_view_project(user, project_id):
                raise ApiError(HTTPStatus.FORBIDDEN, "You do not have access to this project.")

        if user["role"] == "admin":
            sql = f"""
                SELECT tasks.*, projects.name AS project_name, assignees.name AS assignee_name,
                       assignees.email AS assignee_email, creators.name AS creator_name
                FROM tasks
                JOIN projects ON projects.id = tasks.project_id
                LEFT JOIN users assignees ON assignees.id = tasks.assignee_id
                JOIN users creators ON creators.id = tasks.created_by
                WHERE 1 = 1 {project_clause}
                ORDER BY COALESCE(tasks.due_date, '9999-12-31'), tasks.priority DESC, tasks.updated_at DESC
            """
            rows = query(sql, tuple(params))
        else:
            sql = f"""
                SELECT tasks.*, projects.name AS project_name, assignees.name AS assignee_name,
                       assignees.email AS assignee_email, creators.name AS creator_name
                FROM tasks
                JOIN projects ON projects.id = tasks.project_id
                JOIN project_members pm ON pm.project_id = projects.id AND pm.user_id = ?
                LEFT JOIN users assignees ON assignees.id = tasks.assignee_id
                JOIN users creators ON creators.id = tasks.created_by
                WHERE 1 = 1 {project_clause}
                ORDER BY COALESCE(tasks.due_date, '9999-12-31'), tasks.priority DESC, tasks.updated_at DESC
            """
            rows = query(sql, tuple([user["id"], *params]))
        return [dict(row) for row in rows]

    def validate_project_membership(self, project_id: int, assignee_id: int | None) -> None:
        if assignee_id is None:
            return
        membership = query(
            "SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?",
            (project_id, assignee_id),
            one=True,
        )
        if not membership:
            raise ApiError(HTTPStatus.BAD_REQUEST, "Assignee must be a member of the project.")

    def parse_optional_user_id(self, data: dict, field: str = "assignee_id") -> int | None:
        raw = data.get(field)
        if raw in (None, ""):
            return None
        try:
            user_id = int(raw)
        except (TypeError, ValueError) as exc:
            raise ValueError("Assignee must be a valid user.") from exc
        if not query("SELECT id FROM users WHERE id = ?", (user_id,), one=True):
            raise ApiError(HTTPStatus.NOT_FOUND, "Assignee not found.")
        return user_id

    def create_task(self, user: sqlite3.Row, data: dict):
        self.require_admin(user)
        try:
            project_id = int(data.get("project_id"))
        except (TypeError, ValueError) as exc:
            raise ValueError("Project is required.") from exc
        if not self.project_row(project_id):
            raise ApiError(HTTPStatus.NOT_FOUND, "Project not found.")
        title = validate_required_text(data, "title", "Task title", min_len=2, max_len=160)
        description = validate_optional_text(data, "description", "Task description", max_len=1000)
        assignee_id = self.parse_optional_user_id(data)
        self.validate_project_membership(project_id, assignee_id)
        status = require_choice(data, "status", "Task status", TASK_STATUSES, "todo")
        priority = require_choice(data, "priority", "Task priority", PRIORITIES, "medium")
        due_date = validate_date(data.get("due_date"), "Task due date")
        created = now_iso()
        task_id = execute(
            """
            INSERT INTO tasks (project_id, title, description, assignee_id, status, priority, due_date, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (project_id, title, description, assignee_id, status, priority, due_date, user["id"], created, created),
        )
        execute("UPDATE projects SET updated_at = ? WHERE id = ?", (now_iso(), project_id))
        return {"task": dict(self.task_row(task_id))}

    def update_task(self, user: sqlite3.Row, task_id: int, data: dict):
        task = self.task_row(task_id)
        if not task:
            raise ApiError(HTTPStatus.NOT_FOUND, "Task not found.")
        if user["role"] != "admin":
            if task["assignee_id"] != user["id"]:
                raise ApiError(HTTPStatus.FORBIDDEN, "You can only update your assigned tasks.")
            if set(data.keys()) != {"status"}:
                raise ApiError(HTTPStatus.FORBIDDEN, "Members can update task status only.")
            status = require_choice(data, "status", "Task status", TASK_STATUSES)
            execute(
                "UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?",
                (status, now_iso(), task_id),
            )
            execute("UPDATE projects SET updated_at = ? WHERE id = ?", (now_iso(), task["project_id"]))
            return {"task": dict(self.task_row(task_id))}

        updates = []
        params = []
        project_id = task["project_id"]
        if "title" in data:
            updates.append("title = ?")
            params.append(validate_required_text(data, "title", "Task title", min_len=2, max_len=160))
        if "description" in data:
            updates.append("description = ?")
            params.append(validate_optional_text(data, "description", "Task description", max_len=1000))
        if "assignee_id" in data:
            assignee_id = self.parse_optional_user_id(data)
            self.validate_project_membership(project_id, assignee_id)
            updates.append("assignee_id = ?")
            params.append(assignee_id)
        if "status" in data:
            updates.append("status = ?")
            params.append(require_choice(data, "status", "Task status", TASK_STATUSES))
        if "priority" in data:
            updates.append("priority = ?")
            params.append(require_choice(data, "priority", "Task priority", PRIORITIES))
        if "due_date" in data:
            updates.append("due_date = ?")
            params.append(validate_date(data.get("due_date"), "Task due date"))
        if updates:
            updates.append("updated_at = ?")
            params.append(now_iso())
            params.append(task_id)
            execute(f"UPDATE tasks SET {', '.join(updates)} WHERE id = ?", tuple(params))
            execute("UPDATE projects SET updated_at = ? WHERE id = ?", (now_iso(), project_id))
        return {"task": dict(self.task_row(task_id))}

    def delete_task(self, user: sqlite3.Row, task_id: int):
        self.require_admin(user)
        task = self.task_row(task_id)
        if not task:
            raise ApiError(HTTPStatus.NOT_FOUND, "Task not found.")
        execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        execute("UPDATE projects SET updated_at = ? WHERE id = ?", (now_iso(), task["project_id"]))
        return {"ok": True}

    def dashboard(self, user: sqlite3.Row):
        projects = self.projects_for_user(user)
        tasks = self.tasks_for_user(user)
        today = today_iso()
        status_counts = {status: 0 for status in TASK_STATUSES}
        priority_counts = {priority: 0 for priority in PRIORITIES}
        overdue = []
        due_soon = []
        assigned_to_me = 0
        completed = 0

        for task in tasks:
            status_counts[task["status"]] += 1
            priority_counts[task["priority"]] += 1
            if task["assignee_id"] == user["id"]:
                assigned_to_me += 1
            if task["status"] == "done":
                completed += 1
            if task["due_date"] and task["status"] != "done":
                if task["due_date"] < today:
                    overdue.append(task)
                else:
                    due_date = datetime.strptime(task["due_date"], "%Y-%m-%d").date()
                    if due_date <= now_utc().date() + timedelta(days=7):
                        due_soon.append(task)

        total = len(tasks)
        completion_rate = round((completed / total) * 100) if total else 0
        active_projects = sum(1 for project in projects if project["status"] == "active")
        return {
            "summary": {
                "projects": len(projects),
                "active_projects": active_projects,
                "tasks": total,
                "assigned_to_me": assigned_to_me,
                "overdue": len(overdue),
                "completion_rate": completion_rate,
            },
            "status_counts": status_counts,
            "priority_counts": priority_counts,
            "overdue_tasks": overdue[:8],
            "due_soon": due_soon[:8],
            "projects": projects[:6],
        }


def run() -> None:
    init_db()
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    server = ThreadingHTTPServer((host, port), TeamTaskHandler)
    print(f"Team Task Manager running on http://{host}:{port}")
    print(f"SQLite database: {DB_PATH}")
    server.serve_forever()


if __name__ == "__main__":
    run()
