import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

import { Card, CardText, CardTitle } from "./ui/Card";

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <Card className="flex min-h-56 flex-col items-center justify-center text-center">
      <div className="mb-4 rounded-lg bg-slate-100 p-3 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
        <Inbox className="h-6 w-6" />
      </div>
      <CardTitle>{title}</CardTitle>
      <CardText className="mt-2 max-w-md">{body}</CardText>
      {action ? <div className="mt-5">{action}</div> : null}
    </Card>
  );
}
