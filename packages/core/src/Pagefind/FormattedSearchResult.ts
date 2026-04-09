import { PagefindSearchFragment, PagefindSubResult } from './types.js';

/**
 * Merges consecutive <mark> tags into a single <mark> tag.
 * e.g., "<mark>making</mark> <mark>the</mark>" becomes "<mark>making the</mark>"
 * This ensures that terms grouped together in the excerpt are displayed as a single highlighted segment.
 *
 * @param excerpt - The excerpt with potential consecutive <mark> tags
 * @returns Excerpt with merged <mark> tags
 */
function mergeConsecutiveMarks(excerpt: string): string {
  return excerpt.replace(/<\/mark>\s*<mark>/g, ' ');
}

/**
 * Truncates an excerpt to ensure the <mark> tags are visible.
 * - Shows max 15 chars before <mark>
 * - Shows all content after <mark> (no limit)
 * - Adds ellipsis if prefix doesn't start at word boundary
 * - Handles HTML entities in the prefix
 *
 * @param excerpt - The raw excerpt from Pagefind
 * @returns Truncated excerpt with <mark> visible
 */
function truncateExcerptToShowMark(excerpt: string): string {
  const markStart = excerpt.indexOf('<mark>');

  // No mark found, return as is
  if (markStart === -1) return excerpt;

  // If mark is at position 0, return as is
  if (markStart === 0) return excerpt;

  // Get up to 15 chars before <mark>
  const prefix = excerpt.substring(0, markStart);
  const truncatedPrefix = prefix.slice(-15); // Last 15 chars

  // Check if starts at word boundary:
  // - Any whitespace (space, tab, newline)
  // - Any non-alphanumeric character
  const firstChar = truncatedPrefix[0];
  const isWordBoundary = /[\s\d_\-.,;:'"()[\]{}|\\/@#$%^&*!~`]/.test(firstChar);

  if (!isWordBoundary) {
    // Find the first word boundary in the prefix (within 15 chars of end)
    const searchArea = prefix.slice(-15);
    const wordBoundaryMatch = searchArea.match(/[\s\d_\-.,;:'"()[\]{}|\\/@#$%^&*!~`]/);
    if (wordBoundaryMatch) {
      const lastBoundaryIndex = prefix.lastIndexOf(wordBoundaryMatch[0], markStart - 1);
      if (lastBoundaryIndex !== -1 && lastBoundaryIndex < markStart) {
        return `...${prefix.substring(lastBoundaryIndex + 1)}${excerpt.substring(markStart)}`;
      }
    }
    // Fallback: use ellipsis + truncated
    return `...${truncatedPrefix}${excerpt.substring(markStart)}`;
  }

  // Starts at word boundary, no ellipsis needed
  return truncatedPrefix + excerpt.substring(markStart);
}

/**
 * Formatted search result ready for display in the UI.
 * This is the output of the formatting utilities in searchUtils.ts.
 */
export class FormattedSearchResult {
  /** The URL to navigate to when selected */
  route: string;
  /** Processed metadata for display */
  meta: {
    /** Optional date for sorting/display */
    date?: number;
    /** Display title (may include hierarchical breadcrumbs) */
    title: string;
    /** Excerpt with highlighted terms */
    description: string;
    /** Additional metadata properties */
    [key: string]: unknown;
  };

  /** Reference to the original raw Pagefind result */
  result: PagefindSearchFragment;
  /** Whether this result is a sub-result (heading within a page) vs main result (full page) */
  isSubResult: boolean;
  /** Whether this is the last sub-result before a new main result (used for icon styling) */
  isLastSubResult: boolean;

  /**
   * Constructs a SearchResult corresponding to whether
   * the result is the main result or sub result.
   *
   * @param result The main result to extract information from.
   * @param sub_result Optional sub-result. If provided, treats
   * result as a sub-result object and extracts accordingly.
   */
  constructor(result: PagefindSearchFragment, sub_result?: PagefindSubResult) {
    this.route = sub_result?.url || result?.url;

    const title: string = sub_result !== undefined
      ? (sub_result.title || '')
      : (result.meta.title || '');

    const description: string = mergeConsecutiveMarks(
      truncateExcerptToShowMark(
        sub_result?.excerpt || result?.excerpt || '',
      ),
    );

    this.meta = {
      ...result.meta,
      title,
      description,
    };
    this.result = result;
    this.isSubResult = sub_result !== undefined;
    this.isLastSubResult = false;
  }
}
