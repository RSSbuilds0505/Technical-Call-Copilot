"use client";

import { cn } from "@/lib/utils";
import { forwardRef } from "react";

export const Button = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "subtle"; size?: "sm" | "md" }>(
  function Button({ className, variant = "primary", size = "md", ...props }, ref) {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
          size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-sm",
          variant === "primary" && "bg-signal text-surface-0 hover:bg-signal/85",
          variant === "ghost" && "bg-transparent text-slate-300 hover:bg-surface-3 border border-line",
          variant === "subtle" && "bg-surface-3 text-slate-200 hover:bg-line",
          variant === "danger" && "bg-danger/15 text-danger hover:bg-danger/25 border border-danger/30",
          className
        )}
        {...props}
      />
    );
  }
);

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn("w-full rounded-md border border-line bg-surface-1 px-3 py-2 text-sm text-slate-200 placeholder:text-muted/60", className)}
        {...props}
      />
    );
  }
);

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn("w-full rounded-md border border-line bg-surface-1 px-3 py-2 text-sm text-slate-200 placeholder:text-muted/60", className)}
        {...props}
      />
    );
  }
);

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn("w-full rounded-md border border-line bg-surface-1 px-3 py-2 text-sm text-slate-200", className)} {...props} />;
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1 block text-xs font-medium uppercase tracking-wide text-muted", className)} {...props} />;
}

export function Card({
  className,
  title,
  subtitle,
  action,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { title?: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className={cn("rounded-lg border border-line bg-surface-1 p-4", className)} {...props}>
      {(title || action) && (
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            {title && <h3 className="text-sm font-semibold text-white">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function Badge({ className, tone = "default", ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: "default" | "neutral" | "ok" | "warn" | "danger" | "signal" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        (tone === "default" || tone === "neutral") && "bg-surface-3 text-muted",
        tone === "ok" && "bg-ok/15 text-ok",
        tone === "warn" && "bg-warn/15 text-warn",
        tone === "danger" && "bg-danger/15 text-danger",
        tone === "signal" && "bg-signal/15 text-signal",
        className
      )}
      {...props}
    />
  );
}

export function riskTone(risk: string): "ok" | "warn" | "danger" {
  return risk === "high" ? "danger" : risk === "medium" ? "warn" : "ok";
}

export function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const tone = pct >= 75 ? "bg-ok" : pct >= 50 ? "bg-warn" : "bg-danger";
  return (
    <span className="inline-flex items-center gap-1.5" title={`Confidence ${pct}%`}>
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-3">
        <span className={cn("block h-full rounded-full", tone)} style={{ width: `${pct}%` }} />
      </span>
      <span className="text-[11px] tabular-nums text-muted">{pct}%</span>
    </span>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line py-12 text-center">
      <p className="text-sm font-medium text-slate-300">{title}</p>
      {hint && <p className="max-w-sm text-xs text-muted">{hint}</p>}
      {action}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cn("inline-block h-4 w-4 animate-spin rounded-full border-2 border-line border-t-signal", className)} aria-label="Loading" />;
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{message}</p>;
}
