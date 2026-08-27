import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Repeat, Volume2, VolumeX } from 'lucide-react';
import VideoTemplate, { SCENE_DURATIONS } from './VideoTemplate';
import { useSceneControls } from './useSceneControls';

const SCENE_DETAILS: Record<string, { title: string; filePath: string }> = {
  hook: { title: 'Identità', filePath: 'src/components/video/video_scenes/Scene1.tsx' },
  observation: { title: 'Osservazione', filePath: 'src/components/video/video_scenes/Scene2.tsx' },
  decision: { title: 'Decision Engine', filePath: 'src/components/video/video_scenes/Scene3.tsx' },
  protection: { title: 'Protezione', filePath: 'src/components/video/video_scenes/Scene4.tsx' },
  close: { title: 'Chiusura', filePath: 'src/components/video/video_scenes/Scene5.tsx' },
};

const formatTime = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

export default function VideoWithControls() {
  const isIframed = typeof window !== 'undefined' && window.self !== window.top;
  if (!isIframed) return <VideoTemplate />;
  return <PreviewControls />;
}

function PreviewControls() {
  const controls = useSceneControls(SCENE_DURATIONS);
  const [muted, setMuted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const sensorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setElapsed(0);
    const started = performance.now();
    const timer = window.setInterval(() => setElapsed(performance.now() - started), 60);
    return () => window.clearInterval(timer);
  }, [controls.tick]);

  const jumpTo = useCallback((index: number) => {
    controls.jumpTo(index);
    const key = controls.sceneKeys[index];
    const details = SCENE_DETAILS[key];
    window.parent.postMessage({
      type: 'REPLIT_VIDEO_SCENE_SELECTED',
      payload: {
        sceneIndex: index,
        sceneCount: controls.sceneKeys.length,
        sceneTitle: details.title,
        filePath: details.filePath,
        lineNumber: 1,
      },
    }, '*');
  }, [controls]);

  const visible = !collapsed || hovering;
  const totalElapsed = Math.min(
    controls.totalDuration,
    controls.activeStartTime + Math.min(elapsed, controls.activeDuration),
  );

  return (
    <div className="relative w-full h-screen">
      <VideoTemplate
        key={controls.mountKey}
        durations={controls.durations}
        loop
        muted={muted}
        onSceneChange={controls.onSceneChange}
      />
      <div
        ref={sensorRef}
        className="absolute bottom-0 left-0 right-0 z-[100] flex h-1/4 flex-col justify-end"
        onPointerEnter={(event) => event.pointerType === 'mouse' && setHovering(true)}
        onPointerLeave={(event) => event.pointerType === 'mouse' && setHovering(false)}
      >
        <div className={`flex items-center gap-3 bg-black/60 px-5 py-4 backdrop-blur-md transition-all duration-200 ${visible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`}>
          <button className="flex h-14 w-14 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white" onClick={controls.toggleLock} aria-label="Ripeti scena" aria-pressed={controls.locked}>
            <Repeat className="h-8 w-8" />
          </button>
          <button className="flex h-14 w-14 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white" onClick={() => setMuted((value) => !value)} aria-label={muted ? 'Attiva audio' : 'Disattiva audio'}>
            {muted ? <VolumeX className="h-8 w-8" /> : <Volume2 className="h-8 w-8" />}
          </button>
          <div className="h-12 w-px bg-white/15" />
          <div className="flex flex-1 items-center gap-1.5">
            {controls.sceneKeys.map((key, index) => {
              const active = index === controls.activeIndex;
              const progress = active ? Math.min(100, elapsed / controls.activeDuration * 100) : 0;
              return (
                <button key={key} onClick={() => jumpTo(index)} className="relative h-3 flex-1 overflow-hidden rounded-full bg-white/20 hover:h-4" aria-label={`Vai alla scena ${index + 1}`}>
                  <span className="absolute inset-y-0 left-0 rounded-full bg-white/90" style={{ width: `${progress}%` }} />
                </button>
              );
            })}
          </div>
          <div className="font-mono text-xl text-white/60">{controls.activeIndex + 1}/{controls.sceneKeys.length}</div>
          <div className="min-w-[11ch] text-right font-mono text-xl text-white/80">{formatTime(totalElapsed)} / {formatTime(controls.totalDuration)}</div>
          <button className="flex h-14 w-14 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? 'Mostra controlli' : 'Nascondi controlli'}>
            {collapsed ? <ChevronUp className="h-10 w-10" /> : <ChevronDown className="h-10 w-10" />}
          </button>
        </div>
      </div>
    </div>
  );
}