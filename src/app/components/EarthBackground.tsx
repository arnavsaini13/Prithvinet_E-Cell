import { motion } from "motion/react";
import { useEffect, useState } from "react";

interface DataNode {
  id: number;
  x: number;
  y: number;
  type: 'sensor' | 'station' | 'satellite';
}

interface DataConnection {
  from: number;
  to: number;
}

export function EarthBackground() {
  const [nodes] = useState<DataNode[]>([
    { id: 1, x: 15, y: 25, type: 'sensor' },
    { id: 2, x: 35, y: 45, type: 'station' },
    { id: 3, x: 65, y: 35, type: 'satellite' },
    { id: 4, x: 80, y: 60, type: 'sensor' },
    { id: 5, x: 45, y: 70, type: 'station' },
    { id: 6, x: 25, y: 55, type: 'sensor' },
    { id: 7, x: 70, y: 20, type: 'satellite' },
    { id: 8, x: 50, y: 40, type: 'station' },
    { id: 9, x: 85, y: 40, type: 'sensor' },
    { id: 10, x: 20, y: 80, type: 'sensor' },
  ]);

  const [connections] = useState<DataConnection[]>([
    { from: 1, to: 2 },
    { from: 2, to: 8 },
    { from: 8, to: 3 },
    { from: 3, to: 9 },
    { from: 2, to: 6 },
    { from: 6, to: 5 },
    { from: 5, to: 4 },
    { from: 8, to: 7 },
    { from: 1, to: 10 },
  ]);

  const getNodePosition = (id: number) => {
    const node = nodes.find(n => n.id === id);
    return node ? { x: node.x, y: node.y } : { x: 0, y: 0 };
  };

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: 'var(--prithvi-deep-space)' }}>
      {/* Atmospheric gradient overlay */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, var(--prithvi-deep-space) 100%)',
        }}
      />

      {/* Central earth glow */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full"
        style={{
          background: 'radial-gradient(circle, var(--prithvi-ocean-blue) 0%, var(--prithvi-ocean-deep) 40%, transparent 70%)',
          opacity: 0.4,
        }}
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Rotating grid overlay */}
      <motion.div
        className="absolute inset-0"
        animate={{ rotate: 360 }}
        transition={{ duration: 200, repeat: Infinity, ease: "linear" }}
      >
        <svg className="w-full h-full opacity-10">
          {/* Latitude lines */}
          {[20, 40, 60, 80].map((y) => (
            <line
              key={`lat-${y}`}
              x1="0"
              y1={`${y}%`}
              x2="100%"
              y2={`${y}%`}
              stroke="var(--prithvi-electric-cyan)"
              strokeWidth="0.5"
              strokeDasharray="4 4"
            />
          ))}
          {/* Longitude lines */}
          {[20, 40, 60, 80].map((x) => (
            <line
              key={`lon-${x}`}
              x1={`${x}%`}
              y1="0"
              x2={`${x}%`}
              y2="100%"
              stroke="var(--prithvi-electric-cyan)"
              strokeWidth="0.5"
              strokeDasharray="4 4"
            />
          ))}
        </svg>
      </motion.div>

      {/* Data connection lines */}
      <svg className="absolute inset-0 w-full h-full">
        <defs>
          <linearGradient id="connectionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--prithvi-electric-cyan)" stopOpacity={0.1} />
            <stop offset="50%" stopColor="var(--prithvi-aurora-green)" stopOpacity={0.6} />
            <stop offset="100%" stopColor="var(--prithvi-electric-cyan)" stopOpacity={0.1} />
          </linearGradient>
        </defs>
        {connections.map((conn, idx) => {
          const from = getNodePosition(conn.from);
          const to = getNodePosition(conn.to);
          return (
            <motion.line
              key={`conn-${idx}`}
              x1={`${from.x}%`}
              y1={`${from.y}%`}
              x2={`${to.x}%`}
              y2={`${to.y}%`}
              stroke="url(#connectionGradient)"
              strokeWidth="1"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ 
                pathLength: [0, 1, 0],
                opacity: [0, 0.8, 0],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                delay: idx * 0.3,
                ease: "easeInOut",
              }}
            />
          );
        })}
      </svg>

      {/* Sensor nodes */}
      {nodes.map((node) => (
        <motion.div
          key={node.id}
          className="absolute"
          style={{
            left: `${node.x}%`,
            top: `${node.y}%`,
            transform: 'translate(-50%, -50%)',
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: node.id * 0.1 }}
        >
          {/* Pulsing ring */}
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              border: `2px solid ${
                node.type === 'satellite' 
                  ? 'var(--prithvi-electric-cyan)' 
                  : node.type === 'station'
                  ? 'var(--prithvi-aurora-green)'
                  : 'var(--prithvi-teal-bright)'
              }`,
              width: '40px',
              height: '40px',
              left: '-20px',
              top: '-20px',
            }}
            animate={{
              scale: [1, 2, 1],
              opacity: [0.6, 0, 0.6],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              delay: node.id * 0.2,
              ease: "easeOut",
            }}
          />
          
          {/* Node marker */}
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background: node.type === 'satellite' 
                ? 'var(--prithvi-electric-cyan)' 
                : node.type === 'station'
                ? 'var(--prithvi-aurora-green)'
                : 'var(--prithvi-teal-bright)',
              boxShadow: `0 0 15px ${
                node.type === 'satellite' 
                  ? 'var(--prithvi-cyan-glow)' 
                  : node.type === 'station'
                  ? 'var(--prithvi-aurora-glow)'
                  : 'var(--prithvi-cyan-glow)'
              }`,
            }}
          />
        </motion.div>
      ))}

      {/* Floating data particles */}
      {[...Array(30)].map((_, i) => (
        <motion.div
          key={`particle-${i}`}
          className="absolute w-1 h-1 rounded-full"
          style={{
            background: i % 3 === 0 
              ? 'var(--prithvi-aurora-green)' 
              : i % 2 === 0 
              ? 'var(--prithvi-electric-cyan)'
              : 'var(--prithvi-teal-bright)',
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            boxShadow: '0 0 4px currentColor',
          }}
          animate={{
            y: [0, -100, 0],
            x: [0, Math.random() * 50 - 25, 0],
            opacity: [0, 0.8, 0],
          }}
          transition={{
            duration: 10 + Math.random() * 10,
            repeat: Infinity,
            delay: Math.random() * 5,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Aurora-like gradient sweep */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, var(--prithvi-aurora-green) 50%, transparent 100%)',
          opacity: 0.1,
        }}
        animate={{
          x: ['-100%', '200%'],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "linear",
        }}
      />
    </div>
  );
}
