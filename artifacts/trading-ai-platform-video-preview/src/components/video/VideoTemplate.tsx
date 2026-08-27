import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';
import { LogoMark, WordMark } from './BrandAnchor';

export const SCENE_DURATIONS = {
  hook: 3500,
  observation: 4000,
  decision: 5000,
  protection: 4500,
  close: 4000,
};

// Global colors based on Trading AI Platform
export const colors = {
  bg: '#0E1521',
  fg: '#E1E7EF',
  primary: '#F5A623', // Gold
  accent: '#28B8B8', // Teal
  border: '#293241',
  muted: '#1A2433',
  destructive: '#E3645A',
};

const SCENE_START_SEC = Object.entries(SCENE_DURATIONS).reduce<Record<string, number>>((out, [key, ms]) => {
  out[key] = Object.values(out).length === 0
    ? 0
    : Object.keys(out).reduce((sum, previousKey) => sum + SCENE_DURATIONS[previousKey as keyof typeof SCENE_DURATIONS], 0) / 1000;
  return out;
}, {});

const SCENES = [Scene1, Scene2, Scene3, Scene4, Scene5];

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  muted = false,
  onSceneChange,
}: {
  durations?: Record<string, number>;
  loop?: boolean;
  muted?: boolean;
  onSceneChange?: (sceneKey: string) => void;
} = {}) {
  const { currentSceneKey } = useVideoPlayer({ durations, loop });
  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '');
  const sceneIndex = Object.keys(SCENE_DURATIONS).indexOf(baseSceneKey);
  const Scene = SCENES[sceneIndex];
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    onSceneChange?.(currentSceneKey);
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.45;
    const target = SCENE_START_SEC[baseSceneKey] ?? 0;
    if (Math.abs(audio.currentTime - target) > 0.18) audio.currentTime = target;
    audio.play().catch(() => {});
  }, [baseSceneKey, currentSceneKey, muted, onSceneChange]);

  return (
    <div
      className="relative w-full h-screen overflow-hidden"
      style={{ backgroundColor: colors.bg, fontFamily: "'Manrope', sans-serif" }}
    >
      {/* Persistent Background: Engineered Grid + Drifting Glows */}
      <motion.div
        className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(${colors.border} 1px, transparent 1px), linear-gradient(90deg, ${colors.border} 1px, transparent 1px)`,
          backgroundSize: '4vw 4vw',
          opacity: 0.3
        }}
        animate={{ backgroundPosition: ['0vw 0vw', '4vw 4vw'] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
      />
      
      {/* Teal Glow */}
      <motion.div
        className="absolute w-[50vw] h-[50vw] rounded-full blur-[80px]"
        style={{ background: `radial-gradient(circle, ${colors.accent}20, transparent 70%)` }}
        animate={{
          x: ['-10vw', '40vw', '10vw', '50vw', '20vw'][sceneIndex],
          y: ['10vh', '-10vh', '40vh', '10vh', '20vh'][sceneIndex],
        }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      />

      {/* Gold Glow */}
      <motion.div
        className="absolute w-[60vw] h-[60vw] rounded-full blur-[100px]"
        style={{ background: `radial-gradient(circle, ${colors.primary}15, transparent 70%)` }}
        animate={{
          x: ['40vw', '0vw', '60vw', '10vw', '40vw'][sceneIndex],
          y: ['40vh', '60vh', '10vh', '50vh', '40vh'][sceneIndex],
        }}
        transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
      />

      {/* Persistent Logo Anchor */}
      <motion.div
        className="absolute z-50 flex items-center gap-[1vw]"
        animate={{
           top: sceneIndex === 0 || sceneIndex === 4 ? '40vh' : '5vh',
           left: sceneIndex === 0 || sceneIndex === 4 ? '50vw' : '4vw',
           x: sceneIndex === 0 || sceneIndex === 4 ? '-50%' : '0%',
           scale: sceneIndex === 0 || sceneIndex === 4 ? 2.5 : 1,
        }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      >
        <LogoMark />
        <WordMark show />
      </motion.div>

      {/* Persistent Accent Line */}
      <motion.div
        className="absolute h-[2px]"
        style={{ backgroundColor: colors.accent, zIndex: 40 }}
        animate={{
          left: ['25vw', '4vw', '50vw', '4vw', '35vw'][sceneIndex],
          top: ['65vh', '15vh', '85vh', '88vh', '65vh'][sceneIndex],
          width: ['50vw', '25vw', '40vw', '92vw', '30vw'][sceneIndex],
          opacity: [0, 1, 1, 1, 0][sceneIndex],
        }}
        transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
      />

      <AnimatePresence mode="sync">
        {Scene && <Scene key={currentSceneKey} />}
      </AnimatePresence>
      <audio
        ref={audioRef}
        src={`${import.meta.env.BASE_URL}audio/bg_music.mp3`}
        preload="auto"
        autoPlay
        muted={muted}
      />
    </div>
  );
}