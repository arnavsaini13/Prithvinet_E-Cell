// Simplified world map outlines for continents
export function WorldMapSVG() {
  return (
    <g opacity="0.3" stroke="var(--prithvi-electric-cyan)" strokeWidth="0.15" fill="none">
      {/* North America */}
      <path d="M 15,25 L 18,22 L 22,20 L 26,22 L 28,25 L 30,28 L 28,32 L 25,35 L 22,36 L 20,38 L 18,36 L 16,33 L 15,30 Z" />
      
      {/* South America */}
      <path d="M 25,45 L 28,42 L 30,44 L 31,48 L 30,52 L 28,56 L 26,58 L 24,56 L 23,52 L 24,48 Z" />
      
      {/* Europe */}
      <path d="M 48,22 L 52,20 L 55,22 L 56,25 L 54,27 L 51,28 L 48,26 Z" />
      
      {/* Africa */}
      <path d="M 48,35 L 52,33 L 56,35 L 58,40 L 57,45 L 55,50 L 52,52 L 50,50 L 48,45 L 47,40 Z" />
      
      {/* Asia */}
      <path d="M 60,20 L 68,18 L 75,20 L 80,25 L 82,30 L 80,35 L 75,38 L 70,36 L 65,33 L 62,28 L 60,25 Z" />
      
      {/* Australia */}
      <path d="M 75,55 L 80,53 L 84,55 L 85,58 L 83,60 L 78,61 L 75,59 Z" />
      
      {/* Additional landmass details */}
      <path d="M 35,20 L 38,18 L 40,20 L 38,22 Z" opacity="0.5" />
      <path d="M 68,28 L 72,26 L 74,28 L 72,30 Z" opacity="0.5" />
      <path d="M 58,48 L 62,46 L 64,48 L 62,50 Z" opacity="0.5" />
    </g>
  );
}
