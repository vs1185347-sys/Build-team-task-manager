import { useEffect, useState } from "react";
import { Crown, Shield, UserCog } from "lucide-react";

import { EmptyState } from "../components/EmptyState";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardText, CardTitle } from "../components/ui/Card";
import { PageSkeleton } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/Toast";
import { authApi, getResults } from "../services/api";
import type { Role, User } from "../types";
import { formatDate } from "../utils/date";

export default function TeamPage({ user }: { user: User }) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);
  const { toast } = useToast();
  const isAdmin = user.role === "ADMIN";

  async function load() {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const payload = await authApi.users();
      setUsers(getResults(payload));
    } catch (error) {
      toast(error instanceof Error ? error.message : "Unable to load team.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function updateRole(member: User, role: Role) {
    setUpdating(member.id);
    try {
      await authApi.updateRole(member.id, role);
      toast("Role updated.");
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Unable to update role.", "error");
    } finally {
      setUpdating(null);
    }
  }

  if (loading) return <PageSkeleton />;

  if (!isAdmin) {
    return (
      <EmptyState
        title="Team controls are admin-only"
        body="Members can view assigned project teams from each project detail page."
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Team directory</CardTitle>
            <CardText>Assign global roles for workspace permissions.</CardText>
          </div>
          <Badge tone="emerald">
            <Shield className="mr-1 h-3 w-3" />
            Admin managed
          </Badge>
        </div>
      </Card>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white/70 shadow-soft dark:border-slate-800 dark:bg-slate-950/55">
        <div className="hidden grid-cols-[1.4fr_0.8fr_0.8fr_1fr] gap-4 border-b border-slate-200 px-5 py-3 text-xs font-semibold uppercase text-slate-500 dark:border-slate-800 lg:grid">
          <span>User</span>
          <span>Role</span>
          <span>Joined</span>
          <span className="text-right">Actions</span>
        </div>
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {users.map((member) => (
            <div key={member.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[1.4fr_0.8fr_0.8fr_1fr] lg:items-center">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-md bg-slate-950 text-sm font-bold text-white dark:bg-white dark:text-slate-950">
                  {member.avatar}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{member.name}</p>
                  <p className="truncate text-xs text-slate-500">{member.email}</p>
                </div>
              </div>
              <div>
                <Badge tone={member.role === "ADMIN" ? "emerald" : "slate"}>
                  {member.role === "ADMIN" ? <Crown className="mr-1 h-3 w-3" /> : <UserCog className="mr-1 h-3 w-3" />}
                  {member.role}
                </Badge>
              </div>
              <span className="text-sm text-slate-500">{formatDate(member.created_at)}</span>
              <div className="flex justify-start gap-2 lg:justify-end">
                <Button
                  variant={member.role === "ADMIN" ? "secondary" : "primary"}
                  loading={updating === member.id}
                  disabled={member.id === user.id || updating !== null}
                  onClick={() => updateRole(member, member.role === "ADMIN" ? "MEMBER" : "ADMIN")}
                >
                  {member.role === "ADMIN" ? "Make member" : "Make admin"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
