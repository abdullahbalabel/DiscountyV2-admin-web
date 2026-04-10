import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
}

export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 animate-fade-in">
      <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-muted/60 mb-4">
        <Icon className="h-6 w-6 text-muted-foreground/50" />
      </div>
      <p className="text-sm font-medium text-foreground mb-1">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground text-center max-w-[260px]">
          {description}
        </p>
      )}
    </div>
  );
}
