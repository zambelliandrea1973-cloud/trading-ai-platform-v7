import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { colors } from '../VideoTemplate';

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1000),
      setTimeout(() => setPhase(3), 1600),
      setTimeout(() => setPhase(4), 2200),
    ];
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  const dataPoints = [
    { label: "Dati Macro", top: "15%", left: "10%", delay: 0 },
    { label: "Fondamentali", top: "45%", left: "70%", delay: 0.15 },
    { label: "Analisi Tecnica", top: "75%", left: "20%", delay: 0.3 },
  ];

  return (
    <motion.div
      className="absolute inset-0 px-[8vw] pt-[18vh]"
      initial={{ clipPath: 'inset(100% 0 0 0)' }}
      animate={{ clipPath: 'inset(0% 0 0% 0)' }}
      exit={{ opacity: 0, x: '-5vw', filter: 'blur(10px)' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.h2
        className="text-[3.5vw] font-bold tracking-tight mb-[1vh]"
        style={{ color: colors.fg, fontFamily: "'Space Grotesk', sans-serif" }}
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        Osservazione e Ragionamento
      </motion.h2>
      <motion.p
        className="text-[1.2vw] max-w-[40vw]"
        style={{ color: '#94A3B8' }} // overriding to slate-400 for contrast
        initial={{ opacity: 0 }}
        animate={phase >= 1 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        Analisi multi-dimensionale sincronizzata in tempo reale.
      </motion.p>

      {/* SVG Data Visual */}
      <motion.div 
        className="absolute right-[8vw] top-[25vh] w-[45vw] h-[55vh]"
        initial={{ opacity: 0, scale: 0.9, x: 20 }}
        animate={phase >= 2 ? { opacity: 1, scale: 1, x: 0 } : { opacity: 0, scale: 0.9, x: 20 }}
        transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
      >
        <svg viewBox="0 0 800 500" className="w-full h-full overflow-visible">
          {/* Grid lines */}
          <path d="M 0 100 L 800 100 M 0 250 L 800 250 M 0 400 L 800 400" stroke={colors.border} strokeWidth="2" strokeDasharray="5,5" />
          
          {/* Line Chart 1 */}
          <motion.path 
            d="M 0 450 C 100 400, 200 480, 300 350 C 400 220, 500 300, 600 150 C 700 0, 800 100, 800 100" 
            fill="none" 
            stroke={colors.accent} 
            strokeWidth="4"
            initial={{ pathLength: 0 }}
            animate={phase >= 2 ? { pathLength: 1 } : { pathLength: 0 }}
            transition={{ duration: 2.0, ease: "easeInOut" }}
          />
          
          {/* Line Chart 2 (Gold) */}
          <motion.path 
            d="M 0 350 C 150 400, 250 200, 400 250 C 550 300, 650 150, 800 50" 
            fill="none" 
            stroke={colors.primary} 
            strokeWidth="3"
            initial={{ pathLength: 0 }}
            animate={phase >= 2 ? { pathLength: 1 } : { pathLength: 0 }}
            transition={{ duration: 2.5, ease: "easeInOut", delay: 0.2 }}
          />
          
          {/* Data Nodes */}
          {[
            { cx: 300, cy: 350 }, { cx: 600, cy: 150 }, { cx: 400, cy: 250 }
          ].map((point, i) => (
            <motion.circle 
              key={i} cx={point.cx} cy={point.cy} r="8" fill={colors.bg} stroke={i === 2 ? colors.primary : colors.accent} strokeWidth="4"
              initial={{ scale: 0 }}
              animate={phase >= 2 ? { scale: 1 } : { scale: 0 }}
              transition={{ delay: 1.0 + i * 0.3, type: "spring" }}
            />
          ))}
        </svg>

        {/* Callouts */}
        {dataPoints.map((dp, i) => (
          <motion.div
            key={i}
            className="absolute px-[1vw] py-[0.5vw] rounded border bg-[#0E1521]/80 backdrop-blur-md"
            style={{ borderColor: colors.border, top: dp.top, left: dp.left }}
            initial={{ opacity: 0, y: 15 }}
            animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
            transition={{ duration: 0.5, delay: dp.delay, ease: 'circOut' }}
          >
            <div className="flex items-center gap-[0.5vw]">
              <div className="w-[0.5vw] h-[0.5vw] rounded-full" style={{ backgroundColor: colors.accent }} />
              <span className="text-[0.9vw] uppercase tracking-wider font-semibold" style={{ color: colors.fg, fontFamily: "'DM Mono', monospace" }}>
                {dp.label}
              </span>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}
