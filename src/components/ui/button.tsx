import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./icon";
import { Spinner } from "./spinner";

type Variant = "primary" | "secondary" | "ghost" | "soft" | "danger";
type Size = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 font-medium select-none whitespace-nowrap transition-[background-color,color,border-color,box-shadow,transform,opacity] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand text-brand-ink hover:bg-brand-strong shadow-[inset_0_1px_0_rgb(255_255_255/0.16),var(--shadow-sm)]",
  secondary: "bg-surface text-ink border border-line hover:border-line-strong hover:bg-surface-2 shadow-soft",
  ghost: "text-ink-2 hover:bg-sunken hover:text-ink",
  soft: "bg-brand-soft text-brand hover:brightness-[0.97]",
  danger: "text-danger hover:bg-danger-soft",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] rounded-lg",
  md: "h-10 px-4 text-sm rounded-xl",
  lg: "h-12 px-5 text-[15px] rounded-2xl",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

interface Common {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconRight?: IconName;
  children?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  loading,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: Common & ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  const iconSize = size === "sm" ? 16 : 18;
  return (
    <button type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <Spinner size={iconSize} /> : icon ? <Icon name={icon} size={iconSize} /> : null}
      {children}
      {iconRight && !loading ? <Icon name={iconRight} size={iconSize} /> : null}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  className,
  children,
  ...rest
}: Common & ComponentProps<typeof Link>) {
  const iconSize = size === "sm" ? 16 : 18;
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {icon ? <Icon name={icon} size={iconSize} /> : null}
      {children}
      {iconRight ? <Icon name={iconRight} size={iconSize} /> : null}
    </Link>
  );
}

export function IconButton({
  icon,
  label,
  className,
  size = 36,
  ...rest
}: { icon: IconName; label: string; size?: number } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center justify-center rounded-xl text-ink-2 transition-colors hover:bg-sunken hover:text-ink active:scale-95 disabled:opacity-40",
        className,
      )}
      style={{ width: size, height: size }}
      {...rest}
    >
      <Icon name={icon} size={Math.round(size * 0.52)} />
    </button>
  );
}
