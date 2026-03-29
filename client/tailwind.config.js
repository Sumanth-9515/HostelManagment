/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    // This tells Tailwind to scan ALL files in ALL folders inside src/
    "./src/**/*.{js,ts,jsx,tsx}", 
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}