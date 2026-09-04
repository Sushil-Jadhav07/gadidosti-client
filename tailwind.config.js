/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#166534",
          dark: "#14532D",
          light: "#16A34A",
          50: "#F0FDF4",
          100: "#DCFCE7",
        },
        secondary: {
          DEFAULT: "#041E42",
          dark: "#02122B",
          light: "#0A2E5C",
        },
        tertiary: {
          DEFAULT: "#17D86B",
          dark: "#12B85A",
          light: "#4EE88A",
        },
        neutral: {
          DEFAULT: "#F8FAFC",
          50: "#F1F5F9",
          100: "#E2E8F0",
          200: "#CBD5E1",
          300: "#94A3B8",
          400: "#64748B",
          500: "#475569",
          600: "#334155",
          700: "#1E293B",
          800: "#0F172A",
          900: "#020617",
        },
        success: "#17D86B",
        warning: "#F59E0B",
        danger: "#EF4444",
        info: "#166534",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
      },
      fontFamily: {
        poppins: ['Poppins', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        xl: "12px",
        lg: "10px",
        md: "8px",
        sm: "6px",
        full: "9999px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)",
        "card-hover": "0 4px 12px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.04)",
        dropdown: "0 10px 40px rgba(0,0,0,0.12)",
        nav: "0 -2px 10px rgba(0,0,0,0.06)",
        "glow-blue": "0 0 20px rgba(22,101,52,0.2)",
        "glow-green": "0 0 20px rgba(23,216,107,0.2)",
        device: "0 0 30px rgba(0,0,0,0.08)",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "toast-in": {
          "0%": { transform: "translateY(-100px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "toast-out": {
          "0%": { transform: "translateY(0)", opacity: "1" },
          "100%": { transform: "translateY(-100px)", opacity: "0" },
        },
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        "bounce-in": {
          "0%": { transform: "scale(0)" },
          "60%": { transform: "scale(1.1)" },
          "100%": { transform: "scale(1)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-3px)" },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "10%, 30%, 50%": { transform: "translateX(-4px)" },
          "20%, 40%": { transform: "translateX(4px)" },
        },
        spin: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "page-enter": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "green-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(23,216,107,0.4)" },
          "50%": { boxShadow: "0 0 0 8px rgba(23,216,107,0)" },
        },
        "typing-dot": {
          "0%, 60%, 100%": { transform: "translateY(0)", opacity: "0.4" },
          "30%": { transform: "translateY(-4px)", opacity: "1" },
        },
      },
      animation: {
        shimmer: "shimmer 1.5s infinite linear",
        "toast-in": "toast-in 300ms ease-out forwards",
        "toast-out": "toast-out 300ms ease-out forwards",
        pulse: "pulse 1s infinite",
        "bounce-in": "bounce-in 500ms ease-out forwards",
        float: "float 2s infinite ease-in-out",
        shake: "shake 300ms ease-in-out",
        spin: "spin 1s infinite linear",
        "page-enter": "page-enter 250ms ease-out forwards",
        "slide-up": "slide-up 300ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "fade-in": "fade-in 200ms ease-out forwards",
        "green-pulse": "green-pulse 2s infinite",
        "typing-dot": "typing-dot 1.2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
