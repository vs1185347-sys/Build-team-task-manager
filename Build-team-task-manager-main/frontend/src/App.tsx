import { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";

import { AppShell } from "./components/AppShell";
import { ToastProvider, useToast } from "./components/ui/Toast";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";
import ProjectsPage from "./pages/ProjectsPage";
import TasksPage from "./pages/TasksPage";
import TeamPage from "./pages/TeamPage";
import { authApi } from "./services/api";
import type { User } from "./types";

function AppRoutes() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDark, setIsDark] = useState(() => localStorage.getItem("theme") === "dark");
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }, [isDark]);

  useEffect(() => {
    authApi
      .me()
      .then(({ user: activeUser }) => setUser(activeUser))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const authActions = useMemo(
    () => ({
      onAuthed: (activeUser: User) => {
        setUser(activeUser);
        navigate("/");
      },
      logout: async () => {
        try {
          await authApi.logout();
          toast("Logged out.");
        } catch {
          toast("Session cleared locally.", "error");
        } finally {
          setUser(null);
          navigate("/login");
        }
      },
    }),
    [navigate, toast],
  );

  if (loading) {
    return <div className="grid min-h-screen place-items-center text-sm font-medium text-slate-500">Loading workspace...</div>;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<AuthPage onAuthed={authActions.onAuthed} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route
        element={
          <AppShell
            user={user}
            isDark={isDark}
            onToggleTheme={() => setIsDark((current) => !current)}
            onLogout={authActions.logout}
          />
        }
      >
        <Route index element={<DashboardPage user={user} />} />
        <Route path="projects" element={<ProjectsPage user={user} />} />
        <Route path="projects/:id" element={<ProjectDetailPage user={user} />} />
        <Route path="tasks" element={<TasksPage user={user} />} />
        <Route path="team" element={<TeamPage user={user} />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppRoutes />
    </ToastProvider>
  );
}
