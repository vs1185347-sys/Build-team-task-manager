import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Edit3, GripVertical, Plus, Search, Trash2 } from "lucide-react";
import { motion } from "framer-motion";

import { EmptyState } from "../components/EmptyState";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardText, CardTitle } from "../components/ui/Card";
import { Input, Select, Textarea } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { PageSkeleton } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/Toast";
import { authApi, getResults, projectApi, taskApi, type TaskPayload } from "../services/api";
import type { Priority, Project, Task, TaskStatus, User } from "../types";
import { formatDate, isoToday } from "../utils/date";

const statuses: TaskStatus[] = ["TODO", "IN_PROGRESS", "REVIEW", "DONE"];
const statusLabel: Record<TaskStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  REVIEW: "Review",
  DONE: "Done",
};
const priorityTone: Record<Priority, "slate" | "amber" | "rose"> = {
  LOW: "slate",
  MEDIUM: "amber",
  HIGH: "rose",
};

const emptyTask: TaskPayload = {
  title: "",
  description: "",
  status: "TODO",
  priority: "MEDIUM",
  due_date: isoToday(),
  assigned_to_id: null,
  project_id: 0,
};

export default function TasksPage({ user }: { user: User }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [form, setForm] = useState<TaskPayload>(emptyTask);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const isAdmin = user.role === "ADMIN";

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set("search", query);
    if (status) params.set("status", status);
    const [taskPayload, projectPayload, userPayload] = await Promise.all([
      taskApi.list(params.toString() ? `?${params.toString()}` : ""),
      projectApi.list(),
      isAdmin ? authApi.users() : Promise.resolve([]),
    ]);
    setTasks(getResults(taskPayload));
    setProjects(getResults(projectPayload));
    setUsers(Array.isArray(userPayload) ? userPayload : userPayload.results);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [status]);

  const grouped = useMemo(
    () =>
      statuses.reduce<Record<TaskStatus, Task[]>>(
        (acc, current) => {
          acc[current] = tasks.filter((task) => task.status === current);
          return acc;
        },
        { TODO: [], IN_PROGRESS: [], REVIEW: [], DONE: [] },
      ),
    [tasks],
  );

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyTask, project_id: projects[0]?.id ?? 0, assigned_to_id: null });
    setModalOpen(true);
  }

  function openEdit(task: Task) {
    setEditing(task);
    setForm({
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      due_date: task.due_date,
      assigned_to_id: task.assigned_to?.id ?? null,
      project_id: task.project.id,
    });
    setModalOpen(true);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await taskApi.update(editing.id, form);
        toast("Task updated.");
      } else {
        await taskApi.create(form);
        toast("Task created.");
      }
      setModalOpen(false);
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Unable to save task.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function removeTask(task: Task) {
    if (!window.confirm(`Delete ${task.title}?`)) return;
    try {
      await taskApi.remove(task.id);
      toast("Task deleted.");
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Unable to delete task.", "error");
    }
  }

  async function moveTask(taskId: number, nextStatus: TaskStatus) {
    const current = tasks.find((task) => task.id === taskId);
    if (!current || current.status === nextStatus) return;
    setTasks((items) => items.map((item) => (item.id === taskId ? { ...item, status: nextStatus } : item)));
    try {
      await taskApi.update(taskId, { status: nextStatus });
      toast("Task status updated.");
    } catch (error) {
      setTasks((items) => items.map((item) => (item.id === taskId ? current : item)));
      toast(error instanceof Error ? error.message : "Unable to update status.", "error");
    }
  }

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          <div className="relative max-w-lg flex-1">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              className="focus-ring h-11 w-full rounded-md border border-slate-200 bg-white/75 pl-9 pr-3 text-sm dark:border-slate-800 dark:bg-slate-900/70"
              placeholder="Search tasks"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") load();
              }}
            />
          </div>
          <select
            className="focus-ring h-11 rounded-md border border-slate-200 bg-white/75 px-3 text-sm dark:border-slate-800 dark:bg-slate-900/70"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">All statuses</option>
            {statuses.map((item) => (
              <option key={item} value={item}>{statusLabel[item]}</option>
            ))}
          </select>
          <Button variant="secondary" onClick={load}>Apply</Button>
        </div>
        {isAdmin ? <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>New task</Button> : null}
      </div>

      {tasks.length ? (
        <div className="grid gap-4 xl:grid-cols-4">
          {statuses.map((column) => (
            <section
              key={column}
              className="min-h-96 rounded-lg border border-slate-200/70 bg-white/45 p-3 dark:border-slate-800 dark:bg-slate-950/35"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                const id = Number(event.dataTransfer.getData("task/id"));
                if (id) moveTask(id, column);
              }}
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{statusLabel[column]}</h2>
                <Badge>{grouped[column].length}</Badge>
              </div>
              <div className="space-y-3">
                {grouped[column].map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(event) => event.dataTransfer.setData("task/id", String(task.id))}
                  >
                    <motion.div layout>
                      <Card className="cursor-grab p-4 active:cursor-grabbing">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <CardTitle className="text-sm">{task.title}</CardTitle>
                          <CardText className="mt-1 line-clamp-2">{task.description || task.project.title}</CardText>
                        </div>
                        <GripVertical className="h-4 w-4 shrink-0 text-slate-400" />
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Badge tone={priorityTone[task.priority]}>{task.priority}</Badge>
                        <Badge tone={task.is_overdue ? "rose" : "sky"}>
                          <CalendarClock className="mr-1 h-3 w-3" />
                          {formatDate(task.due_date)}
                        </Badge>
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="grid h-8 w-8 place-items-center rounded-md bg-slate-950 text-xs font-bold text-white dark:bg-white dark:text-slate-950">
                            {task.assigned_to?.avatar ?? "NA"}
                          </div>
                          <span className="truncate text-xs font-medium text-slate-500">{task.assigned_to?.name ?? "Unassigned"}</span>
                        </div>
                        {isAdmin ? (
                          <div className="flex gap-1">
                            <Button aria-label="Edit task" variant="ghost" className="h-8 w-8 px-0" icon={<Edit3 className="h-4 w-4" />} onClick={() => openEdit(task)} />
                            <Button aria-label="Delete task" variant="ghost" className="h-8 w-8 px-0 text-rose-600" icon={<Trash2 className="h-4 w-4" />} onClick={() => removeTask(task)} />
                          </div>
                        ) : null}
                      </div>
                      </Card>
                    </motion.div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No tasks found"
          body={isAdmin ? "Create tasks, assign owners, and move work through the board." : "Assigned project tasks will appear here."}
          action={isAdmin ? <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>New task</Button> : null}
        />
      )}

      <Modal title={editing ? "Edit task" : "Create task"} open={modalOpen} onClose={() => setModalOpen(false)}>
        <form className="space-y-4" onSubmit={submit}>
          <Input label="Title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required />
          <Textarea label="Description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Project" value={form.project_id} onChange={(event) => setForm((current) => ({ ...current, project_id: Number(event.target.value) }))} required>
              <option value={0} disabled>Select project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.title}</option>
              ))}
            </Select>
            <Select
              label="Assigned to"
              value={form.assigned_to_id ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, assigned_to_id: event.target.value ? Number(event.target.value) : null }))}
            >
              <option value="">Unassigned</option>
              {users.map((member) => (
                <option key={member.id} value={member.id}>{member.name}</option>
              ))}
            </Select>
            <Select label="Status" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as TaskStatus }))}>
              {statuses.map((item) => (
                <option key={item} value={item}>{statusLabel[item]}</option>
              ))}
            </Select>
            <Select label="Priority" value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as Priority }))}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </Select>
          </div>
          <Input label="Due date" type="date" min={isoToday()} value={form.due_date} onChange={(event) => setForm((current) => ({ ...current, due_date: event.target.value }))} required />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? "Save changes" : "Create task"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
