/** Read a CSS custom property (design token) off the document root. */
export function cssColor(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}
