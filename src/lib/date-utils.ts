/**
 * Returns the local date key (YYYY-MM-DD) for a Date, respecting the user's timezone.
 * Unlike toISOString().split('T')[0], this does not shift to UTC.
 */
export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Adds days to a date key and returns the new date key, using local time.
 */
export function addDaysLocal(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return localDateKey(d);
}

/**
 * Returns tomorrow's date key in local time.
 */
export function tomorrowKey(): string {
  return addDaysLocal(localDateKey(), 1);
}
