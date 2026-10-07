/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gov: {
          bg: "#F7F7F1",        // Primary background: calm pastel cream
          surface: "#FFFFFF",   // Pure white surfaces
          subtle: "#F2F0EB",    // Soft warm neutral hover / background
          border: "#E8E4DC",    // Soft warm border
          borderStrong: "#C8BFB3", // Secondary neutral border
          text: "#050505",      // Primary text: deep clean neutral
          muted: "#5E5E5D",     // Secondary text: muted warm charcoal
          brown: "#4B3C32",     // Muted dark brown
          accent: "#AA896C",    // Muted warm accent
          darkAccent: "#916540",// Dark warm accent
          navy: "#4B3C32",      // Harmonize legacy navy to muted dark brown
          blue: "#7A6858",      // Harmonize legacy blue to warm slate brown
          teal: "#5A7365",      // Harmonize legacy teal
        },
        risk: {
          low: "#2E8B57",       // SeaGreen semantic low
          medium: "#E6A23C",    // Warm amber semantic medium
          high: "#C94C4C",      // Crimson semantic high
          critical: "#C94C4C",  // Crimson semantic critical
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
