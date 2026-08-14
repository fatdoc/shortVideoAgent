export function resolveSidebarNavigationTarget(key: string): string {
  const match = /^\/production\/canvas\/([^/?#]+)$/u.exec(key);
  if (!match) return key;
  return `/production/inbox/${match[1]}?target=canvas`;
}
