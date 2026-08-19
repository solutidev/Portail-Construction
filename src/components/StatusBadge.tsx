import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { labelize } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/en";

const TONES: Record<string, string> = {
  active: "bg-emerald-500/12 text-emerald-800 border-emerald-500/20 dark:text-emerald-300",
  planning: "bg-sky-500/12 text-sky-800 border-sky-500/20 dark:text-sky-300",
  on_hold: "bg-amber-500/14 text-amber-800 border-amber-500/25 dark:text-amber-300",
  completed: "bg-slate-500/12 text-slate-700 border-slate-500/20 dark:text-slate-300",
  prospect: "bg-violet-500/12 text-violet-800 border-violet-500/20 dark:text-violet-300",
  inactive: "bg-muted text-muted-foreground border-border",
  not_started: "bg-slate-500/12 text-slate-700 border-slate-500/20 dark:text-slate-300",
  in_progress: "bg-sky-500/12 text-sky-800 border-sky-500/20 dark:text-sky-300",
  blocked: "bg-rose-500/12 text-rose-800 border-rose-500/20 dark:text-rose-300",
  open: "bg-amber-500/14 text-amber-800 border-amber-500/25 dark:text-amber-300",
  answered: "bg-sky-500/12 text-sky-800 border-sky-500/20 dark:text-sky-300",
  closed: "bg-slate-500/12 text-slate-700 border-slate-500/20 dark:text-slate-300",
  draft: "bg-slate-500/12 text-slate-700 border-slate-500/20 dark:text-slate-300",
  submitted: "bg-sky-500/12 text-sky-800 border-sky-500/20 dark:text-sky-300",
  approved: "bg-emerald-500/12 text-emerald-800 border-emerald-500/20 dark:text-emerald-300",
  rejected: "bg-rose-500/12 text-rose-800 border-rose-500/20 dark:text-rose-300",
  planned: "bg-slate-500/12 text-slate-700 border-slate-500/20 dark:text-slate-300",
  committed: "bg-sky-500/12 text-sky-800 border-sky-500/20 dark:text-sky-300",
  invoiced: "bg-amber-500/14 text-amber-800 border-amber-500/25 dark:text-amber-300",
  paid: "bg-emerald-500/12 text-emerald-800 border-emerald-500/20 dark:text-emerald-300",
  sent: "bg-sky-500/12 text-sky-800 border-sky-500/20 dark:text-sky-300",
  accepted: "bg-emerald-500/12 text-emerald-800 border-emerald-500/20 dark:text-emerald-300",
  overdue: "bg-rose-500/12 text-rose-800 border-rose-500/20 dark:text-rose-300",
  converted: "bg-violet-500/12 text-violet-800 border-violet-500/20 dark:text-violet-300",
  complete: "bg-emerald-500/12 text-emerald-800 border-emerald-500/20 dark:text-emerald-300",
  investigating: "bg-amber-500/14 text-amber-800 border-amber-500/25 dark:text-amber-300",
  low: "bg-slate-500/12 text-slate-700 border-slate-500/20 dark:text-slate-300",
  medium: "bg-sky-500/12 text-sky-800 border-sky-500/20 dark:text-sky-300",
  high: "bg-amber-500/14 text-amber-800 border-amber-500/25 dark:text-amber-300",
  critical: "bg-rose-500/12 text-rose-800 border-rose-500/20 dark:text-rose-300",
  observation: "bg-slate-500/12 text-slate-700 border-slate-500/20 dark:text-slate-300",
  near_miss: "bg-amber-500/14 text-amber-800 border-amber-500/25 dark:text-amber-300",
  minor: "bg-orange-500/14 text-orange-800 border-orange-500/25 dark:text-orange-300",
  serious: "bg-rose-500/12 text-rose-800 border-rose-500/20 dark:text-rose-300",
  milestone: "bg-primary/18 text-foreground border-primary/35 dark:text-primary",
  inspection: "bg-muted text-foreground border-border",
  delivery: "bg-sky-500/12 text-sky-800 border-sky-500/20 dark:text-sky-300",
  meeting: "bg-amber-500/14 text-amber-800 border-amber-500/25 dark:text-amber-300",
  weather: "bg-slate-500/12 text-slate-700 border-slate-500/20 dark:text-slate-300",
  internal: "bg-foreground text-background border-foreground",
  external: "bg-primary/18 text-foreground border-primary/40",
  preconstruction: "bg-slate-500/12 text-slate-700 border-slate-500/20 dark:text-slate-300",
  foundation: "bg-amber-500/14 text-amber-800 border-amber-500/25 dark:text-amber-300",
  structure: "bg-sky-500/12 text-sky-800 border-sky-500/20 dark:text-sky-300",
  envelope: "bg-orange-500/14 text-orange-800 border-orange-500/25 dark:text-orange-300",
  interiors: "bg-violet-500/12 text-violet-800 border-violet-500/20 dark:text-violet-300",
  finishing: "bg-emerald-500/12 text-emerald-800 border-emerald-500/20 dark:text-emerald-300",
  closeout: "bg-slate-500/12 text-slate-700 border-slate-500/20 dark:text-slate-300",
};

export function StatusBadge({
  value,
  className,
}: {
  value: string | null | undefined;
  className?: string;
}) {
  const { t } = useI18n();
  if (!value) return <span className="text-muted-foreground">—</span>;
  const key = `status.${value}` as MessageKey;
  const label = t(key);
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium capitalize",
        TONES[value] ?? "bg-muted text-muted-foreground",
        className,
      )}
    >
      {label === key ? labelize(value) : label}
    </Badge>
  );
}
