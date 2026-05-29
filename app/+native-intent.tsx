export function redirectSystemPath({
  path,
  initial,
}: { path: string; initial: boolean }) {
  if (path.startsWith("trendpulse://trend/")) {
    const id = path.replace("trendpulse://trend/", "").split("?")[0];
    if (id) return `/trend/${id}`;
  }

  if (path.startsWith("trendpulse://pulse/")) {
    const id = path.replace("trendpulse://pulse/", "").split("?")[0];
    if (id) return `/pulse/${id}`;
  }

  if (path.startsWith("trendpulse://search")) {
    return "/search";
  }

  if (path.startsWith("trendpulse://watchlist")) {
    return "/watchlist";
  }

  return "/";
}
