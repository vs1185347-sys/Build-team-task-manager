export type Role = "ADMIN" | "MEMBER";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
export type Priority = "LOW" | "MEDIUM" | "HIGH";

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  avatar: string;
  created_at: string;
}

export interface Project {
  id: number;
  title: string;
  description: string;
  due_date: string;
  created_by: User;
  members: User[];
  task_count: number;
  completed_task_count: number;
  overdue_task_count: number;
  progress: number;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  due_date: string;
  assigned_to: User | null;
  project: Project;
  is_overdue: boolean;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: number;
  actor: User | null;
  action: string;
  message: string;
  created_at: string;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface DashboardData {
  stats: {
    totalProjects: number;
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
    completionRate: number;
  };
  charts: {
    statusCounts: Record<TaskStatus, number>;
    priorityCounts: Record<Priority, number>;
    projectProgress: Array<{ name: string; progress: number }>;
    productivity: Array<{ date: string; completed: number }>;
  };
  recent: {
    tasks: Task[];
    projects: Project[];
    activity: Activity[];
  };
}

export interface ProjectDetail {
  project: Project;
  tasks: Task[];
  activity: Activity[];
}
