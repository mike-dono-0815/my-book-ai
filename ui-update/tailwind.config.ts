import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ── "The Study" warm-paper theme ──────────────────────────────
        paper:    "#F3ECDD", // page background
        rail:     "#EBE2CF", // left sidebar background
        line:     "#DDCFB3", // rail borders / dividers
        linesoft: "#E2D6BE", // lighter dividers in the main column
        card:     "#FBF6EA", // input bar, suggestion cards
        cardEdge: "#E7D9BE", // card borders
        ink:      "#2B2722", // primary headings / strong text
        muted:    "#8A8073", // secondary text
        faint:    "#A89A7C", // labels, captions
        clay:     "#A0613C", // accent
        claydeep: "#8A4F2D", // accent (hover / emphasis)
        claysoft: "#EBD9C2", // user bubble / hover wash
        navsel:   "#E0CFAE", // selected nav item
        navhover: "#E2D6BE", // nav item hover

        // ── Original tokens kept for backwards-compatibility ──────────
        cream:    "#FAF8F4",
        navy:     "#19324F",
        gold:     "#A8821E",
        warm:     "#F5F0E8",
      },
      fontFamily: {
        sans:  ["'IBM Plex Sans'", "system-ui", "sans-serif"],
        serif: ["Newsreader", "Georgia", "serif"],
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;
