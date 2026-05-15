import { Moon, Sun } from "lucide-react";

import { Button } from "./ui/Button";

export function ThemeToggle({ isDark, onToggle }: { isDark: boolean; onToggle: () => void }) {
  return (
    <Button
      aria-label="Toggle theme"
      variant="secondary"
      className="h-10 w-10 px-0"
      icon={isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      onClick={onToggle}
    />
  );
}
