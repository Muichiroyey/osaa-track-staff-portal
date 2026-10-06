// Interface display preference (SAA Staff Settings, spec section 15).
// A per-device setting kept in the browser: text size for the whole portal.
// Applied by scaling the root font size — every Tailwind rem-based size
// follows it — so it needs no per-page code.
const KEY = "osaa_track_staff_text_size";

export const TEXT_SIZES = [
  { value: "small", label: "Small", px: 14 },
  { value: "default", label: "Default", px: 16 },
  { value: "large", label: "Large", px: 18 },
];

export function getTextSize() {
  try {
    const v = localStorage.getItem(KEY);
    return TEXT_SIZES.some((s) => s.value === v) ? v : "default";
  } catch {
    return "default";
  }
}

export function applyTextSize(value = getTextSize()) {
  const size = TEXT_SIZES.find((s) => s.value === value) || TEXT_SIZES[1];
  document.documentElement.style.fontSize = `${size.px}px`;
}

export function setTextSize(value) {
  try {
    localStorage.setItem(KEY, value);
  } catch {
    /* storage unavailable — the choice just won't persist */
  }
  applyTextSize(value);
}
