export function isStale(date: Date, staleSeconds: number, now = new Date()): boolean {
  return now.getTime() - date.getTime() > staleSeconds * 1000;
}
