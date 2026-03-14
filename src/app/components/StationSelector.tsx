import { motion } from "motion/react";
import { MapPin } from "lucide-react";
import type { Station } from "../../api/client";

interface StationSelectorProps {
  stations: Station[];
  selected: number | null; // null = "All Stations"
  onSelect: (stationId: number | null) => void;
}

export function StationSelector({ stations, selected, onSelect }: StationSelectorProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <MapPin className="w-4 h-4 prithvi-text-electric opacity-60" />
      <button
        onClick={() => onSelect(null)}
        className={`px-3 py-1.5 rounded-md text-xs font-mono tracking-wider transition-all border ${
          selected === null ? "prithvi-glow-electric" : ""
        }`}
        style={{
          background: selected === null ? "var(--prithvi-glass-bright)" : "var(--prithvi-glass)",
          borderColor: selected === null ? "var(--prithvi-border-bright)" : "var(--prithvi-border-dim)",
          color: selected === null ? "var(--prithvi-electric-cyan)" : "inherit",
        }}
      >
        ALL STATIONS
      </button>
      {stations.map((st) => (
        <button
          key={st.id}
          onClick={() => onSelect(st.id)}
          className={`px-3 py-1.5 rounded-md text-xs font-mono tracking-wider transition-all border ${
            selected === st.id ? "prithvi-glow-electric" : ""
          }`}
          style={{
            background: selected === st.id ? "var(--prithvi-glass-bright)" : "var(--prithvi-glass)",
            borderColor: selected === st.id ? "var(--prithvi-border-bright)" : "var(--prithvi-border-dim)",
            color: selected === st.id ? "var(--prithvi-electric-cyan)" : "inherit",
          }}
        >
          {st.name.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
