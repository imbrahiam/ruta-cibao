/** Vínculo: two links of a chain, shared by web, native and asset generation. */
export const BRAND_COLORS = {
  pine: "#28594a",
  white: "#ffffff",
  ink: "#2a2a27",
  paper: "#fafaf7",
} as const;

export const MARK = {
  viewBox: 256,
  /** The two links, drawn in a 256 box and set at 75% around its centre. */
  links: [
    "m112 78-18-18C78 44 52 44 36 60s-16 42 0 58l38 38c16 16 42 16 58 0l16-16",
    "m144 178 18 18c16 16 42 16 58 0s16-42 0-58l-38-38c-16-16-42-16-58 0l-16 16",
  ],
  transform: "translate(32 32) scale(.75)",
  strokeWidth: 27,
} as const;
