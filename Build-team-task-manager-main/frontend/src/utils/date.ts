export function formatDate(value?: string | null) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export function daysUntil(value?: string | null) {
  if (!value) return null;
  const today = new Date();
  const due = new Date(value);
  const diff = due.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0);
  return Math.ceil(diff / 86400000);
}

export function isoToday() {
  return new Date().toISOString().slice(0, 10);
}
