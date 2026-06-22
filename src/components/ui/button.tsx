import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

export function Button({
  className,
  variant = "ghost",
  size = "sm",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "ghost" | "toolbar" | "primary";
  size?: "sm" | "icon";
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-1 rounded-md text-ui font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-40",
        variant === "ghost" && "text-app-muted hover:bg-app-hover hover:text-app-fg",
        variant === "toolbar" &&
          "border border-transparent text-app-muted hover:border-app-border hover:bg-app-hover hover:text-app-fg data-[active=true]:border-app-border data-[active=true]:bg-app-hover data-[active=true]:text-app-fg",
        variant === "primary" && "bg-accent text-white hover:bg-[#0b87e0]",
        size === "sm" && "h-9 px-3",
        size === "icon" && "h-9 w-9",
        className,
      )}
      {...props}
    />
  );
}
