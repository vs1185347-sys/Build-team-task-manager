import { useEffect, useMemo, useState } from "react";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  ArcElement,
} from "chart.js";
import { Activity, AlertTriangle, CheckCircle2, FolderKanban, ListChecks } from "lucide-react";

import { Badge } from "../components/ui/Badge";
import { Card, CardText, CardTitle } from "../components/ui/Card";
import { PageSkeleton } from "../components/ui/Skeleton";
import { dashboardApi } from "../services/api";
import type { DashboardData, User } from "../types";
import { formatDate } from "../utils/date";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend, Filler);

const statusLabels = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  REVIEW: "Review",
  DONE: "Done",
};

export default function DashboardPage({ user }: { user: User }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardApi
      .get()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#64748b" } },
        y: { grid: { color: "rgba(148, 163, 184, 0.16)" }, ticks: { color: "#64748b", precision: 0 } },
      },
    }),
    [],
  );

  if (loading || !data) return <PageSkeleton />;

  const stats = [
    { label: "Total projects", value: data.stats.totalProjects, icon: FolderKanban, tone: "emerald" },
    { label: "Total tasks", value: data.stats.totalTasks, icon: ListChecks, tone: "sky" },
    { label: "Completed", value: data.stats.completedTasks, icon: CheckCircle2, tone: "emerald" },
    { label: "Overdue", value: data.stats.overdueTasks, icon: AlertTriangle, tone: "rose" },
  ] as const;

  const statusData = {
    labels: Object.keys(data.charts.statusCounts).map((key) => statusLabels[key as keyof typeof statusLabels]),
    datasets: [
      {
        data: Object.values(data.charts.statusCounts),
        backgroundColor: ["#94a3b8", "#38bdf8", "#f59e0b", "#10b981"],
        borderWidth: 0,
      },
    ],
  };

  const productivityData = {
    labels: data.charts.productivity.map((item) => formatDate(item.date).replace(", 2026", "")),
    datasets: [
      {
        label: "Completed",
        data: data.charts.productivity.map((item) => item.completed),
        borderColor: "#10b981",
        backgroundColor: "rgba(16, 185, 129, 0.12)",
        fill: true,
        tension: 0.42,
      },
    ],
  };

  const progressData = {
    labels: data.charts.projectProgress.map((item) => item.name),
    datasets: [
      {
        label: "Progress",
        data: data.charts.projectProgress.map((item) => item.progress),
        backgroundColor: "#0f172a",
        borderRadius: 6,
      },
    ],
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="animate-fade-up">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardText>{stat.label}</CardText>
                  <p className="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">{stat.value}</p>
                </div>
                <div className="grid h-11 w-11 place-items-center rounded-lg bg-slate-950 text-white dark:bg-white dark:text-slate-950">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <Badge tone={stat.tone} className="mt-5">
                {stat.label === "Completed" ? `${data.stats.completionRate}% completion` : user.role}
              </Badge>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_0.85fr]">
        <Card>
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <CardTitle>Productivity</CardTitle>
              <CardText>Completed tasks over the last seven days.</CardText>
            </div>
            <Activity className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="h-80">
            <Line data={productivityData} options={chartOptions} />
          </div>
        </Card>
        <Card>
          <CardTitle>Task completion</CardTitle>
          <CardText>Current workload by status.</CardText>
          <div className="mt-5 h-72">
            <Doughnut data={statusData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } }} />
          </div>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardTitle>Project progress</CardTitle>
          <CardText>Top active projects by completion.</CardText>
          <div className="mt-5 h-80">
            <Bar data={progressData} options={chartOptions} />
          </div>
        </Card>
        <Card>
          <CardTitle>Recent activity</CardTitle>
          <div className="mt-5 space-y-4">
            {data.recent.activity.length ? (
              data.recent.activity.map((item) => (
                <div key={item.id} className="flex gap-3 rounded-md border border-slate-200/70 bg-white/55 p-3 dark:border-slate-800 dark:bg-slate-900/55">
                  <div className="grid h-9 w-9 place-items-center rounded-md bg-emerald-100 text-xs font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    {item.actor?.avatar ?? "TM"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{item.message}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{formatDate(item.created_at)}</p>
                  </div>
                </div>
              ))
            ) : (
              <CardText>No activity yet.</CardText>
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}
