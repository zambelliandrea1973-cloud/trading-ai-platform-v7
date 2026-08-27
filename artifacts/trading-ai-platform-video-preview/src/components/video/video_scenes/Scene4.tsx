import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { colors } from '../VideoTemplate';

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1000),
      setTimeout(() => setPhase(3), 1800),
    ];
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-between px-[10vw]"
      initial={{ clipPath: 'inset(0 0 100% 0)' }}
      animate={{ clipPath: 'inset(0 0 0% 0)' }}
      exit={{ opacity: 0, y: '5vh', filter: 'blur(10px)' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="w-[45vw]">
        <motion.h2 
          className="text-[3.5vw] font-bold tracking-tight mb-[2vh] leading-tight"
          style={{ color: colors.fg, fontFamily: "'Space Grotesk', sans-serif" }}
          initial={{ opacity: 0, x: -30 }}
          animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          Protezione e<br/>Disciplina Axi Select
        </motion.h2>
        <motion.p
          className="text-[1.4vw] mb-[4vh]"
          style={{ color: '#94A3B8' }}
          initial={{ opacity: 0 }}
          animate={phase >= 1 ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          Nessun ordine reale. Rischi strettamente calcolati prima di ogni decisione.
        </motion.p>
        
        <div className="space-y-[2vh]">
          {[
            { label: "MAX DRAWDOWN LIMIT", val: "8.0%" },
            { label: "EXPOSURE CAP", val: "42.0%" },
          ].map((stat, i) => (
            <motion.div 
              key={i}
              className="flex items-center justify-between border-b pb-[1vh]"
              style={{ borderColor: colors.border }}
              initial={{ opacity: 0, x: -20 }}
              animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
              transition={{ duration: 0.5, delay: 0.4 + i * 0.2 }}
            >
              <span className="text-[1.1vw] font-mono tracking-widest text-[#E1E7EF]">{stat.label}</span>
              <span className="text-[1.5vw] font-mono font-bold" style={{ color: colors.primary }}>{stat.val}</span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Visual representation: Risk Gauge / Shield */}
      <motion.div 
        className="relative w-[30vw] h-[30vw]"
        initial={{ opacity: 0, scale: 0.8, rotate: -20 }}
        animate={phase >= 3 ? { opacity: 1, scale: 1, rotate: 0 } : { opacity: 0, scale: 0.8, rotate: -20 }}
        transition={{ duration: 1.2, type: "spring", bounce: 0.4 }}
      >
        <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-2xl">
          {/* Outer Track */}
          <circle cx="100" cy="100" r="90" fill="none" stroke={colors.border} strokeWidth="12" strokeLinecap="round" strokeDasharray="420" strokeDashoffset="0" />
          
          {/* Animated Value Track */}
          <motion.circle 
            cx="100" cy="100" r="90" 
            fill="none" 
            stroke={colors.accent} 
            strokeWidth="12" 
            strokeLinecap="round" 
            strokeDasharray="565" 
            initial={{ strokeDashoffset: 565 }}
            animate={phase >= 3 ? { strokeDashoffset: 565 - (565 * 0.32) } : { strokeDashoffset: 565 }}
            transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
            style={{ rotate: "-90deg", transformOrigin: "center" }}
          />

          {/* Inner Shield Graphic */}
          <motion.path 
            d="M 100 40 L 140 55 L 140 100 C 140 130, 100 160, 100 160 C 100 160, 60 130, 60 100 L 60 55 Z" 
            fill="none" 
            stroke={colors.primary} 
            strokeWidth="6" 
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={phase >= 3 ? { pathLength: 1 } : { pathLength: 0 }}
            transition={{ duration: 1.5, ease: "easeInOut", delay: 0.5 }}
          />
          <text x="100" y="105" textAnchor="middle" fill={colors.fg} fontSize="14" fontFamily="monospace" fontWeight="bold" letterSpacing="2">SECURE</text>
        </svg>
      </motion.div>
    </motion.div>
  );
}
