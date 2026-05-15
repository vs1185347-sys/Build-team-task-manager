import { useMemo, useState } from "react";
import { ArrowRight, Check, LockKeyhole, Mail, ShieldCheck, UserPlus } from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { useToast } from "../components/ui/Toast";
import { authApi, ApiError } from "../services/api";
import type { Role, User } from "../types";

type Mode = "login" | "register";

export default function AuthPage({ onAuthed }: { onAuthed: (user: User) => void }) {
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "MEMBER" as Role,
    password: "",
    confirm_password: "",
  });
  const [error, setError] = useState("");
  const { toast } = useToast();

  const strength = useMemo(() => {
    let score = 0;
    if (form.password.length >= 8) score += 1;
    if (/[A-Z]/.test(form.password)) score += 1;
    if (/[0-9]/.test(form.password)) score += 1;
    if (/[^A-Za-z0-9]/.test(form.password)) score += 1;
    return score;
  }, [form.password]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (mode === "register" && form.password !== form.confirm_password) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const result =
        mode === "login"
          ? await authApi.login({ email: form.email, password: form.password })
          : await authApi.register(form);
      toast(mode === "login" ? "Welcome back." : "Workspace created.");
      onAuthed(result.user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      <section className="flex items-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-xl">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white/70 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              Team Task Manager
            </div>
            <div>
              <h1 className="max-w-xl text-4xl font-semibold leading-tight text-slate-950 dark:text-white sm:text-5xl">
                Delivery planning for focused technical teams.
              </h1>
              <p className="mt-5 max-w-lg text-base leading-7 text-slate-600 dark:text-slate-300">
                Projects, tasks, roles, progress, and analytics in one clean workspace.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {["JWT auth", "RBAC", "Analytics"].map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-md bg-white/65 px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900/60 dark:text-slate-200 dark:ring-slate-800">
                  <Check className="h-4 w-4 text-emerald-500" />
                  {item}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <section className="flex items-center px-5 pb-10 sm:px-10 lg:py-10">
        <Card className="mx-auto w-full max-w-md">
          <div className="mb-6 flex rounded-lg bg-slate-100 p-1 dark:bg-slate-900">
            {(["login", "register"] as Mode[]).map((item) => (
              <button
                key={item}
                className={`focus-ring flex-1 rounded-md px-3 py-2 text-sm font-semibold transition ${
                  mode === item ? "bg-white text-slate-950 shadow-sm dark:bg-slate-800 dark:text-white" : "text-slate-500"
                }`}
                onClick={() => {
                  setMode(item);
                  setError("");
                }}
                type="button"
              >
                {item === "login" ? "Login" : "Sign up"}
              </button>
            ))}
          </div>

          <form className="space-y-4" onSubmit={submit}>
            {mode === "register" ? (
              <>
                <Input
                  label="Full name"
                  autoComplete="name"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  required
                />
                <div className="space-y-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Signup role</span>
                  <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1 dark:bg-slate-900">
                    {(["ADMIN", "MEMBER"] as Role[]).map((role) => (
                      <button
                        key={role}
                        type="button"
                        className={`focus-ring rounded-md px-3 py-2 text-sm font-semibold transition ${
                          form.role === role
                            ? "bg-white text-slate-950 shadow-sm dark:bg-slate-800 dark:text-white"
                            : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                        }`}
                        onClick={() => setForm((current) => ({ ...current, role }))}
                      >
                        {role === "ADMIN" ? "Admin" : "Member"}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
            <Input
              label="Email"
              type="text"
              inputMode="email"
              autoComplete="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              required
            />
            <Input
              label="Password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              required
            />
            {mode === "register" ? (
              <>
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={index}
                      className={`h-1.5 rounded-full ${index < strength ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-800"}`}
                    />
                  ))}
                </div>
                <Input
                  label="Confirm password"
                  type="password"
                  autoComplete="new-password"
                  value={form.confirm_password}
                  onChange={(event) => setForm((current) => ({ ...current, confirm_password: event.target.value }))}
                  required
                />
              </>
            ) : null}
            {error ? <div className="rounded-md bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:bg-rose-950/50 dark:text-rose-200">{error}</div> : null}
            <Button
              className="w-full"
              loading={loading}
              icon={mode === "login" ? <LockKeyhole className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              type="submit"
            >
              {mode === "login" ? "Login" : "Create account"}
              {!loading ? <ArrowRight className="h-4 w-4" /> : null}
            </Button>
          </form>

          <div className="mt-6 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Mail className="h-4 w-4" />
            Choose Admin or Member when creating an account.
          </div>
        </Card>
      </section>
    </main>
  );
}
