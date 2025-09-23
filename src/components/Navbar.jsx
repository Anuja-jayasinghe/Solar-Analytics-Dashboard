import { useContext } from "react";
import { ThemeContext } from "./ThemeContext";

function Navbar() {
  const { theme, setTheme } = useContext(ThemeContext);

  const toggleTheme = () =>
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));

  return (
    <nav className="navbar">
      <h1>⚡ Solar Dashboard</h1>
      <button onClick={toggleTheme}>
        {theme === "dark" ? "Light Mode" : "Dark Mode"}
      </button>
    </nav>
  );
}

export default Navbar;
