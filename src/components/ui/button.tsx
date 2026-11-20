import * as React from "react";

type ButtonProps =
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "default" | "outline" | "secondary" | "ghost";
    size?: "default" | "icon";
  };

export function Button({
  className = "",
  variant = "default",
  size = "default",
  ...props
}: ButtonProps) {
  const variants = {
    default:
      "bg-slate-900 text-white hover:bg-slate-800",
    outline:
      "border border-slate-200 bg-white hover:bg-slate-100",
    secondary:
      "bg-slate-100 text-slate-900 hover:bg-slate-200",
    ghost:
      "bg-transparent hover:bg-slate-100",
  };

  const sizes = {
    default: "h-10 px-4 py-2",
    icon: "h-10 w-10",
  };

  return (
    <button
      className={[
        "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      ].join(" ")}
      {...props}
    />
  );
}
