import { useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import LegalModal from "../modals/LegalModal";

export default function Footer() {
  const { theme, isDarkMode } = useTheme();
  const currentYear = new Date().getFullYear();
  const [legal, setLegal] = useState(null); // 'terms' | 'privacy' | null

  const linkStyle = { color: theme.accent.primary };
  const linkClass = "hover:opacity-80 transition font-semibold bg-transparent border-none p-0 cursor-pointer";

  return (
    <footer
      style={{
        background: theme.bg.primary,
        borderTop: `2px solid ${theme.accent.primary}`,
        color: theme.text.secondary,
        boxShadow: isDarkMode ? '0 -4px 20px rgba(0, 0, 0, 0.2)' : '0 -4px 20px rgba(59, 130, 246, 0.05)'
      }}
      className="mt-auto px-[40px] py-[20px] text-center text-[12px]"
    >
      <p className="m-0">
        © {currentYear} NUCash System | Jose Anjelo Abued, Ashley Gwyneth Cuevas, Jhustine Brylle Logronio |{" "}
        <button
          type="button"
          onClick={() => setLegal('terms')}
          style={linkStyle}
          className={linkClass}
        >
          Terms and Conditions
        </button>{" "}
        |{" "}
        <button
          type="button"
          onClick={() => setLegal('privacy')}
          style={linkStyle}
          className={linkClass}
        >
          Privacy Policy
        </button>
      </p>

      {legal && <LegalModal type={legal} onClose={() => setLegal(null)} />}
    </footer>
  );
}
