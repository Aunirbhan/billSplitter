/**
 * Person colors — muted mid-tones from the billSplitter palette, chosen to
 * read on both the cream (light) and smoky espresso (dark) schemes.
 * The roster travels inside the shared link, so "Bob is always dusty sand"
 * holds on every phone.
 */
export const PERSON_COLORS = [
  "#af8f7a", // muted cinnamon
  "#8e7364", // driftwood
  "#c6ac8f", // faded almond
  "#9c8878", // clay
  "#d5bdaf", // pale taupe
  "#b0876e", // terracotta wash
  "#7e6b5c", // bark
  "#c9b29b", // sandstone
];

export function colorFor(name: string, roster: string[]): string {
  const i = roster.indexOf(name);
  if (i >= 0) return PERSON_COLORS[i % PERSON_COLORS.length];
  // not on the roster — stable hash so ad-hoc names keep their color
  let h = 0;
  for (let c = 0; c < name.length; c++) h = (h * 31 + name.charCodeAt(c)) | 0;
  return PERSON_COLORS[Math.abs(h) % PERSON_COLORS.length];
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
