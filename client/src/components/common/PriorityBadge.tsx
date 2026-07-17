/**
 * PriorityBadge
 *
 * Reusable badge for order priority levels.
 * Single source of truth for the priority → color mapping:
 *   Urgent → Red, High → Orange, Normal → Green, Low → Yellow
 */

const PRIORITY_STYLES: Record<string, string> = {
  Urgent: 'bg-red-100 text-red-700',
  High: 'bg-orange-100 text-orange-700',
  Normal: 'bg-green-100 text-green-700',
  Low: 'bg-yellow-100 text-yellow-700',
};

interface PriorityBadgeProps {
  priority?: string | null;
  className?: string;
}

export const PriorityBadge = ({ priority, className = '' }: PriorityBadgeProps) => {
  if (!priority) return null;

  // Normalize casing so legacy values like 'urgent' still map correctly
  const normalized =
    priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase();

  const style = PRIORITY_STYLES[normalized];
  if (!style) return null;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${style} ${className}`}
    >
      {normalized}
    </span>
  );
};

export default PriorityBadge;
