import React from 'react';
import { BackButton } from '@/components/ui';
import { cn } from '@/utils/cn';
import { getModuleTitleByPath, getModuleDescriptionByPath } from '@/config/moduleDisplayMetadata';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  showBackButton?: boolean;
  className?: string;
  /**
   * Stable route path of the module this page represents (e.g.
   * '/operations/admin-accounts'). OPT-IN ONLY: when supplied, the module's
   * approved title/description from `moduleDisplayMetadata` are shown, with the
   * `title`/`description` props kept as fallbacks.
   *
   * Deliberately explicit - the header is not derived from useLocation, because
   * PageHeader is also used by create/edit/detail screens whose action-specific
   * headings ("Add New Customer", "Create Quotation") must not be replaced.
   */
  metadataPath?: string;
}

/**
 * Universal Page Header Component
 * Horizontal layout: Back button on left, heading/description on right
 * Standardized font sizes: Title (3xl/30px), Description (base/16px)
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  actions,
  showBackButton = true,
  className,
  metadataPath,
}) => {
  // Resolve only when a module path is explicitly provided; otherwise the
  // caller's own title/description are used exactly as before.
  const displayTitle = metadataPath ? getModuleTitleByPath(metadataPath, title) : title;
  const displayDescription = metadataPath
    ? getModuleDescriptionByPath(metadataPath, description)
    : description;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Main Header Row: Back Button + Title/Description */}
      <div className="flex items-start gap-4">
        {/* Back Button - Left Side */}
        {showBackButton && (
          <div className="flex-shrink-0 pt-1">
            <BackButton />
          </div>
        )}

        {/* Title and Description - Right Side */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-[var(--text-primary)] tracking-tight">
                {displayTitle}
              </h1>
              {displayDescription && (
                <p className="text-base text-[var(--text-secondary)] mt-2">{displayDescription}</p>
              )}
            </div>

            {actions && <div className="flex items-center gap-3">{actions}</div>}
          </div>
        </div>
      </div>
    </div>
  );
};
