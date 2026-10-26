import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { story } from './data/story';
import { World } from './scenes/World';

const hasWebGL = () => {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
};

const initialLite = () => {
  try { const s = localStorage.getItem('lite'); if (s !== null) return s === '1'; } catch { /* ignore */ }
  const n = navigator as any;
  return (n.hardwareConcurrency || 8) <= 4 || (n.deviceMemory || 8) <= 4;
};

interface Modal { title?: string; text: string }

export default function App() {
  const [ch, setCh] = useState(0);
  const [lite, setLite] = useState(initialLite);
  const [seen, setSeen] = useState<Record<number, number[]>>({ 1: [], 2: [] });
  const [modal, setModal] = useState<Modal | null>(null);
  const [env, setEnv] = useState(false);
  const [letter, setLetter] = useState(false);
  const [music, setMusic] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const webgl = useRef(hasWebGL()).current;
  const ui = story.ui;

  useEffect(() => {
    if (!env) return;
    const t = setTimeout(() => setLetter(true), 2200);
    return () => clearTimeout(t);
  }, [env]);

  const go = (n: number) => { setModal(null); setEnv(false); setLetter(false); setCh(n); };
  const restart = () => { setSeen({ 1: [], 2: [] }); go(0); };
  const toggleLite = () => setLite((v) => { try { localStorage.setItem('lite', v ? '0' : '1'); } catch { /* ignore */ } return !v; });
  const toggleMusic = () => {
    const a = audio.current!;
    if (a.paused) { a.play().then(() => setPlaying(true)).catch(() => {}); } else { a.pause(); setPlaying(false); }
  };

  const pick = (i: number) => {
    setSeen((s) => ({ ...s, [ch]: s[ch].includes(i) ? s[ch] : [...s[ch], i] }));
    if (ch === 1) setModal({ title: story.garden.items[i].title, text: story.garden.items[i].text });
    else setModal({ text: story.compliments.items[i] });
  };

  const total = ch === 1 ? story.garden.items.length : story.compliments.items.length;
  const found = seen[ch]?.length ?? 0;
  const letterDelay = story.letter.paragraphs.length * 0.9 + 0.8;

  if (!webgl) {
    return (
      <div className="backdrop" style={{ position: 'fixed', overflowY: 'auto' }}>
        <div className="letter">
          <p style={{ opacity: 1, animation: 'none' }}>{ui.noWebgl}</p>
          <h2>{story.letter.greeting}</h2>
          {story.letter.paragraphs.map((t, i) => <p key={i} style={{ opacity: 1, animation: 'none' }}>{t}</p>)}
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <Canvas dpr={lite ? 1 : [1, 2]} gl={{ antialias: !lite, alpha: true }} camera={{ position: [0, 0, 8], fov: 50 }}>
        <World ch={ch} lite={lite} seen={seen[ch] ?? []} onPick={pick} env={env} onEnv={() => setEnv(true)} />
      </Canvas>
      <div key={ch} className="curtain" />

      <div className="topbar">
        <div className="dots" title={story.chapters[ch]}>
          {story.chapters.map((_, i) => <i key={i} className={i <= ch ? 'on' : ''} />)}
        </div>
        <div className="tools">
          {music && <button className={`chip ${playing ? 'active' : ''}`} onClick={toggleMusic}>♪</button>}
          <button className={`chip ${lite ? 'active' : ''}`} onClick={toggleLite}>{ui.lite}</button>
        </div>
      </div>
      <audio ref={audio} src={`${import.meta.env.BASE_URL}music.mp3`} loop preload="metadata" onLoadedMetadata={() => setMusic(true)} />

      {ch === 0 && (
        <div className="overlay fadein">
          <h1>{story.intro.title}</h1>
          <p className="sub">{story.intro.subtitle}</p>
          <button className="btn" onClick={() => go(1)}>{story.intro.button}</button>
        </div>
      )}

      {(ch === 1 || ch === 2) && (
        <div className="overlay">
          <h2>{story.chapters[ch]}</h2>
          <p className="sub">{ch === 1 ? story.garden.hint : story.compliments.hint}</p>
          <div className="counter">{ui.found}: {found} / {total}</div>
          {found === total && <button className="btn fadein" onClick={() => go(ch + 1)}>{ui.next}</button>}
        </div>
      )}

      {ch === 3 && !letter && (
        <div className="overlay">
          <h2>{story.chapters[3]}</h2>
          {!env && <p className="sub">{story.letter.hint}</p>}
        </div>
      )}

      {ch === 4 && (
        <div className="overlay fadein">
          <p className="finale-line">{story.finale.line}</p>
          <p className="sub">{story.finale.sub}</p>
          <button className="chip" onClick={restart}>{story.finale.restart}</button>
        </div>
      )}

      {modal && (
        <div className="backdrop" onClick={() => setModal(null)}>
          <div className="card" onClick={(e) => e.stopPropagation()}>
            {modal.title && <h2>{modal.title}</h2>}
            <p>{modal.text}</p>
            <button className="btn" onClick={() => setModal(null)}>{ui.close}</button>
          </div>
        </div>
      )}

      {letter && ch === 3 && (
        <div className="backdrop">
          <div className="letter">
            <h2>{story.letter.greeting}</h2>
            {story.letter.paragraphs.map((t, i) => <p key={i} style={{ animationDelay: `${i * 0.9}s` }}>{t}</p>)}
            <button className="btn" style={{ animationDelay: `${letterDelay}s` }} onClick={() => go(4)}>{ui.next}</button>
          </div>
        </div>
      )}
    </div>
  );
}
