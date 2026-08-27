import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { colors } from '../VideoTemplate';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 800),
      setTimeout(() => setPhase(2), 1600),
    ];
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center px-[8vw]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="mt-[12vh] flex flex-col items-center">
        <h1
          className="text-[3vw] font-bold leading-[1.1] tracking-tight text-center"
          style={{ color: colors.fg, fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {'Cockpit decisionale multi-asset.'.split(' ').map((word, i) => (
            <motion.span
              key={i}
              className="inline-block mr-[0.8vw]"
              initial={{ opacity: 0, y: 30, rotateX: -40 }}
              animate={phase >= 1 ? { opacity: 1, y: 0, rotateX: 0 } : { opacity: 0, y: 30, rotateX: -40 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: phase >= 1 ? i * 0.1 : 0 }}
            >
              {word}
            </motion.span>
          ))}
        </h1>
        <motion.div
          className="mt-[3vh] px-[1.5vw] py-[0.5vw] rounded-full border border-dashed"
          style={{ borderColor: colors.accent, backgroundColor: `${colors.accent}15` }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={phase >= 2 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.5, type: "spring", bounce: 0.4 }}
        >
          <span 
            className="text-[1vw] uppercase tracking-widest"
            style={{ color: colors.accent, fontFamily: "'DM Mono', monospace" }}
          >
            Solo simulazione
          </span>
        </motion.div>
      </div>
    </motion.div>
  );
}
