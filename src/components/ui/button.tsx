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
        variant === "ghost" && "text-[#c4c4c4] hover:bg-white/10 hover:text-white",
        variant === "toolbar" &&
          "border border-transparent text-[#c4c4c4] hover:border-white/10 hover:bg-white/5 hover:text-white data-[active=true]:border-white/15 data-[active=true]:bg-white/10 data-[active=true]:text-white",
        variant === "primary" && "bg-accent text-white hover:bg-[#0b87e0]",
        size === "sm" && "h-7 px-2",
        size === "icon" && "h-7 w-7",
        className,
      )}
      {...props}
    />
  );
}
