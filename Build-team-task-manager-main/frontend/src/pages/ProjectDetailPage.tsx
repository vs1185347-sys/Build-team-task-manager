import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Calendar, CheckCircle2, Clock3, Users } from "lucide-react";

import { EmptyState } from "../components/EmptyState";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardText, CardTitle } from "../components/ui/Card";
import { Progress } from "../components/ui/Progress";
import { PageSkeleton } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/Toast";
import { projectApi, taskApi } from "../services/api";
import type { ProjectDetail, Task, TaskStatus, User } from "../types";
import { formatDate } from "../utils/date";

const statuses: TaskStatus[] = ["TODO", "IN_PROGRESS", "REVIEW", "DONE"];
const statusLabel: Record<TaskStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  REVIEW: "Review",
  DONE: "Done",
};

export default function ProjectDetailPage({ user }: { user: User }) {
  const { id } = useParams();
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      setDetail(await projectApi.detail(Number(id)));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  const grouped = useMemo(
    () =>
      statuses.reduce<Record<TaskStatus, Task[]>>(
        (acc, status) => {
          acc[status] = detail?.tasks.filter((task) => task.status === status) ?? [];
          return acc;
        },
        { TODO: [], IN_PROGRESS: [], REVIEW: [], DONE: [] },
      ),
    [detail],
  );

  async function moveTask(taskId: number, nextStatus: TaskStatus) {
    if (!detail) return;
    const current = detail.tasks.find((task) => task.id === taskId);
    if (!current || current.status === nextStatus) return;
    setDetail({
      ...detail,
      tasks: detail.tasks.map((task) => (task.id === taskId ? { ...task, status: nextStatus } : task)),
    });
    try {
      await taskApi.update(taskId, { status: nextStatus });
      toast("Task status updated.");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Unable to update status.", "error");
      await load();
    }
  }

  if (loading || !detail) return <PageSkeleton />;

  const { project } = detail;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link to="/projects" className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-950 dark:hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Projects
          </Link>
          <h1 className="text-3xl font-semibold text-slate-950 dark:text-white">{project.title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{project.description || "No description added."}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="sky"><Calendar className="mr-1 h-3 w-3" />{formatDate(project.due_date)}</Badge>
          <Badge tone="emerald"><CheckCircle2 className="mr-1 h-3 w-3" />{project.progress}% complete</Badge>
          <Badge tone="slate"><Users className="mr-1 h-3 w-3" />{project.members.length} members</Badge>
        </div>
      </div>

      <section className="grid gap-5 lg:grid-cols-[0.7fr_1.3fr]">
        <div className="space-y-5">
          <Card>
            <CardTitle>Progress</CardTitle>
            <div className="mt-5 flex items-end justify-between">
              <span className="text-5xl font-semibold text-slate-950 dark:text-white">{project.progress}%</span>
              <CardText>{project.completed_task_count}/{project.task_count} tasks</CardText>
            </div>
            <Progress value={project.progress} className="mt-5" />
          </Card>
          <Card>
            <CardTitle>Members</CardTitle>
            <div className="mt-4 space-y-3">
              {project.members.map((member) => (
                <div key={member.id} className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-md bg-slate-950 text-xs font-bold text-white dark:bg-white dark:text-slate-950">
                    {member.avatar}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{member.name}</p>
                    <p className="truncate text-xs text-slate-500">{member.email}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <CardTitle>Activity feed</CardTitle>
            <div className="mt-4 space-y-3">
              {detail.activity.length ? (
                detail.activity.map((activity) => (
                  <div key={activity.id} className="flex gap-3">
                    <Clock3 className="mt-1 h-4 w-4 text-slate-400" />
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{activity.message}</p>
                      <p className="text-xs text-slate-500">{formatDate(activity.created_at)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <CardText>No activity yet.</CardText>
              )}
            </div>
          </Card>
        </div>

        {detail.tasks.length ? (
          <div className="grid gap-4 xl:grid-cols-4">
            {statuses.map((status) => (
              <section
                key={status}
                className="rounded-lg border border-slate-200/70 bg-white/45 p-3 dark:border-slate-800 dark:bg-slate-950/35"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  const taskId = Number(event.dataTransfer.getData("task/id"));
                  if (taskId) moveTask(taskId, status);
                }}
              >
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{statusLabel[status]}</h2>
                  <Badge>{grouped[status].length}</Badge>
                </div>
                <div className="space-y-3">
                  {grouped[status].map((task) => (
                    <Card
                      key={task.id}
                      draggable
                      onDragStart={(event) => event.dataTransfer.setData("task/id", String(task.id))}
                      className="cursor-grab p-4 active:cursor-grabbing"
                    >
                      <CardTitle className="text-sm">{task.title}</CardTitle>
                      <CardText className="mt-1 line-clamp-2">{task.description || "No description."}</CardText>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Badge tone={task.priority === "HIGH" ? "rose" : task.priority === "MEDIUM" ? "amber" : "slate"}>
                          {task.priority}
                        </Badge>
                        <Badge tone={task.is_overdue ? "rose" : "sky"}>{formatDate(task.due_date)}</Badge>
                      </div>
                      <div className="mt-4 text-xs font-medium text-slate-500">
                        {task.assigned_to ? `Assigned to ${task.assigned_to.name}` : "Unassigned"}
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <EmptyState title="No tasks in this project" body={user.role === "ADMIN" ? "Create tasks from the Tasks board and assign them to this project." : "Tasks assigned to this project will appear here."} />
        )}
      </section>
    </div>
  );
}
