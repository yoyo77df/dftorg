import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";

export type ThemePreset = {
  id: string;
  name: string;
  swatch: [string, string, string, string];
  vars: Record<string, string>;
};

const STYLES: Array<{
  key: string;
  label: string;
  build: (hue: number, hueName: string) => ThemePreset;
}> = [
  {
    key: "dark",
    label: "Dark",
    build: (h, n) => ({
      id: `dark-${n}-${h}`,
      name: `Dark · ${n}`,
      swatch: [
        `oklch(0.13 0.05 ${h})`,
        `oklch(0.2 0.07 ${h})`,
        `oklch(0.65 0.22 ${h})`,
        `oklch(0.85 0.15 ${h})`,
      ] as [string, string, string, string],
      vars: paletteVars(h, {
        bgL: 0.13, bgC: 0.05,
        cardL: 0.18, cardC: 0.06,
        primL: 0.65, primC: 0.22,
        glowL: 0.8, glowC: 0.2,
        accentShift: 25, accentL: 0.75, accentC: 0.18,
      }),
    }),
  },
  {
    key: "midnight",
    label: "Midnight",
    build: (h, n) => ({
      id: `midnight-${n}-${h}`,
      name: `Midnight · ${n}`,
      swatch: [
        `oklch(0.08 0.03 ${h})`,
        `oklch(0.16 0.05 ${h})`,
        `oklch(0.6 0.2 ${h})`,
        `oklch(0.88 0.14 ${h})`,
      ] as [string, string, string, string],
      vars: paletteVars(h, {
        bgL: 0.08, bgC: 0.03,
        cardL: 0.14, cardC: 0.04,
        primL: 0.6, primC: 0.2,
        glowL: 0.78, glowC: 0.2,
        accentShift: -30, accentL: 0.72, accentC: 0.18,
      }),
    }),
  },
  {
    key: "neon",
    label: "Neon",
    build: (h, n) => ({
      id: `neon-${n}-${h}`,
      name: `Neon · ${n}`,
      swatch: [
        `oklch(0.11 0.06 ${h})`,
        `oklch(0.22 0.08 ${h})`,
        `oklch(0.72 0.28 ${h})`,
        `oklch(0.92 0.18 ${h})`,
      ] as [string, string, string, string],
      vars: paletteVars(h, {
        bgL: 0.11, bgC: 0.06,
        cardL: 0.18, cardC: 0.08,
        primL: 0.72, primC: 0.28,
        glowL: 0.88, glowC: 0.24,
        accentShift: 60, accentL: 0.8, accentC: 0.22,
      }),
    }),
  },
  {
    key: "pastel",
    label: "Pastel Dark",
    build: (h, n) => ({
      id: `pastel-${n}-${h}`,
      name: `Pastel · ${n}`,
      swatch: [
        `oklch(0.16 0.03 ${h})`,
        `oklch(0.24 0.04 ${h})`,
        `oklch(0.78 0.12 ${h})`,
        `oklch(0.92 0.08 ${h})`,
      ] as [string, string, string, string],
      vars: paletteVars(h, {
        bgL: 0.16, bgC: 0.03,
        cardL: 0.22, cardC: 0.04,
        primL: 0.78, primC: 0.12,
        glowL: 0.88, glowC: 0.1,
        accentShift: 40, accentL: 0.82, accentC: 0.12,
      }),
    }),
  },
  {
    key: "vivid",
    label: "Vivid",
    build: (h, n) => ({
      id: `vivid-${n}-${h}`,
      name: `Vivid · ${n}`,
      swatch: [
        `oklch(0.12 0.07 ${h})`,
        `oklch(0.2 0.09 ${h})`,
        `oklch(0.68 0.26 ${h})`,
        `oklch(0.88 0.18 ${h})`,
      ] as [string, string, string, string],
      vars: paletteVars(h, {
        bgL: 0.12, bgC: 0.07,
        cardL: 0.18, cardC: 0.08,
        primL: 0.68, primC: 0.26,
        glowL: 0.82, glowC: 0.22,
        accentShift: -20, accentL: 0.76, accentC: 0.22,
      }),
    }),
  },
  {
    key: "graphite",
    label: "Graphite",
    build: (h, n) => ({
      id: `graphite-${n}-${h}`,
      name: `Graphite · ${n}`,
      swatch: [
        `oklch(0.14 0.02 ${h})`,
        `oklch(0.22 0.03 ${h})`,
        `oklch(0.62 0.16 ${h})`,
        `oklch(0.85 0.1 ${h})`,
      ] as [string, string, string, string],
      vars: paletteVars(h, {
        bgL: 0.14, bgC: 0.02,
        cardL: 0.2, cardC: 0.03,
        primL: 0.62, primC: 0.16,
        glowL: 0.78, glowC: 0.14,
        accentShift: 20, accentL: 0.72, accentC: 0.14,
      }),
    }),
  },
  {
    key: "ember",
    label: "Ember",
    build: (h, n) => ({
      id: `ember-${n}-${h}`,
      name: `Ember · ${n}`,
      swatch: [
        `oklch(0.1 0.05 ${h})`,
        `oklch(0.18 0.07 ${h})`,
        `oklch(0.7 0.24 ${h})`,
        `oklch(0.9 0.16 ${h})`,
      ] as [string, string, string, string],
      vars: paletteVars(h, {
        bgL: 0.1, bgC: 0.05,
        cardL: 0.16, cardC: 0.06,
        primL: 0.7, primC: 0.24,
        glowL: 0.84, glowC: 0.2,
        accentShift: -45, accentL: 0.78, accentC: 0.2,
      }),
    }),
  },
];

function paletteVars(h: number, c: {
  bgL: number; bgC: number;
  cardL: number; cardC: number;
  primL: number; primC: number;
  glowL: number; glowC: number;
  accentShift: number; accentL: number; accentC: number;
}): Record<string, string> {
  const ah = (h + c.accentShift + 360) % 360;
  const primFg = c.primL > 0.7 ? `oklch(0.13 0.04 ${h})` : `oklch(0.99 0 0)`;
  return {
    "--background": `oklch(${c.bgL} ${c.bgC} ${h})`,
    "--foreground": `oklch(0.97 0.01 ${h})`,
    "--card": `oklch(${c.cardL} ${c.cardC} ${h} / 0.6)`,
    "--card-foreground": `oklch(0.97 0.01 ${h})`,
    "--popover": `oklch(${c.cardL} ${c.cardC} ${h})`,
    "--popover-foreground": `oklch(0.97 0.01 ${h})`,
    "--primary": `oklch(${c.primL} ${c.primC} ${h})`,
    "--primary-foreground": primFg,
    "--primary-glow": `oklch(${c.glowL} ${c.glowC} ${h})`,
    "--secondary": `oklch(${c.cardL + 0.04} ${c.cardC} ${h})`,
    "--secondary-foreground": `oklch(0.97 0.01 ${h})`,
    "--muted": `oklch(${c.cardL + 0.04} ${c.cardC - 0.01} ${h})`,
    "--muted-foreground": `oklch(0.72 0.04 ${h})`,
    "--accent": `oklch(${c.accentL} ${c.accentC} ${ah})`,
    "--accent-foreground": `oklch(${c.bgL} ${c.bgC} ${h})`,
    "--border": `oklch(${c.cardL + 0.14} ${c.cardC + 0.02} ${h} / 0.6)`,
    "--input": `oklch(${c.cardL + 0.04} ${c.cardC} ${h})`,
    "--ring": `oklch(${c.primL} ${c.primC} ${h})`,
    "--gradient-primary": `linear-gradient(135deg, oklch(${c.primL} ${c.primC} ${h}), oklch(${c.accentL} ${c.accentC} ${ah}))`,
    "--gradient-hero": `radial-gradient(ellipse at top, oklch(${c.primL - 0.3} ${c.primC} ${h} / 0.55), transparent 60%), linear-gradient(180deg, oklch(${c.bgL} ${c.bgC} ${h}), oklch(${Math.max(0.05, c.bgL - 0.04)} ${c.bgC} ${h}))`,
    "--shadow-neon": `0 0 40px oklch(${c.primL} ${c.primC} ${h} / 0.45)`,
  };
}

const HUES: Array<{ name: string; hue: number }> = [
  { name: "Crimson", hue: 25 },
  { name: "Sunset", hue: 40 },
  { name: "Amber", hue: 60 },
  { name: "Gold", hue: 85 },
  { name: "Lime", hue: 120 },
  { name: "Emerald", hue: 150 },
  { name: "Mint", hue: 165 },
  { name: "Teal", hue: 185 },
  { name: "Sky", hue: 220 },
  { name: "Cobalt", hue: 240 },
  { name: "Indigo", hue: 260 },
  { name: "Royal", hue: 275 },
  { name: "Violet", hue: 290 },
  { name: "Magenta", hue: 310 },
  { name: "Pink", hue: 330 },
  { name: "Rose", hue: 345 },
  { name: "Ruby", hue: 5 },
  { name: "Coral", hue: 18 },
  { name: "Tangerine", hue: 48 },
  { name: "Olive", hue: 100 },
  { name: "Jade", hue: 140 },
  { name: "Aqua", hue: 195 },
  { name: "Azure", hue: 210 },
  { name: "Sapphire", hue: 250 },
  { name: "Plum", hue: 300 },
  { name: "Berry", hue: 320 },
  { name: "Fuchsia", hue: 335 },
  { name: "Blood", hue: 12 },
  { name: "Copper", hue: 32 },
  { name: "Honey", hue: 72 },
];

export const THEME_PRESETS: ThemePreset[] = STYLES.flatMap((s) =>
  HUES.map((h) => s.build(h.hue, h.name.toLowerCase())),
).map((p, i, all) => {
  // dedupe ids if any collision
  return { ...p, id: `${p.id}-${i}` };
});

// Add a few hand-curated favorites at the top
export const FAVORITE_PRESETS: ThemePreset[] = [
  STYLES[0].build(25, "red"),
  STYLES[0].build(150, "green"),
  STYLES[0].build(260, "blue"),
  STYLES[1].build(85, "gold"),
  STYLES[2].build(330, "pink"),
].map((p) => ({ ...p, id: `fav-${p.id}` }));

export const ALL_PRESETS: ThemePreset[] = [...FAVORITE_PRESETS, ...THEME_PRESETS];

export function applyTheme(id: string | null) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  // collect known keys to clear cleanly
  const allKeys = new Set<string>();
  ALL_PRESETS.forEach((p) => Object.keys(p.vars).forEach((k) => allKeys.add(k)));
  allKeys.forEach((k) => root.style.removeProperty(k));
  if (!id || id === "none") {
    return;
  }
  const preset = ALL_PRESETS.find((p) => p.id === id);
  if (!preset) return;
  Object.entries(preset.vars).forEach(([k, v]) => root.style.setProperty(k, v));
}

export function getSavedTheme(): string | null {
  // No local fallback — the public (admin-set) theme is the single source of truth.
  return null;
}

/** Subscribe to the public, admin-set theme; auto-applies for everyone. */
export function subscribePublicTheme(): () => void {
  if (typeof window === "undefined") return () => {};
  try {
    const db = getDb();
    const ref = doc(db, "app_settings", "theme");
    return onSnapshot(
      ref,
      (snap) => {
        const id = snap.exists() ? (snap.data() as { id?: string | null }).id ?? null : null;
        applyTheme(id);
      },
      () => {},
    );
  } catch {
    return () => {};
  }
}

export async function setPublicTheme(id: string | null) {
  const db = getDb();
  const ref = doc(db, "app_settings", "theme");
  await setDoc(ref, { id: id ?? null, updatedAt: Date.now() }, { merge: true });
  applyTheme(id);
}