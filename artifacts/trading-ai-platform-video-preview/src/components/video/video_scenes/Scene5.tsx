import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { colors } from '../VideoTemplate';

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 600),
      setTimeout(() => setPhase(2), 1500),
    ];
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center text-center"
      initial={{ clipPath: 'circle(0% at 50% 50%)' }}
      animate={{ clipPath: 'circle(150% at 50% 50%)' }}
      exit={{ opacity: 0, scale: 0.9, filter: 'blur(15px)' }}
      transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="absolute top-[20vh] w-full text-center">
        <motion.p
          className="text-[1.4vw] uppercase tracking-[0.3em] font-mono"
          style={{ color: colors.primary }}
          initial={{ opacity: 0, y: 10 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          Rigore istituzionale
        </motion.p>
        <motion.p
          className="text-[2vw] font-bold mt-[1vh]"
          style={{ color: colors.fg, fontFamily: "'Space Grotesk', sans-serif" }}
          initial={{ opacity: 0, y: 10 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
        >
          Ambiente paper-only.
        </motion.p>
      </div>

      {/* 
        The Logo Anchor handles the visual logo in the center.
        We just provide the sub-text that fades in below the anchor.
      */}
      <div className="mt-[20vh]">
        <motion.p
          className="text-[1.2vw] tracking-widest uppercase mb-[3vh]"
          style={{ color: '#94A3B8', fontFamily: "'DM Mono', monospace" }}
          initial={{ opacity: 0, letterSpacing: '0.1em' }}
          animate={phase >= 2 ? { opacity: 1, letterSpacing: '0.3em' } : { opacity: 0, letterSpacing: '0.1em' }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          Trading AI Platform V7
        </motion.p>
        
        <motion.div
          className="mx-auto max-w-[40vw]"
          initial={{ opacity: 0 }}
          animate={phase >= 2 ? { opacity: 0.6 } : { opacity: 0 }}
          transition={{ duration: 1.0, delay: 0.5 }}
        >
          <p className="text-[0.8vw]" style={{ color: '#64748B' }}>
            Nessun rendimento garantito. Il sistema è progettato per scopi di analisi, ragionamento e simulazione operativa senza l'uso di capitale reale.
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
