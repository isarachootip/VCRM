/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        monday: {
          blue: "#0073ea",
          blueHover: "#0060b9",
          navy: "#1f2937",
          green: "#00c875",
          greenHover: "#00b368",
          orange: "#fdab3d",
          yellow: "#e2445c",
          red: "#df2f4a",
          purple: "#a25ddc",
          cyan: "#579bfc",
          grayText: "#676879",
          grayBg: "#f5f6f8",
          border: "#e6e9ef",
          darkNavy: "#292f4c",
        },
      },
    },
  },
  plugins: [],
};
