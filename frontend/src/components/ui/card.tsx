import * as React from "react";
import { cn } from "@/lib/utils";

function Card({
  className,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm",
        className
      )}
      {...props}
    />
  );
}

function CardHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("px-5 pt-5", className)} {...props} />;
}

function CardTitle({
  className,
  ...props
}: React.ComponentProps<"h2">) {
  return (
    <h2
      className={cn("text-lg font-semibold tracking-tight text-slate-900", className)}
      {...props}
    />
  );
}

function CardDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return <p className={cn("text-sm text-slate-600", className)} {...props} />;
}

function CardContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("px-5 pb-5", className)} {...props} />;
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent };
