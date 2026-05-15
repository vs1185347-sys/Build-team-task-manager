const state = {
  loading: true,
  authMode: "login",
  user: null,
  view: "dashboard",
  dashboard: null,
  projects: [],
  tasks: [],
  users: [],
  selectedProjectId: null,
  projectDetail: null,
};

const statusLabels = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

const projectStatusLabels = {
  planned: "Planned",
  active: "Active",
  completed: "Completed",
  archived: "Archived",
};

const priorityLabels = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const viewLabels = {
  dashboard: ["Dashboard", "Live task load, deadlines, and progress"],
  projects: ["Projects", "Project workspace, team roster, and assigned tasks"],
  tasks: ["Tasks", "Status tracking across active work"],
  team: ["Team", "Members and access levels"],
};

const app = document.querySelector("#app");
const toastEl = document.querySelector("#toast");

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(`${value}T00:00:00`),
  );
}

function isOverdue(task) {
  return task.due_date && task.status !== "done" && task.due_date < todayIso();
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toastEl.classList.remove("show"), 2600);
}

async function api(path, { method = "GET", body } = {}) {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }
  return data;
}

async function bootstrap() {
  try {
    const session = await api("/api/me");
    state.user = session.user;
    if (state.user) {
      await refreshAll();
    }
  } catch (error) {
    showToast(error.message);
  } finally {
    state.loading = false;
    render();
  }
}

async function refreshAll() {
  const [dashboard, projects, tasks, users] = await Promise.all([
    api("/api/dashboard"),
    api("/api/projects"),
    api("/api/tasks"),
    api("/api/users"),
  ]);
  state.dashboard = dashboard;
  state.projects = projects.projects || [];
  state.tasks = tasks.tasks || [];
  state.users = users.users || [];

  if (state.projects.length) {
    const selectedExists = state.projects.some((project) => project.id === state.selectedProjectId);
    if (!selectedExists) state.selectedProjectId = state.projects[0].id;
    await loadProjectDetail(state.selectedProjectId);
  } else {
    state.selectedProjectId = null;
    state.projectDetail = null;
  }
}

async function loadProjectDetail(projectId) {
  if (!projectId) {
    state.projectDetail = null;
    return;
  }
  state.projectDetail = await api(`/api/projects/${projectId}`);
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function optionList(items, selectedValue = "", includeBlank = false, blankLabel = "Unassigned") {
  const blank = includeBlank ? `<option value="">${escapeHtml(blankLabel)}</option>` : "";
  return (
    blank +
    items
      .map((item) => {
        const value = String(item.value);
        const selected = String(selectedValue ?? "") === value ? " selected" : "";
        return `<option value="${escapeHtml(value)}"${selected}>${escapeHtml(item.label)}</option>`;
      })
      .join("")
  );
}

function statusOptions(selected) {
  return optionList(
    Object.entries(statusLabels).map(([value, label]) => ({ value, label })),
    selected,
  );
}

function projectStatusOptions(selected) {
  return optionList(
    Object.entries(projectStatusLabels).map(([value, label]) => ({ value, label })),
    selected,
  );
}

function priorityOptions(selected) {
  return optionList(
    Object.entries(priorityLabels).map(([value, label]) => ({ value, label })),
    selected,
  );
}

function userOptions(users, selected, includeBlank = false) {
  return optionList(
    users.map((user) => ({ value: user.id, label: `${user.name} (${user.role})` })),
    selected,
    includeBlank,
  );
}

function completion(project) {
  if (!project.task_count) return 0;
  return Math.round((project.done_count / project.task_count) * 100);
}

function render() {
  if (state.loading) {
    app.innerHTML = `<div class="loading">Loading workspace...</div>`;
    return;
  }

  if (!state.user) {
    app.innerHTML = renderAuth();
    return;
  }

  const [title, subtitle] = viewLabels[state.view] || viewLabels.dashboard;
  app.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="sidebar-brand">
          <div class="brand-mark">TT</div>
          <div>
            Team Task
            <small>${state.user.role === "admin" ? "Admin Console" : "Member Workspace"}</small>
          </div>
        </div>
        <nav class="nav">
          ${navButton("dashboard", "Dashboard")}
          ${navButton("projects", "Projects")}
          ${navButton("tasks", "Tasks")}
          ${navButton("team", "Team")}
        </nav>
        <div class="account-box">
          <div>
            <div class="account-name">${escapeHtml(state.user.name)}</div>
            <div class="account-meta">${escapeHtml(state.user.email)}</div>
          </div>
          <button class="btn secondary inline" type="button" data-action="logout">Logout</button>
        </div>
      </aside>
      <main class="main">
        <div class="topbar">
          <div class="page-title">
            <h1>${escapeHtml(title)}</h1>
            <p>${escapeHtml(subtitle)}</p>
          </div>
          <div class="toolbar">
            <button class="btn secondary" type="button" data-action="refresh">Refresh</button>
          </div>
        </div>
        ${renderView()}
      </main>
    </div>
  `;
}

function navButton(view, label) {
  const active = state.view === view ? " active" : "";
  return `<button class="nav-link${active}" type="button" data-action="nav" data-view="${view}">${escapeHtml(label)}</button>`;
}

function renderAuth() {
  const isSignup = state.authMode === "signup";
  return `
    <main class="auth-page">
      <section class="auth-panel">
        <div class="brand-block">
          <div class="brand-mark">TT</div>
          <h1>Team Task Manager</h1>
          <p>${isSignup ? "First account becomes Admin." : "Sign in to manage projects and tasks."}</p>
        </div>
        <div class="segmented" role="tablist" aria-label="Authentication">
          <button type="button" class="${state.authMode === "login" ? "active" : ""}" data-action="auth-mode" data-mode="login">Login</button>
          <button type="button" class="${isSignup ? "active" : ""}" data-action="auth-mode" data-mode="signup">Signup</button>
        </div>
        <form class="form-grid" data-form="${isSignup ? "signup" : "login"}">
          ${isSignup ? `
            <label class="field">
              <span>Name</span>
              <input name="name" autocomplete="name" minlength="2" maxlength="80" required>
            </label>
          ` : ""}
          <label class="field">
            <span>Email</span>
            <input type="text" name="email" inputmode="email" autocomplete="email" maxlength="120" required>
          </label>
          <label class="field">
            <span>Password</span>
            <input type="password" name="password" autocomplete="${isSignup ? "new-password" : "current-password"}" minlength="8" required>
          </label>
          <button class="btn" type="submit">${isSignup ? "Create account" : "Login"}</button>
        </form>
      </section>
    </main>
  `;
}

function renderView() {
  if (state.view === "projects") return renderProjects();
  if (state.view === "tasks") return renderTasks();
  if (state.view === "team") return renderTeam();
  return renderDashboard();
}

function renderDashboard() {
  const dashboard = state.dashboard || { summary: {}, status_counts: {}, overdue_tasks: [], due_soon: [], projects: [] };
  const summary = dashboard.summary || {};
  return `
    <section class="grid three">
      ${statCard("Projects", summary.projects || 0, "teal")}
      ${statCard("Tasks", summary.tasks || 0, "blue")}
      ${statCard("Overdue", summary.overdue || 0, "red")}
    </section>
    <section class="grid two">
      <div class="panel">
        <div class="panel-title">
          <h2>Status</h2>
          <span class="chip done">${summary.completion_rate || 0}% complete</span>
        </div>
        ${renderStatusBars(dashboard.status_counts || {})}
      </div>
      <div class="panel">
        <div class="panel-title">
          <h2>Due Soon</h2>
          <span class="chip amber">${summary.assigned_to_me || 0} mine</span>
        </div>
        ${renderMiniTaskList([...(dashboard.overdue_tasks || []), ...(dashboard.due_soon || [])])}
      </div>
    </section>
    <section class="panel">
      <div class="panel-title">
        <h2>Active Projects</h2>
        <button class="btn secondary inline" type="button" data-action="nav" data-view="projects">Open projects</button>
      </div>
      ${dashboard.projects?.length ? `<div class="list">${dashboard.projects.map(renderProjectSummary).join("")}</div>` : emptyState("No projects yet.")}
    </section>
  `;
}

function statCard(label, value, color) {
  return `
    <article class="stat-card ${color}">
      <h3>${escapeHtml(label)}</h3>
      <div class="stat-value">${escapeHtml(value)}</div>
    </article>
  `;
}

function renderStatusBars(counts) {
  const total = Object.values(counts).reduce((sum, count) => sum + Number(count || 0), 0) || 1;
  return `
    <div class="status-bars">
      ${Object.entries(statusLabels)
        .map(([status, label]) => {
          const count = Number(counts[status] || 0);
          const width = Math.round((count / total) * 100);
          return `
            <div class="bar-row">
              <span class="small">${escapeHtml(label)}</span>
              <div class="progress"><span style="width:${width}%"></span></div>
              <strong>${count}</strong>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderMiniTaskList(tasks) {
  const unique = tasks.filter((task, index, all) => all.findIndex((item) => item.id === task.id) === index).slice(0, 6);
  if (!unique.length) return emptyState("No urgent tasks.");
  return `
    <div class="list">
      ${unique
        .map(
          (task) => `
            <article class="item-card">
              <div class="item-head">
                <div>
                  <h3>${escapeHtml(task.title)}</h3>
                  <div class="small muted">${escapeHtml(task.project_name || "Project")} · ${escapeHtml(task.assignee_name || "Unassigned")}</div>
                </div>
                ${dueChip(task)}
              </div>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderProjectSummary(project) {
  const percent = completion(project);
  return `
    <article class="item-card selectable" data-action="select-project" data-project-id="${project.id}">
      <div class="item-head">
        <div>
          <h3>${escapeHtml(project.name)}</h3>
          <div class="small muted">${escapeHtml(project.owner_name)} · ${project.member_count} members</div>
        </div>
        <span class="chip ${project.status}">${escapeHtml(projectStatusLabels[project.status] || project.status)}</span>
      </div>
      <div class="progress" aria-label="${percent}% complete"><span style="width:${percent}%"></span></div>
      <div class="small muted">${project.done_count}/${project.task_count} tasks complete</div>
    </article>
  `;
}

function renderProjects() {
  const detail = state.projectDetail;
  const selectedId = state.selectedProjectId;
  return `
    <section class="grid two">
      <div class="stack">
        ${state.user.role === "admin" ? renderProjectCreateForm() : ""}
        <div class="panel">
          <div class="panel-title"><h2>Project List</h2><span class="chip">${state.projects.length}</span></div>
          ${
            state.projects.length
              ? `<div class="list">${state.projects
                  .map((project) => {
                    const active = project.id === selectedId ? " active" : "";
                    const percent = completion(project);
                    return `
                      <button class="item-card selectable${active}" type="button" data-action="select-project" data-project-id="${project.id}">
                        <div class="item-head">
                          <div>
                            <h3>${escapeHtml(project.name)}</h3>
                            <div class="small muted">${project.task_count} tasks · ${project.member_count} members</div>
                          </div>
                          <span class="chip ${project.status}">${escapeHtml(projectStatusLabels[project.status] || project.status)}</span>
                        </div>
                        <div class="progress"><span style="width:${percent}%"></span></div>
                      </button>
                    `;
                  })
                  .join("")}</div>`
              : emptyState("No projects yet.")
          }
        </div>
      </div>
      <div class="stack">
        ${detail ? renderProjectDetail(detail) : emptyState("Select a project.")}
      </div>
    </section>
  `;
}

function renderProjectCreateForm() {
  return `
    <div class="panel">
      <div class="panel-title"><h2>New Project</h2></div>
      <form class="form-grid" data-form="project-create">
        <label class="field">
          <span>Name</span>
          <input name="name" minlength="2" maxlength="120" required>
        </label>
        <label class="field">
          <span>Description</span>
          <textarea name="description" maxlength="1000"></textarea>
        </label>
        <div class="inline-fields">
          <label class="field">
            <span>Status</span>
            <select name="status">${projectStatusOptions("active")}</select>
          </label>
          <label class="field">
            <span>Due date</span>
            <input type="date" name="due_date">
          </label>
        </div>
        <button class="btn" type="submit">Create project</button>
      </form>
    </div>
  `;
}

function renderProjectDetail(detail) {
  const project = detail.project;
  return `
    <div class="panel">
      <div class="panel-title">
        <h2>${escapeHtml(project.name)}</h2>
        <span class="chip ${project.status}">${escapeHtml(projectStatusLabels[project.status] || project.status)}</span>
      </div>
      ${state.user.role === "admin" ? renderProjectUpdateForm(project) : renderProjectReadOnly(project)}
    </div>
    <div class="panel">
      <div class="panel-title"><h3>Members</h3><span class="chip">${detail.members.length}</span></div>
      ${renderMembers(detail)}
    </div>
    <div class="panel">
      <div class="panel-title"><h3>Project Tasks</h3><span class="chip">${detail.tasks.length}</span></div>
      ${state.user.role === "admin" ? renderTaskCreateForm(project, detail.members) : ""}
      ${detail.tasks.length ? `<div class="task-grid">${detail.tasks.map((task) => renderTaskCard(task, detail.members, false)).join("")}</div>` : emptyState("No tasks in this project.")}
    </div>
  `;
}

function renderProjectReadOnly(project) {
  return `
    <div class="stack">
      <p class="muted">${escapeHtml(project.description || "No description.")}</p>
      <div class="chips">
        <span class="chip">Owner: ${escapeHtml(project.owner_name)}</span>
        <span class="chip">Due: ${formatDate(project.due_date)}</span>
      </div>
    </div>
  `;
}

function renderProjectUpdateForm(project) {
  return `
    <form class="form-grid" data-form="project-update" data-project-id="${project.id}">
      <label class="field">
        <span>Name</span>
        <input name="name" minlength="2" maxlength="120" value="${escapeHtml(project.name)}" required>
      </label>
      <label class="field">
        <span>Description</span>
        <textarea name="description" maxlength="1000">${escapeHtml(project.description || "")}</textarea>
      </label>
      <div class="inline-fields">
        <label class="field">
          <span>Status</span>
          <select name="status">${projectStatusOptions(project.status)}</select>
        </label>
        <label class="field">
          <span>Due date</span>
          <input type="date" name="due_date" value="${escapeHtml(project.due_date || "")}">
        </label>
      </div>
      <div class="toolbar">
        <button class="btn" type="submit">Save project</button>
        <button class="btn danger" type="button" data-action="delete-project" data-project-id="${project.id}">Delete project</button>
      </div>
    </form>
  `;
}

function renderMembers(detail) {
  const memberIds = new Set(detail.members.map((member) => member.id));
  const available = state.users.filter((user) => !memberIds.has(user.id));
  return `
    <div class="stack">
      ${state.user.role === "admin" && available.length ? `
        <form class="inline-fields" data-form="member-add" data-project-id="${detail.project.id}">
          <label class="field">
            <span>Add member</span>
            <select name="user_id" required>${userOptions(available)}</select>
          </label>
          <button class="btn" type="submit">Add</button>
        </form>
      ` : ""}
      <div class="list">
        ${detail.members
          .map(
            (member) => `
              <article class="item-card">
                <div class="row-between">
                  <div>
                    <strong>${escapeHtml(member.name)}</strong>
                    <div class="small muted">${escapeHtml(member.email)}</div>
                  </div>
                  <div class="chips">
                    <span class="chip">${escapeHtml(member.role)}</span>
                    ${
                      state.user.role === "admin" && member.id !== detail.project.owner_id
                        ? `<button class="btn danger inline" type="button" data-action="remove-member" data-project-id="${detail.project.id}" data-user-id="${member.id}">Remove</button>`
                        : ""
                    }
                  </div>
                </div>
              </article>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderTaskCreateForm(project, members) {
  return `
    <form class="form-grid" data-form="task-create" data-project-id="${project.id}">
      <input type="hidden" name="project_id" value="${project.id}">
      <label class="field">
        <span>Task</span>
        <input name="title" minlength="2" maxlength="160" required>
      </label>
      <label class="field">
        <span>Description</span>
        <textarea name="description" maxlength="1000"></textarea>
      </label>
      <div class="inline-fields">
        <label class="field">
          <span>Assignee</span>
          <select name="assignee_id">${userOptions(members, "", true)}</select>
        </label>
        <label class="field">
          <span>Priority</span>
          <select name="priority">${priorityOptions("medium")}</select>
        </label>
      </div>
      <div class="inline-fields">
        <label class="field">
          <span>Status</span>
          <select name="status">${statusOptions("todo")}</select>
        </label>
        <label class="field">
          <span>Due date</span>
          <input type="date" name="due_date">
        </label>
      </div>
      <button class="btn" type="submit">Create task</button>
    </form>
  `;
}

function renderTaskCard(task, projectMembers = null, showProject = true) {
  const canStatus = state.user.role === "admin" || task.assignee_id === state.user.id;
  const canAssign = state.user.role === "admin" && Array.isArray(projectMembers);
  const memberOptions = canAssign ? userOptions(projectMembers, task.assignee_id || "", true) : "";
  return `
    <article class="task-card">
      <div class="item-head">
        <div class="task-title">
          <strong>${escapeHtml(task.title)}</strong>
          <div class="small muted">
            ${showProject ? `${escapeHtml(task.project_name || "Project")} · ` : ""}
            ${escapeHtml(task.assignee_name || "Unassigned")}
          </div>
        </div>
        <div class="chips">
          <span class="chip ${task.status}">${escapeHtml(statusLabels[task.status] || task.status)}</span>
          <span class="chip ${task.priority}">${escapeHtml(priorityLabels[task.priority] || task.priority)}</span>
          ${dueChip(task)}
        </div>
      </div>
      ${task.description ? `<p class="muted small">${escapeHtml(task.description)}</p>` : ""}
      <div class="task-actions">
        <label class="field">
          <span>Status</span>
          <select data-action="update-task-status" data-task-id="${task.id}" ${canStatus ? "" : "disabled"}>
            ${statusOptions(task.status)}
          </select>
        </label>
        ${
          canAssign
            ? `<label class="field">
                <span>Assignee</span>
                <select data-action="update-task-assignee" data-task-id="${task.id}">
                  ${memberOptions}
                </select>
              </label>`
            : `<div></div>`
        }
        ${state.user.role === "admin" ? `<button class="btn danger inline" type="button" data-action="delete-task" data-task-id="${task.id}">Delete</button>` : ""}
      </div>
    </article>
  `;
}

function dueChip(task) {
  if (!task.due_date) return `<span class="chip">No date</span>`;
  const overdue = isOverdue(task);
  return `<span class="chip ${overdue ? "overdue" : ""}">${overdue ? "Overdue: " : "Due: "}${escapeHtml(formatDate(task.due_date))}</span>`;
}

function renderTasks() {
  return `
    <section class="panel">
      <div class="panel-title">
        <h2>All Tasks</h2>
        <span class="chip">${state.tasks.length}</span>
      </div>
      ${
        state.tasks.length
          ? `<div class="task-grid">${state.tasks.map((task) => renderTaskCard(task, null, true)).join("")}</div>`
          : emptyState("No tasks yet.")
      }
    </section>
  `;
}

function renderTeam() {
  return `
    <section class="panel">
      <div class="panel-title">
        <h2>People</h2>
        <span class="chip">${state.users.length}</span>
      </div>
      ${
        state.users.length
          ? `<div class="list">${state.users
              .map(
                (user) => `
                  <article class="item-card">
                    <div class="row-between">
                      <div>
                        <strong>${escapeHtml(user.name)}</strong>
                        <div class="small muted">${escapeHtml(user.email)}</div>
                      </div>
                      ${
                        state.user.role === "admin"
                          ? `<label class="field" style="max-width: 180px;">
                              <span>Role</span>
                              <select data-action="update-role" data-user-id="${user.id}">
                                ${optionList(
                                  [
                                    { value: "admin", label: "Admin" },
                                    { value: "member", label: "Member" },
                                  ],
                                  user.role,
                                )}
                              </select>
                            </label>`
                          : `<span class="chip">${escapeHtml(user.role)}</span>`
                      }
                    </div>
                  </article>
                `,
              )
              .join("")}</div>`
          : emptyState("No members yet.")
      }
    </section>
  `;
}

function emptyState(message) {
  return `<div class="empty">${escapeHtml(message)}</div>`;
}

document.addEventListener("submit", async (event) => {
  const form = event.target.closest("form[data-form]");
  if (!form) return;
  event.preventDefault();
  const kind = form.dataset.form;
  const body = formData(form);
  const submit = form.querySelector("button[type='submit']");
  if (submit) submit.disabled = true;

  try {
    if (kind === "login" || kind === "signup") {
      const data = await api(`/api/${kind}`, { method: "POST", body });
      state.user = data.user;
      state.view = "dashboard";
      await refreshAll();
      showToast(kind === "signup" ? "Account created." : "Welcome back.");
    }

    if (kind === "project-create") {
      const data = await api("/api/projects", { method: "POST", body });
      state.selectedProjectId = data.project.id;
      state.view = "projects";
      await refreshAll();
      showToast("Project created.");
    }

    if (kind === "project-update") {
      await api(`/api/projects/${form.dataset.projectId}`, { method: "PATCH", body });
      await refreshAll();
      showToast("Project updated.");
    }

    if (kind === "member-add") {
      await api(`/api/projects/${form.dataset.projectId}/members`, { method: "POST", body });
      await refreshAll();
      showToast("Member added.");
    }

    if (kind === "task-create") {
      await api("/api/tasks", { method: "POST", body });
      await refreshAll();
      showToast("Task created.");
      form.reset();
    }
  } catch (error) {
    showToast(error.message);
  } finally {
    if (submit) submit.disabled = false;
    render();
  }
});

document.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;

  try {
    if (action === "auth-mode") {
      state.authMode = target.dataset.mode;
      render();
    }

    if (action === "nav") {
      state.view = target.dataset.view;
      render();
    }

    if (action === "refresh") {
      await refreshAll();
      render();
      showToast("Workspace refreshed.");
    }

    if (action === "logout") {
      await api("/api/logout", { method: "POST", body: {} });
      state.user = null;
      state.dashboard = null;
      state.projects = [];
      state.tasks = [];
      state.users = [];
      state.projectDetail = null;
      render();
    }

    if (action === "select-project") {
      state.selectedProjectId = Number(target.dataset.projectId);
      state.view = "projects";
      state.projectDetail = null;
      render();
      await loadProjectDetail(state.selectedProjectId);
      render();
    }

    if (action === "delete-project") {
      if (!window.confirm("Delete this project and its tasks?")) return;
      await api(`/api/projects/${target.dataset.projectId}`, { method: "DELETE", body: {} });
      state.selectedProjectId = null;
      await refreshAll();
      render();
      showToast("Project deleted.");
    }

    if (action === "remove-member") {
      if (!window.confirm("Remove this member from the project?")) return;
      await api(`/api/projects/${target.dataset.projectId}/members/${target.dataset.userId}`, { method: "DELETE", body: {} });
      await refreshAll();
      render();
      showToast("Member removed.");
    }

    if (action === "delete-task") {
      if (!window.confirm("Delete this task?")) return;
      await api(`/api/tasks/${target.dataset.taskId}`, { method: "DELETE", body: {} });
      await refreshAll();
      render();
      showToast("Task deleted.");
    }
  } catch (error) {
    showToast(error.message);
  }
});

document.addEventListener("change", async (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;

  try {
    if (action === "update-task-status") {
      await api(`/api/tasks/${target.dataset.taskId}`, { method: "PATCH", body: { status: target.value } });
      await refreshAll();
      render();
      showToast("Task status updated.");
    }

    if (action === "update-task-assignee") {
      await api(`/api/tasks/${target.dataset.taskId}`, { method: "PATCH", body: { assignee_id: target.value } });
      await refreshAll();
      render();
      showToast("Assignee updated.");
    }

    if (action === "update-role") {
      await api(`/api/users/${target.dataset.userId}/role`, { method: "PATCH", body: { role: target.value } });
      await refreshAll();
      render();
      showToast("Role updated.");
    }
  } catch (error) {
    showToast(error.message);
    render();
  }
});

bootstrap();
