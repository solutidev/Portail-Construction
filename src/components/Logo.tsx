import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  markClassName?: string;
  wordmark?: boolean;
  inverted?: boolean;
  variant?: "mark" | "lockup" | "horizontal";
};

export function Logo({
  className,
  markClassName,
  wordmark = true,
  inverted = false,
  variant,
}: LogoProps) {
  if (variant === "horizontal") {
    return (
      <img
        src="/brand/logo-horizontal.jpg"
        alt="FRX Construction"
        className={cn("h-10 w-auto object-contain object-left", className)}
      />
    );
  }

  const showWordmark = variant === "lockup" || (variant !== "mark" && wordmark);
  const iconSrc = inverted ? "/brand/logo-icon.png" : "/brand/logo-icon-black.png";

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <img
        src={inverted ? "/brand/logo-icon.png" : iconSrc}
        alt="FRX Construction"
        className={cn("size-8 shrink-0 object-contain", markClassName)}
      />
      {showWordmark && (
        <div className="leading-none">
          <div
            className={cn(
              "font-display text-[18px] font-semibold uppercase tracking-[0.08em]",
              inverted ? "text-sidebar-foreground" : "text-foreground",
            )}
          >
            FRX
          </div>
          <div
            className={cn(
              "mt-0.5 text-[9px] font-semibold uppercase tracking-[0.22em]",
              inverted ? "text-sidebar-foreground/55" : "text-muted-foreground",
            )}
          >
            Construction
          </div>
        </div>
      )}
    </div>
  );
}
