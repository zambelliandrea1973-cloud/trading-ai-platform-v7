import { motion } from 'framer-motion';
import { colors } from './VideoTemplate';

export function LogoMark() {
  return (
    <div className="relative w-[2vw] h-[2vw] shrink-0">
      <svg viewBox="0 0 100 100" fill="none" className="w-full h-full">
        {/* Background rounded rect */}
        <motion.rect 
          width="100" height="100" rx="20" 
          fill={colors.primary} 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
        {/* The 'V' and Slash graphic */}
        <motion.path 
          d="M 25 30 L 50 75 L 60 55 M 50 75 L 75 30" 
          stroke={colors.bg} 
          strokeWidth="10" 
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
        />
        {/* The AI node (dot) */}
        <motion.circle 
          cx="75" cy="30" r="6" 
          fill={colors.bg}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, delay: 1.2, type: "spring" }}
        />
      </svg>
    </div>
  );
}

export function WordMark({ show = true }: { show?: boolean }) {
  return (
    <motion.div 
      className="flex flex-col justify-center overflow-hidden"
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: show ? 'auto' : 0, opacity: show ? 1 : 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <span 
        className="text-[1.2vw] font-bold leading-tight tracking-tight whitespace-nowrap"
        style={{ color: colors.fg, fontFamily: "'Space Grotesk', sans-serif" }}
      >
        VECTOR / AI
      </span>
      <span 
        className="text-[0.6vw] uppercase tracking-[0.2em] whitespace-nowrap"
        style={{ color: colors.accent, fontFamily: "'DM Mono', monospace" }}
      >
        paper cockpit
      </span>
    </motion.div>
  );
}
