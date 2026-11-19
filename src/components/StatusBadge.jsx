import { getStatusConfig } from '../config/domainConfig';

export function StatusBadge({ statusId, size = 'sm' }) {
  const status = getStatusConfig(statusId);
  const sizeClasses =
    size === 'xs'
      ? 'px-1.5 py-0.5 text-[10px]'
      : 'px-2 py-0.5 text-[11px]';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${status.badgeClass} ${sizeClasses}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${status.dotClass}`} />
      {status.label}
    </span>
  );
}
