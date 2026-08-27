import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { colors } from '../VideoTemplate';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2000),
    ];
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center"
      initial={{ clipPath: 'inset(50% 0 50% 0)' }}
      animate={{ clipPath: 'inset(0% 0 0% 0)' }}
      exit={{ opacity: 0, scale: 0.96, filter: 'blur(10px)' }}
      transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
    >
      <motion.div
        className="absolute top-[15vh] text-center"
        initial={{ opacity: 0, y: -20 }}
        animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <h2 
          className="text-[3vw] font-bold tracking-tight mb-[1vh]"
          style={{ color: colors.fg, fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Motore Decisionale AI Spiegabile
        </h2>
        <p className="text-[1.2vw]" style={{ color: '#94A3B8' }}>
          Ragionamento trasparente, senza "black box".
        </p>
      </motion.div>

      {/* Background SVG Node Network */}
      <motion.div 
        className="absolute inset-0 z-0 flex items-center justify-center opacity-60"
        initial={{ opacity: 0 }}
        animate={phase >= 1 ? { opacity: 0.6 } : { opacity: 0 }}
        transition={{ duration: 1.0 }}
      >
        <svg viewBox="0 0 1000 600" className="w-[80vw] h-auto overflow-visible">
          {[
            {x1: 200, y1: 150, x2: 500, y2: 300},
            {x1: 200, y1: 450, x2: 500, y2: 300},
            {x1: 800, y1: 150, x2: 500, y2: 300},
            {x1: 800, y1: 450, x2: 500, y2: 300},
          ].map((line, i) => (
            <motion.line 
              key={i} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} 
              stroke={colors.accent} strokeWidth="2" strokeDasharray="5,5"
              initial={{ strokeDashoffset: 100 }}
              animate={{ strokeDashoffset: 0 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            />
          ))}
          {/* Central Node Glow */}
          <motion.circle 
            cx="500" cy="300" r="60" 
            fill={colors.accent} opacity="0.1" 
            animate={{ scale: [1, 1.5, 1], opacity: [0.1, 0.3, 0.1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        </svg>
      </motion.div>

      {/* Simulated UI Panel */}
      <motion.div
        className="relative z-10 w-[40vw] rounded-2xl border p-[2.5vw] bg-opacity-95 shadow-2xl backdrop-blur-xl"
        style={{ backgroundColor: colors.bg, borderColor: colors.border, boxShadow: `0 25px 50px -12px ${colors.accent}20` }}
        initial={{ opacity: 0, y: 60, scale: 0.9 }}
        animate={phase >= 2 ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 60, scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      >
        <div className="flex justify-between items-center mb-[2vw] border-b pb-[1vw]" style={{ borderColor: colors.border }}>
          <div>
            <span className="text-[0.9vw] uppercase tracking-wider text-[#94A3B8] font-mono block mb-[0.2vw]">Asset</span>
            <span className="text-[2.2vw] font-bold text-white font-mono leading-none">SPY</span>
          </div>
          <div className="text-right">
            <span className="text-[0.9vw] uppercase tracking-wider text-[#94A3B8] font-mono block mb-[0.2vw]">Decisione</span>
            <motion.span 
              className="text-[1.8vw] font-bold px-[1vw] py-[0.2vw] rounded"
              style={{ color: colors.accent, backgroundColor: `${colors.accent}20` }}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={phase >= 3 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }}
              transition={{ type: 'spring', bounce: 0.5, delay: 0.2 }}
            >
              LONG BIAS
            </motion.span>
          </div>
        </div>
        
        <div className="space-y-[1.5vw]">
          <div>
            <div className="flex justify-between mb-[0.5vw] text-[1vw] font-mono">
              <span style={{ color: '#94A3B8' }}>Confidenza modello</span>
              <span className="text-white">84%</span>
            </div>
            <div className="h-[0.6vw] w-full rounded-full overflow-hidden" style={{ backgroundColor: colors.border }}>
              <motion.div 
                className="h-full rounded-full" 
                style={{ backgroundColor: colors.primary, originX: 0 }}
                initial={{ scaleX: 0 }}
                animate={phase >= 3 ? { scaleX: 0.84 } : { scaleX: 0 }}
                transition={{ duration: 0.8, ease: "easeOut", delay: 0.4 }}
              />
            </div>
          </div>

          <motion.div 
            className="p-[1vw] rounded border border-dashed"
            style={{ borderColor: colors.border, backgroundColor: `${colors.border}40` }}
            initial={{ opacity: 0, y: 10 }}
            animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
            transition={{ duration: 0.5, delay: 0.8 }}
          >
            <span className="text-[0.85vw] font-mono uppercase tracking-widest block mb-[0.5vw]" style={{ color: colors.primary }}>Rationale Spiegabile</span>
            <p className="text-[1.1vw] leading-relaxed text-[#E1E7EF]">
              "Migliora l'ampiezza tecnica mentre il regime macro rimane a supporto. Rischio di downside limitato."
            </p>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}
