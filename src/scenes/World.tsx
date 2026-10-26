import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { story } from '../data/story';

type V3 = [number, number, number];
const rand = (a: number, b: number) => a + Math.random() * (b - a);

/* ---------- раскладка интерактивных объектов (ПК: в ряд, телефон: сеткой 2 колонки) ---------- */
export function layout(n: number, aspect: number) {
  const cols = aspect < 0.9 ? 2 : n;
  const rows = Math.ceil(n / cols);
  const gx = 2.4, gy = 2.6;
  const pts = Array.from({ length: n }, (_, i) => {
    const r = Math.floor(i / cols);
    const inRow = Math.min(cols, n - r * cols);
    const c = i % cols;
    const wave = cols === n ? Math.sin(i * 1.3) * 0.35 : 0;
    return [(c - (inRow - 1) / 2) * gx, ((rows - 1) / 2 - r) * gy + wave, 0] as V3;
  });
  return { pts, w: cols * gx + 1, h: rows * gy + 1.5 };
}

function frameFor(ch: number, aspect: number) {
  if (ch === 1) return layout(story.garden.items.length, aspect);
  if (ch === 2) return layout(story.compliments.items.length, aspect);
  if (ch === 3) return { w: 4.5, h: 4.5 };
  return { w: 4, h: 5 };
}

/* ---------- камера ---------- */
function Rig({ ch }: { ch: number }) {
  const { camera, size } = useThree();
  useEffect(() => {
    camera.position.x += ch % 2 ? 7 : -7; // плавный «пролёт» между сценами
    camera.position.z += 3;
  }, [ch, camera]);
  useFrame(({ pointer }, dt) => {
    const aspect = size.width / size.height;
    const f = frameFor(ch, aspect);
    const z = Math.max(f.w / (aspect * 0.933), f.h / 0.933) * 1.3;
    const k = 1 - Math.exp(-dt * 2.2);
    camera.position.x += (pointer.x * 0.7 - camera.position.x) * k;
    camera.position.y += (pointer.y * 0.5 - camera.position.y) * k;
    camera.position.z += (z - camera.position.z) * k;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

/* ---------- атмосфера: звёзды, лепестки, золотые искры ---------- */
function Stars({ count }: { count: number }) {
  const ref = useRef<THREE.Points>(null);
  const pos = useMemo(() => {
    const a = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = rand(25, 60), t = rand(0, 6.283), p = Math.acos(rand(-1, 1));
      a[i * 3] = r * Math.sin(p) * Math.cos(t);
      a[i * 3 + 1] = r * Math.cos(p);
      a[i * 3 + 2] = r * Math.sin(p) * Math.sin(t) - 10;
    }
    return a;
  }, [count]);
  useFrame((_, dt) => { ref.current!.rotation.y += dt * 0.01; });
  return (
    <points ref={ref}>
      <bufferGeometry><bufferAttribute attach="attributes-position" count={count} array={pos} itemSize={3} /></bufferGeometry>
      <pointsMaterial color="#ffeccc" size={0.22} sizeAttenuation transparent opacity={0.85} depthWrite={false} />
    </points>
  );
}

function Petals({ count }: { count: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const d = useMemo(() => Array.from({ length: count }, () => ({
    x: rand(-9, 9), y: rand(-7, 7), z: rand(-5, 3), s: rand(0.6, 1.3), v: rand(0.3, 0.8), ph: rand(0, 6.28), r: rand(0.5, 2),
  })), [count]);
  const o = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    d.forEach((p, i) => {
      p.y -= p.v * Math.min(dt, 0.1);
      if (p.y < -7) p.y = 7;
      o.position.set(p.x + Math.sin(t * 0.6 + p.ph) * 0.8, p.y, p.z);
      o.rotation.set(t * p.r + p.ph, t * p.r * 0.7, t * 0.5 + p.ph);
      o.scale.set(p.s, p.s * 1.5, p.s);
      o.updateMatrix();
      ref.current!.setMatrixAt(i, o.matrix);
    });
    ref.current!.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <circleGeometry args={[0.12, 10]} />
      <meshStandardMaterial color="#b3123f" emissive="#4a0620" side={THREE.DoubleSide} />
    </instancedMesh>
  );
}

function Sparks({ count }: { count: number }) {
  const ref = useRef<THREE.Points>(null);
  const pos = useMemo(() => {
    const a = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) { a[i * 3] = rand(-9, 9); a[i * 3 + 1] = rand(-6, 6); a[i * 3 + 2] = rand(-4, 3); }
    return a;
  }, [count]);
  useFrame((_, dt) => {
    const a = ref.current!.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) { a[i * 3 + 1] += Math.min(dt, 0.1) * 0.3; if (a[i * 3 + 1] > 6) a[i * 3 + 1] = -6; }
    ref.current!.geometry.attributes.position.needsUpdate = true;
  });
  return (
    <points ref={ref}>
      <bufferGeometry><bufferAttribute attach="attributes-position" count={count} array={pos} itemSize={3} /></bufferGeometry>
      <pointsMaterial color="#ffd27a" size={0.09} transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

function Atmosphere({ lite, finale }: { lite: boolean; finale: boolean }) {
  const m = finale ? 2.5 : 1;
  return (
    <>
      <Stars count={lite ? 250 : 1000} />
      <Petals count={Math.round((lite ? 16 : 45) * (finale ? 1.6 : 1))} />
      <Sparks count={Math.round((lite ? 30 : 100) * m)} />
    </>
  );
}

/* ---------- сердце ---------- */
let _heart: THREE.ExtrudeGeometry | null = null;
function heartGeo() {
  if (_heart) return _heart;
  const s = new THREE.Shape();
  s.moveTo(0.25, 0.25);
  s.bezierCurveTo(0.25, 0.25, 0.2, 0, 0, 0);
  s.bezierCurveTo(-0.3, 0, -0.3, 0.35, -0.3, 0.35);
  s.bezierCurveTo(-0.3, 0.55, -0.15, 0.77, 0.25, 0.95);
  s.bezierCurveTo(0.6, 0.77, 0.8, 0.55, 0.8, 0.35);
  s.bezierCurveTo(0.8, 0.35, 0.8, 0, 0.5, 0);
  s.bezierCurveTo(0.35, 0, 0.25, 0.25, 0.25, 0.25);
  _heart = new THREE.ExtrudeGeometry(s, { depth: 0.25, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.08, bevelSegments: 4, curveSegments: 24 });
  _heart.center();
  return _heart;
}

function HeartMesh({ color, glow }: { color: string; glow: number }) {
  return (
    <group rotation={[0, 0, Math.PI]}>
      <mesh geometry={heartGeo()}>
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={glow} roughness={0.35} metalness={0.15} />
      </mesh>
    </group>
  );
}

/* ---------- кликабельная обёртка: парение, наведение, ореол ---------- */
interface IProps {
  position?: V3; onClick?: () => void; opened?: boolean; phase?: number;
  swing?: number; pulse?: number; halo?: string; children: ReactNode;
}
function Interactive({ position = [0, 0, 0], onClick, opened, phase = 0, swing = 0.5, pulse = 0, halo = '#ff5c8a', children }: IProps) {
  const outer = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const [hov, setHov] = useState(false);
  useEffect(() => () => { document.body.style.cursor = ''; }, []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + phase;
    const o = outer.current!;
    o.position.y = position[1] + Math.sin(t * 1.2) * 0.1;
    const target = (hov ? 1.15 : 1) * (1 + Math.sin(t * 3) * 0.05 * pulse);
    o.scale.setScalar(o.scale.x + (target - o.scale.x) * 0.15);
    inner.current!.rotation.y = Math.sin(t * 0.7) * swing;
  });
  const handlers = onClick ? {
    onClick: (e: any) => { e.stopPropagation(); onClick(); },
    onPointerOver: (e: any) => { e.stopPropagation(); setHov(true); document.body.style.cursor = 'pointer'; },
    onPointerOut: () => { setHov(false); document.body.style.cursor = ''; },
  } : {};
  return (
    <group ref={outer} position={position} {...handlers}>
      <group ref={inner}>{children}</group>
      <mesh>
        <sphereGeometry args={[0.85, 16, 16]} />
        <meshBasicMaterial color={halo} transparent opacity={opened ? 0.04 : 0.16} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {opened && (
        <mesh position={[0, 1, 0]}>
          <octahedronGeometry args={[0.09]} />
          <meshBasicMaterial color="#ffd27a" />
        </mesh>
      )}
    </group>
  );
}

function BigHeart({ scale, glow }: { scale: number; glow: number }) {
  return (
    <group scale={scale}>
      <Interactive pulse={1} swing={0.4}>
        <HeartMesh color="#d81b60" glow={glow} />
        <pointLight color="#ff4d88" intensity={40} distance={14} />
      </Interactive>
    </group>
  );
}

/* ---------- Глава 2: волшебный сад ---------- */
function GardenVisual({ kind }: { kind: string }) {
  switch (kind) {
    case 'rose':
      return (
        <group>
          <mesh position={[0, -0.85, 0]}><cylinderGeometry args={[0.04, 0.05, 1.1, 8]} /><meshStandardMaterial color="#2e7d32" /></mesh>
          <mesh position={[0.18, -0.7, 0]} rotation={[0, 0, -0.9]} scale={[1, 0.5, 0.3]}><sphereGeometry args={[0.25, 10, 8]} /><meshStandardMaterial color="#388e3c" /></mesh>
          <mesh><torusKnotGeometry args={[0.2, 0.1, 64, 10, 2, 3]} /><meshStandardMaterial color="#c2185b" emissive="#7a0a3a" emissiveIntensity={0.6} roughness={0.4} /></mesh>
        </group>
      );
    case 'star':
      return (
        <mesh scale={[1, 1.3, 0.6]}><octahedronGeometry args={[0.55]} /><meshStandardMaterial color="#ffc94d" emissive="#ff9d00" emissiveIntensity={0.8} metalness={0.7} roughness={0.25} /></mesh>
      );
    case 'crystal':
      return (
        <mesh><icosahedronGeometry args={[0.6, 0]} /><meshStandardMaterial color="#b388ff" emissive="#6a2fd6" emissiveIntensity={0.6} flatShading transparent opacity={0.9} /></mesh>
      );
    default:
      return (
        <group>
          <mesh><sphereGeometry args={[0.45, 24, 24]} /><meshStandardMaterial color="#ffd6e0" emissive="#ff8fb0" emissiveIntensity={0.7} /></mesh>
          <mesh rotation={[1.2, 0.3, 0]}><torusGeometry args={[0.7, 0.03, 8, 48]} /><meshStandardMaterial color="#ffd27a" emissive="#ffb300" emissiveIntensity={0.8} /></mesh>
        </group>
      );
  }
}

function Garden({ seen, onPick }: { seen: number[]; onPick: (i: number) => void }) {
  const { size } = useThree();
  const { pts } = layout(story.garden.items.length, size.width / size.height);
  return (
    <>
      {story.garden.items.map((it, i) => (
        <Interactive key={i} position={pts[i]} phase={i * 1.7} swing={1.2} halo="#ffd27a" opened={seen.includes(i)} onClick={() => onPick(i)}>
          <GardenVisual kind={it.kind} />
        </Interactive>
      ))}
    </>
  );
}

/* ---------- Глава 3: пять сердец ---------- */
const HEART_COLORS = ['#e0245e', '#c2185b', '#9c27b0', '#e0a21a', '#ff5c8a'];
function Compliments({ seen, onPick }: { seen: number[]; onPick: (i: number) => void }) {
  const { size } = useThree();
  const { pts } = layout(story.compliments.items.length, size.width / size.height);
  return (
    <>
      {story.compliments.items.map((_, i) => {
        const c = HEART_COLORS[i % HEART_COLORS.length];
        const done = seen.includes(i);
        return (
          <Interactive key={i} position={pts[i]} phase={i * 1.3} pulse={1} halo={c} opened={done} onClick={() => onPick(i)}>
            <HeartMesh color={c} glow={done ? 1.1 : 0.5} />
          </Interactive>
        );
      })}
    </>
  );
}

/* ---------- Глава 4: конверт ---------- */
function Envelope({ open, onOpen }: { open: boolean; onOpen: () => void }) {
  const flap = useRef<THREE.Group>(null);
  const paper = useRef<THREE.Mesh>(null);
  const flapGeo = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-1.2, 0); s.lineTo(1.2, 0); s.lineTo(0, -0.95); s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false });
  }, []);
  useFrame((_, dt) => {
    const k = 1 - Math.exp(-dt * 3);
    const f = flap.current!;
    f.rotation.x += ((open ? Math.PI * 0.98 : 0) - f.rotation.x) * k;
    f.position.z = 0.06 - 0.14 * (f.rotation.x / (Math.PI * 0.98));
    const p = paper.current!;
    p.position.y += ((open && f.rotation.x > 1.6 ? 1.25 : 0) - p.position.y) * k;
  });
  return (
    <Interactive onClick={open ? undefined : onOpen} swing={0.25} halo="#ffd27a" opened={open}>
      <mesh position={[0, 0, 0]}><boxGeometry args={[2.4, 1.6, 0.1]} /><meshStandardMaterial color="#8c1a45" emissive="#3d0620" roughness={0.6} /></mesh>
      <mesh ref={paper}><planeGeometry args={[2, 1.4]} /><meshStandardMaterial color="#fff3dc" emissive="#5a4a30" emissiveIntensity={0.3} /></mesh>
      <group ref={flap} position={[0, 0.8, 0.06]}>
        <mesh geometry={flapGeo}><meshStandardMaterial color="#a8204f" emissive="#3d0620" roughness={0.6} /></mesh>
        <group position={[0, -0.6, 0.05]} scale={0.35}><HeartMesh color="#ffd27a" glow={0.6} /></group>
      </group>
    </Interactive>
  );
}

/* ---------- Сборка мира ---------- */
interface WProps {
  ch: number; lite: boolean; seen: number[]; onPick: (i: number) => void; env: boolean; onEnv: () => void;
}
export function World({ ch, lite, seen, onPick, env, onEnv }: WProps) {
  return (
    <>
      <ambientLight intensity={0.6} color="#d9b8ff" />
      <directionalLight position={[3, 5, 6]} intensity={1.3} color="#ffd9e6" />
      <Atmosphere lite={lite} finale={ch === 4} />
      <Rig ch={ch} />
      {ch === 0 && <BigHeart scale={2.2} glow={0.7} />}
      {ch === 1 && <Garden seen={seen} onPick={onPick} />}
      {ch === 2 && <Compliments seen={seen} onPick={onPick} />}
      {ch === 3 && <Envelope open={env} onOpen={onEnv} />}
      {ch === 4 && <BigHeart scale={2.8} glow={1.2} />}
    </>
  );
}
