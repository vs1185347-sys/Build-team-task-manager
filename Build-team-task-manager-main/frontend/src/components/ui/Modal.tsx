import type { ReactNode } from "react";
import { X } from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "./Button";

export function Modal({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="glass max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg p-5"
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{title}</h2>
          <Button aria-label="Close" variant="ghost" className="h-9 w-9 px-0" icon={<X className="h-4 w-4" />} onClick={onClose} />
        </div>
        {children}
      </motion.div>
    </div>
  );
}
