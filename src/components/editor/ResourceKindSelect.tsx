import { ChevronDown } from 'lucide-react';
import { RESOURCE_BADGE_STYLES } from '@/lib/theme';
import type { ResourceKind } from '@/types/course';

const RESOURCE_KINDS = Object.keys(RESOURCE_BADGE_STYLES) as ResourceKind[];

interface ResourceKindSelectProps {
  value: ResourceKind;
  onChange: (kind: ResourceKind) => void;
  ariaLabel?: string;
}

/**
 * Category selector styled directly with the active ResourceBadge palette
 * so editing rows do not show a duplicate badge beside a plain select.
 */
export function ResourceKindSelect({
  value,
  onChange,
  ariaLabel = 'Resource kind',
}: ResourceKindSelectProps) {
  const style = RESOURCE_BADGE_STYLES[value];

  return (
    <div
      data-testid="resource-kind-select-wrapper"
      className={`relative inline-flex shrink-0 items-center rounded-sm capitalize dark:ring-1 dark:ring-inset dark:ring-white/15 ${style.className}`}
    >
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ResourceKind)}
        aria-label={ariaLabel}
        className="w-full cursor-pointer appearance-none rounded-sm border border-transparent bg-transparent py-1 pr-6 pl-2 text-xs font-medium text-current focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20 focus:outline-none"
      >
        {RESOURCE_KINDS.map((k) => (
          <option
            key={k}
            value={k}
            className="bg-[var(--surface-inset)] text-[var(--text-primary)]"
          >
            {RESOURCE_BADGE_STYLES[k].label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-1.5 h-3 w-3 text-current opacity-85"
      />
    </div>
  );
}
