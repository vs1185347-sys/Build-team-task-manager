import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, Edit3, Plus, Search, Trash2, Users } from "lucide-react";
import { motion } from "framer-motion";

import { EmptyState } from "../components/EmptyState";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardText, CardTitle } from "../components/ui/Card";
import { Input, Textarea } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { Progress } from "../components/ui/Progress";
import { PageSkeleton } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/Toast";
import { authApi, getResults, projectApi, type ProjectPayload } from "../services/api";
import type { Project, User } from "../types";
import { daysUntil, formatDate, isoToday } from "../utils/date";

const emptyForm: ProjectPayload = {
  title: "",
  description: "",
  due_date: isoToday(),
  member_ids: [],
};

export default function ProjectsPage({ user }: { user: User }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [form, setForm] = useState<ProjectPayload>(emptyForm);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const isAdmin = user.role === "ADMIN";

  async function load() {
    setLoading(true);
    const [projectPayload, userPayload] = await Promise.all([
      projectApi.list(query ? `?search=${encodeURIComponent(query)}` : ""),
      isAdmin ? authApi.users() : Promise.resolve([]),
    ]);
    setProjects(getResults(projectPayload));
    setUsers(Array.isArray(userPayload) ? userPayload : userPayload.results);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const selectableUsers = useMemo(() => users.filter((item) => item.id !== user.id), [users, user.id]);

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, member_ids: [user.id] });
    setModalOpen(true);
  }

  function openEdit(project: Project) {
    setEditing(project);
    setForm({
      title: project.title,
      description: project.description,
      due_date: project.due_date,
      member_ids: project.members.map((member) => member.id),
    });
    setModalOpen(true);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await projectApi.update(editing.id, form);
        toast("Project updated.");
      } else {
        await projectApi.create(form);
        toast("Project created.");
      }
      setModalOpen(false);
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Unable to save project.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function removeProject(project: Project) {
    if (!window.confirm(`Delete ${project.title}?`)) return;
    try {
      await projectApi.remove(project.id);
      toast("Project deleted.");
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Unable to delete project.", "error");
    }
  }

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            className="focus-ring h-11 w-full rounded-md border border-slate-200 bg-white/75 pl-9 pr-3 text-sm dark:border-slate-800 dark:bg-slate-900/70"
            placeholder="Search projects"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") load();
            }}
          />
        </div>
        {isAdmin ? <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>New project</Button> : null}
      </div>

      {projects.length ? (
        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {projects.map((project, index) => {
            const days = daysUntil(project.due_date);
            return (
              <motion.article
                key={project.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <Card className="h-full">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link to={`/projects/${project.id}`} className="block">
                        <CardTitle className="truncate hover:text-emerald-600">{project.title}</CardTitle>
                      </Link>
                      <CardText className="mt-2 line-clamp-2">{project.description || "No description added."}</CardText>
                    </div>
                    {isAdmin ? (
                      <div className="flex shrink-0 gap-1">
                        <Button aria-label="Edit project" variant="ghost" className="h-9 w-9 px-0" icon={<Edit3 className="h-4 w-4" />} onClick={() => openEdit(project)} />
                        <Button aria-label="Delete project" variant="ghost" className="h-9 w-9 px-0 text-rose-600" icon={<Trash2 className="h-4 w-4" />} onClick={() => removeProject(project)} />
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-5 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-600 dark:text-slate-300">Progress</span>
                      <span className="font-semibold text-slate-950 dark:text-white">{project.progress}%</span>
                    </div>
                    <Progress value={project.progress} />
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <Badge tone={project.overdue_task_count ? "rose" : "emerald"}>{project.completed_task_count}/{project.task_count} tasks</Badge>
                    <Badge tone={days !== null && days < 7 ? "amber" : "sky"}>
                      <Calendar className="mr-1 h-3 w-3" />
                      {formatDate(project.due_date)}
                    </Badge>
                    <Badge tone="slate">
                      <Users className="mr-1 h-3 w-3" />
                      {project.members.length} members
                    </Badge>
                  </div>
                </Card>
              </motion.article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No projects yet"
          body={isAdmin ? "Create a project to start assigning tasks and tracking delivery." : "Assigned projects will appear here."}
          action={isAdmin ? <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>New project</Button> : null}
        />
      )}

      <Modal title={editing ? "Edit project" : "Create project"} open={modalOpen} onClose={() => setModalOpen(false)}>
        <form className="space-y-4" onSubmit={submit}>
          <Input label="Title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required />
          <Textarea label="Description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
          <Input label="Due date" type="date" min={isoToday()} value={form.due_date} onChange={(event) => setForm((current) => ({ ...current, due_date: event.target.value }))} required />
          <div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Team members</span>
            <div className="mt-2 grid max-h-56 gap-2 overflow-y-auto rounded-lg border border-slate-200 p-3 dark:border-slate-800">
              {selectableUsers.map((member) => (
                <label key={member.id} className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800">
                  <input
                    type="checkbox"
                    checked={form.member_ids.includes(member.id)}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        member_ids: event.target.checked
                          ? [...current.member_ids, member.id]
                          : current.member_ids.filter((id) => id !== member.id),
                      }))
                    }
                  />
                  <span className="font-medium text-slate-700 dark:text-slate-200">{member.name}</span>
                  <span className="text-xs text-slate-500">{member.email}</span>
                </label>
              ))}
              {!selectableUsers.length ? <CardText>No member accounts yet.</CardText> : null}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? "Save changes" : "Create project"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
