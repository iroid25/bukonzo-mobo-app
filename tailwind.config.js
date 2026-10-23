/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Configure the content for all of your files
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#10B981", // Main Green
        primaryDark: "#047857",
        primaryLight: "#D1FAE5",
        secondary: "#3B82F6",
        background: "#F9FAFB",
        surface: "#FFFFFF",
        // Premium Design Palette
        forest: "#0D3D2B",
        leaf: "#1A6B47",
        mint: "#2ECC8A",
        gold: "#F5C842",
        warmWhite: "#FDFBF7",
        textMid: "#4A6558",
        textLight: "#8FA99D",
        // Brand tokens from design.json
        saccoGreen: "#00C853",
        saccoDarkGreen: "#1B5E20",
        saccoLightGreen: "#E8F5E9",
      },
    },
  },
  plugins: [],
}
