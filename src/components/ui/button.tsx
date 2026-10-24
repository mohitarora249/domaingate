import * as React from "react";
import { cn } from "@/lib/utils";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" };

// A small shadcn/ui-style Button primitive, kept local so this repository is easy to run.
export function Button({ className, variant = "primary", ...props }: Props) {
  const variants = {
    primary: "bg-slate-950 text-white hover:bg-slate-800 disabled:opacity-50",
    secondary: "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 disabled:opacity-50",
    danger: "bg-red-600 text-white hover:bg-red-700 disabled:opacity-50",
    ghost: "text-slate-600 hover:bg-slate-100 disabled:opacity-50",
  };
  return <button className={cn("inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed", variants[variant], className)} {...props} />;
}
