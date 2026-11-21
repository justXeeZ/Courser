import { RESOURCE_BADGE_STYLES } from '@/lib/theme';
import type { ResourceKind } from '@/types/course';

interface ResourceBadgeProps {
  kind: ResourceKind;
}

export function ResourceBadge({ kind }: ResourceBadgeProps) {
  const style = RESOURCE_BADGE_STYLES[kind];
  return (
    <span
      className={`inline-block shrink-0 rounded-sm px-1.5 py-0.5 text-xs font-medium capitalize no-underline dark:ring-1 dark:ring-inset dark:ring-white/15 ${style.className}`}
    >
      {style.label}
    </span>
  );
}
