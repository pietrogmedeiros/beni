import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  icon,
  actions,
  children,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "shrink-0 border-b bg-background/80 px-5 backdrop-blur",
        className,
      )}
    >
      <div className="flex h-14 items-center gap-3">
        {icon}
        <div className="min-w-0">
          <h1 className="truncate text-[15px] font-semibold leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}
