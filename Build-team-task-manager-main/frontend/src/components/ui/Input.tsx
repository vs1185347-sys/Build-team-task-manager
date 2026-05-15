import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

import { cn } from "../../utils/cn";

interface FieldProps {
  label: string;
  error?: string;
}

export function Input({ label, error, className, ...props }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <input
        className={cn(
          "focus-ring h-11 w-full rounded-md border border-slate-200 bg-white/85 px-3 text-sm text-slate-950 shadow-sm transition placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900/70 dark:text-white",
          error && "border-rose-400",
          className,
        )}
        {...props}
      />
      {error ? <span className="text-xs font-medium text-rose-600">{error}</span> : null}
    </label>
  );
}

export function Textarea({ label, error, className, ...props }: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <textarea
        className={cn(
          "focus-ring min-h-24 w-full resize-y rounded-md border border-slate-200 bg-white/85 px-3 py-2 text-sm text-slate-950 shadow-sm transition placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900/70 dark:text-white",
          error && "border-rose-400",
          className,
        )}
        {...props}
      />
      {error ? <span className="text-xs font-medium text-rose-600">{error}</span> : null}
    </label>
  );
}

export function Select({ label, error, className, children, ...props }: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <select
        className={cn(
          "focus-ring h-11 w-full rounded-md border border-slate-200 bg-white/85 px-3 text-sm text-slate-950 shadow-sm transition dark:border-slate-700 dark:bg-slate-900/70 dark:text-white",
          error && "border-rose-400",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {error ? <span className="text-xs font-medium text-rose-600">{error}</span> : null}
    </label>
  );
}
