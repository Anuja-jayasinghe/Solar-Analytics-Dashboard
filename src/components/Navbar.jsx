function Navbar() {

  return (
    <nav className="navbar">
      <h1 style={{ 
        color: "var(--accent)", 
        fontSize: "clamp(1.25rem, 4vw, 1.5rem)", 
        fontWeight: "bold",
        margin: 0
      }}>
        SolarEdge
      </h1>
    </nav>
  );
}

export default Navbar;
