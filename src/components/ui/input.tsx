import { appFieldClass } from "@/lib/appFieldStyles";
import { cn } from "@/lib/utils";
import type { InputHTMLAttributes } from "react";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(appFieldClass, "h-7 px-2 text-ui", className)}
      {...props}
    />
  );
}
