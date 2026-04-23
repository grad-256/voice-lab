// CSS カスタムプロパティを Canvas 側で `rgba(r, g, b, alpha)` として使うためのヘルパー。

export function hexToRgbChannels(hex: string): string {
  const clean = hex.trim().replace(/^#/, "");
  if (clean.length === 3) {
    const r = Number.parseInt(clean[0] + clean[0], 16);
    const g = Number.parseInt(clean[1] + clean[1], 16);
    const b = Number.parseInt(clean[2] + clean[2], 16);
    if ([r, g, b].every((n) => Number.isFinite(n))) return `${r}, ${g}, ${b}`;
  }
  if (clean.length === 6) {
    const r = Number.parseInt(clean.slice(0, 2), 16);
    const g = Number.parseInt(clean.slice(2, 4), 16);
    const b = Number.parseInt(clean.slice(4, 6), 16);
    if ([r, g, b].every((n) => Number.isFinite(n))) return `${r}, ${g}, ${b}`;
  }
  return "0, 0, 0";
}

export function cssVarToRgbChannels(varName: string): string {
  if (typeof document === "undefined") return "0, 0, 0";
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName);
  return hexToRgbChannels(value);
}

/** `<html>` の `data-theme` 変化を監視。返り値で監視停止。 */
export function observeThemeChange(callback: () => void): () => void {
  if (typeof document === "undefined") return () => {};
  const observer = new MutationObserver(() => callback());
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}
