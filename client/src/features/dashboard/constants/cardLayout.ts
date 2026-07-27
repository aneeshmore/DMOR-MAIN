/**
 * Universal module-card sizing.
 *
 * Single source of truth for the OUTER height of every module card, shared by
 * the role dashboard (Dashboard.tsx) and the Masters/Operations/Reports
 * sub-dashboards (DynamicChildDashboard.tsx).
 *
 * Why a minimum height is needed
 * ------------------------------
 * Both card grids rely on CSS grid's default `align-items: stretch`, which only
 * equalises cards WITHIN a row. Card height was therefore driven by the longest
 * content in each row, so a section of short titles/descriptions (Masters)
 * rendered shorter cards than a section with longer text (Operations), and the
 * role dashboard mixed both. Pinning a shared minimum height makes every card
 * in every section identical regardless of text length.
 *
 * The value reproduces the existing Operations card appearance and is derived
 * from that card's own box model - nothing here changes padding, radius,
 * typography, colours or spacing:
 *
 *   p-6 vertical padding      24 + 24 = 48px
 *   icon tile (w-12 h-12)          48px
 *   icon margin (mb-4)             16px
 *   title, up to 2 lines           40px
 *   title margin (mb-2)             8px
 *   description, up to 3 lines     60px
 *                                 -------
 *                                  220px  ->  13.75rem
 *
 * `h-full` lets each card fill its grid row so the minimum acts as a floor,
 * never a cap: a card whose content genuinely needs more space still grows,
 * and its row-mates grow with it.
 */
export const MODULE_CARD_SIZE = 'h-full min-h-[13.75rem]';

/** Title clamp - keeps long module names to two lines so one card cannot
 *  become taller than the rest. */
export const MODULE_CARD_TITLE_CLAMP = 'line-clamp-2';

/** Description clamp - three lines fits every approved description while
 *  guaranteeing text never overflows the card. */
export const MODULE_CARD_DESCRIPTION_CLAMP = 'line-clamp-3';
