import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

export function UserAvatar({
  name,
  hint,
  size = "md",
  className,
}: {
  name: string;
  hint?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    sm: "size-7 text-[10px]",
    md: "size-9 text-xs",
    lg: "size-11 text-sm",
  };
  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground",
        sizes[size],
        className,
      )}
      title={name}
    >
      {hint || initials(name)}
    </div>
  );
}
