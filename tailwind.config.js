/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./services/**/*.{js,ts,jsx,tsx}",
        "./src/**/*.{js,ts,jsx,tsx}"
    ],
    darkMode: 'class', // App.tsx toggles 'dark' class on logic
    theme: {
        extend: {
            colors: {
                gold: {
                    dark: '#B8860B',
                    light: '#DAA520',
                }
            }
        },
    },
    plugins: [],
}
