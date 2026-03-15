"use client";

import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";

// ─── Button ─────────────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "success";
type ButtonSize = "sm" | "md" | "lg" | "xl";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-accent-500 hover:bg-accent-600 active:bg-accent-700 text-white shadow-glow hover:shadow-glow-lg",
  secondary:
    "bg-surface-200 hover:bg-surface-300 active:bg-surface-400 text-slate-200 border border-white/[0.06]",
  danger:
    "bg-danger-500/15 hover:bg-danger-500/25 active:bg-danger-500/35 text-danger-400 border border-danger-500/20",
  ghost:
    "bg-transparent hover:bg-white/[0.06] active:bg-white/[0.08] text-slate-300",
  success:
    "bg-success-500/15 hover:bg-success-500/25 active:bg-success-500/35 text-success-400 border border-success-500/20",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs gap-1.5 rounded-xl",
  md: "px-4 py-2.5 text-sm gap-2 rounded-xl",
  lg: "px-5 py-3 text-sm gap-2 rounded-2xl",
  xl: "px-6 py-4 text-base gap-2.5 rounded-2xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", icon, children, className = "", disabled, ...rest }, ref) => (
    <button
      ref={ref}
      disabled={disabled}
      className={`inline-flex items-center justify-center font-semibold transition-all duration-200 
        disabled:opacity-40 disabled:pointer-events-none cursor-pointer
        ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  )
);
Button.displayName = "Button";

// ─── Input ──────────────────────────────────────────────────────────────────

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", ...rest }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {label}
        </label>
      )}
      <input
        ref={ref}
        className={`w-full px-4 py-2.5 bg-surface-200 border border-white/[0.06] rounded-xl text-sm text-slate-100 
          placeholder:text-slate-500 outline-none transition-all duration-200
          focus:border-accent-500/50 focus:bg-surface-100 focus:ring-2 focus:ring-accent-500/20
          ${error ? "border-danger-500/50 focus:border-danger-500/50 focus:ring-danger-500/20" : ""} 
          ${className}`}
        {...rest}
      />
      {error && <p className="text-xs text-danger-400">{error}</p>}
    </div>
  )
);
Input.displayName = "Input";

// ─── Select ─────────────────────────────────────────────────────────────────

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, className = "", ...rest }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {label}
        </label>
      )}
      <select
        ref={ref}
        className={`w-full px-4 py-2.5 bg-surface-200 border border-white/[0.06] rounded-xl text-sm text-slate-100
          outline-none transition-all duration-200 cursor-pointer appearance-none
          focus:border-accent-500/50 focus:ring-2 focus:ring-accent-500/20 ${className}`}
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
);
Select.displayName = "Select";

// ─── Badge ──────────────────────────────────────────────────────────────────

type BadgeVariant = "accent" | "success" | "danger" | "warning" | "muted";

const BADGE_COLORS: Record<BadgeVariant, string> = {
  accent: "bg-accent-500/15 text-accent-300 border-accent-500/20",
  success: "bg-success-500/15 text-success-400 border-success-500/20",
  danger: "bg-danger-500/15 text-danger-400 border-danger-500/20",
  warning: "bg-warning-500/15 text-warning-400 border-warning-500/20",
  muted: "bg-white/[0.06] text-slate-400 border-white/[0.06]",
};

export function Badge({
  variant = "muted",
  children,
  className = "",
}: {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full border ${BADGE_COLORS[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

// ─── Card ───────────────────────────────────────────────────────────────────

export function Card({
  children,
  className = "",
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={`bg-surface-100 border border-white/[0.06] rounded-2xl shadow-card
        ${hover ? "hover:shadow-card-hover hover:border-white/[0.1] transition-all duration-200" : ""}
        ${className}`}
    >
      {children}
    </div>
  );
}

// ─── Modal ──────────────────────────────────────────────────────────────────

export function Modal({
  title,
  description,
  children,
  onClose,
  maxWidth = "max-w-md",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  maxWidth?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={`bg-surface-100 border border-white/[0.06] rounded-3xl shadow-2xl w-full ${maxWidth} animate-slide-up overflow-hidden`}>
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <div>
            <h2 className="text-lg font-bold text-slate-100">{title}</h2>
            {description && (
              <p className="text-sm text-slate-500 mt-0.5">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/[0.06] transition-colors"
            aria-label="Închide"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="px-6 pb-6 pt-2">{children}</div>
      </div>
    </div>
  );
}

// ─── Stat Card ──────────────────────────────────────────────────────────────

export function StatCard({
  label,
  value,
  icon,
  color = "accent",
}: {
  label: string;
  value: string | number;
  icon?: ReactNode;
  color?: "accent" | "success" | "warning" | "danger";
}) {
  const iconColors: Record<string, string> = {
    accent: "text-accent-400",
    success: "text-success-400",
    warning: "text-warning-400",
    danger: "text-danger-400",
  };

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            {label}
          </p>
          <p className="text-3xl font-bold text-slate-100 tabular-nums">{value}</p>
        </div>
        {icon && (
          <div className={`text-2xl ${iconColors[color]}`}>{icon}</div>
        )}
      </div>
    </Card>
  );
}

// ─── Spinner ────────────────────────────────────────────────────────────────

export function Spinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dims = { sm: "w-4 h-4", md: "w-6 h-6", lg: "w-8 h-8" };
  return (
    <svg className={`animate-spin ${dims[size]} text-accent-400`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ─── Logo ───────────────────────────────────────────────────────────────────

export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "text-lg", md: "text-xl", lg: "text-2xl" };
  const iconSizes = { sm: "w-6 h-6", md: "w-8 h-8", lg: "w-10 h-10" };

  return (
    <div className="flex items-center gap-2.5">
      <div className={`${iconSizes[size]} rounded-xl bg-accent-500/15 border border-accent-500/20 flex items-center justify-center`}>
        <svg className="w-4 h-4 text-accent-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2" />
          <path d="M12 8v8" />
          <path d="M8 12h8" />
        </svg>
      </div>
      <span className={`${sizes[size]} font-bold tracking-tight text-slate-100`}>Solemtrix</span>
    </div>
  );
}

// ─── Divider ────────────────────────────────────────────────────────────────

export function Divider() {
  return <div className="border-t border-white/[0.06] my-4" />;
}

// ─── Empty State ────────────────────────────────────────────────────────────

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      <div className="text-4xl mb-4 opacity-40">{icon}</div>
      <h3 className="text-lg font-semibold text-slate-300 mb-1">{title}</h3>
      {description && <p className="text-sm text-slate-500 max-w-xs mb-4">{description}</p>}
      {action}
    </div>
  );
}
