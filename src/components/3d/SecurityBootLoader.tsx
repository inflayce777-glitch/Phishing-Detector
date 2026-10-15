'use client';

import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { motion } from 'framer-motion';
import * as THREE from 'three';
import { Shield } from 'lucide-react';

interface SecurityBootLoaderProps {
  onComplete?: () => void;
  minDuration?: number; // duration in ms, default ~1400ms
}

function VaultDial({ progress, isUnlocked }: { progress: number; isUnlocked: boolean }) {
  const dialRef = useRef<THREE.Group>(null);
  const outerRingRef = useRef<THREE.Group>(null);
  const keyRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const shockwaveRef = useRef<THREE.Mesh>(null);

  // How many segments are lit (0 to 6)
  const litCount = Math.min(6, Math.floor((progress / 100) * 6.5));

  // 6 radial security segments inspired by SafeBrowse 2FA lock dial
  const segments = useMemo(() => {
    return Array.from({ length: 6 }).map((_, i) => {
      const angle = (i / 6) * Math.PI * 2;
      const radius = 1.85;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      return { id: i, angle, position: [x, y, 0] as [number, number, number] };
    });
  }, []);

  // Ambient cyber dust particles
  const particles = useMemo(() => {
    return Array.from({ length: 28 }).map((_, i) => {
      const r = 2.2 + Math.random() * 1.6;
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI;
      return {
        id: i,
        pos: [
          r * Math.cos(theta) * Math.cos(phi),
          r * Math.sin(phi),
          r * Math.sin(theta) * Math.cos(phi),
        ] as [number, number, number],
        size: 0.035 + Math.random() * 0.03,
      };
    });
  }, []);

  const cyanColor = useMemo(() => new THREE.Color('#6ce5dc'), []);
  const greenColor = useMemo(() => new THREE.Color('#3ddc97'), []);
  const purpleColor = useMemo(() => new THREE.Color('#9b8cff'), []);
  const darkColor = useMemo(() => new THREE.Color('#151b23'), []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;

    // Rotate dial with segments
    if (dialRef.current) {
      dialRef.current.rotation.z += dt * (isUnlocked ? 0.9 : 0.35);
      const targetScale = isUnlocked ? 1.12 : 1;
      dialRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.08);
    }

    // Rotate counter outer ring
    if (outerRingRef.current) {
      outerRingRef.current.rotation.z -= dt * 0.2;
    }

    // Central TorusKnot Key (spins on 2 axes)
    if (keyRef.current) {
      keyRef.current.rotation.y += dt * (isUnlocked ? 2.4 : 0.9);
      keyRef.current.rotation.x += dt * 0.45;
      const knotScale = 1 + Math.sin(t * 3.5) * 0.04 + (isUnlocked ? 0.12 : 0);
      keyRef.current.scale.set(knotScale, knotScale, knotScale);
    }

    // Core pulsing light
    if (coreRef.current) {
      const pulse = 1 + Math.sin(t * 6) * 0.12;
      coreRef.current.scale.set(pulse, pulse, pulse);
    }

    // Expanding shockwave pulse on unlock
    if (shockwaveRef.current && isUnlocked) {
      shockwaveRef.current.scale.addScalar(dt * 7);
      const mat = shockwaveRef.current.material as THREE.MeshBasicMaterial;
      if (mat.opacity > 0) {
        mat.opacity = Math.max(0, mat.opacity - dt * 2);
      }
    }
  });

  const activeColor = isUnlocked ? greenColor : (progress > 55 ? cyanColor : purpleColor);

  return (
    <group>
      {/* Ambient lighting */}
      <ambientLight intensity={1.2} />
      <pointLight position={[5, 5, 6]} intensity={2.5} color="#ffffff" />
      <pointLight position={[-5, -4, 4]} intensity={2} color={activeColor} />

      {/* 1. Main Rotating Dial Group with 6 Segments */}
      <group ref={dialRef}>
        {/* Inner Torus Ring */}
        <mesh>
          <torusGeometry args={[1.85, 0.026, 12, 100]} />
          <meshBasicMaterial color={activeColor} transparent opacity={0.8} />
        </mesh>

        {/* Middle Torus Ring */}
        <mesh>
          <torusGeometry args={[2.15, 0.014, 8, 100]} />
          <meshBasicMaterial color={darkColor} transparent opacity={0.5} />
        </mesh>

        {/* 6 Radial Security Vault Blocks (Segments) */}
        {segments.map((seg, idx) => {
          const isLit = idx < litCount || isUnlocked;
          const segColor = isUnlocked ? greenColor : (isLit ? cyanColor : darkColor);
          return (
            <group key={seg.id} position={seg.position} rotation={[0, 0, seg.angle]}>
              <mesh>
                <boxGeometry args={[0.52, 0.38, 0.22]} />
                <meshStandardMaterial
                  color={segColor}
                  emissive={segColor}
                  emissiveIntensity={isLit ? 0.7 : 0.05}
                  roughness={0.25}
                  metalness={0.75}
                  transparent
                  opacity={isLit ? 0.95 : 0.35}
                />
              </mesh>
              {/* Outer Wireframe edge for segment */}
              <lineSegments>
                <edgesGeometry args={[new THREE.BoxGeometry(0.54, 0.4, 0.24)]} />
                <lineBasicMaterial
                  color={isLit ? activeColor : '#334155'}
                  transparent
                  opacity={isLit ? 0.9 : 0.25}
                />
              </lineSegments>
            </group>
          );
        })}
      </group>

      {/* 2. Counter-rotating Outer Data Ring */}
      <group ref={outerRingRef}>
        <mesh>
          <torusGeometry args={[2.55, 0.018, 8, 100]} />
          <meshBasicMaterial color={activeColor} transparent opacity={0.4} />
        </mesh>
      </group>

      {/* 3. Central Cryptographic Key (TorusKnot Wireframe + Glowing Mesh) */}
      <group>
        <mesh ref={keyRef}>
          <torusKnotGeometry args={[0.62, 0.16, 120, 16, 2, 3]} />
          <meshStandardMaterial
            color={activeColor}
            emissive={activeColor}
            emissiveIntensity={isUnlocked ? 0.85 : 0.45}
            wireframe
            roughness={0.2}
            metalness={0.8}
          />
        </mesh>

        {/* Inner solid glowing pulse core */}
        <mesh ref={coreRef}>
          <icosahedronGeometry args={[0.3, 2]} />
          <meshBasicMaterial color={activeColor} transparent opacity={0.85} />
        </mesh>
      </group>

      {/* 4. Shockwave ring on unlock */}
      {isUnlocked && (
        <mesh ref={shockwaveRef} rotation={[0, 0, 0]}>
          <ringGeometry args={[0.9, 1.05, 64]} />
          <meshBasicMaterial color={greenColor} transparent opacity={0.9} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* 5. Floating ambient security particles */}
      {particles.map((p) => (
        <mesh key={p.id} position={p.pos}>
          <sphereGeometry args={[p.size, 8, 8]} />
          <meshBasicMaterial color={activeColor} transparent opacity={0.55} />
        </mesh>
      ))}
    </group>
  );
}

export function SecurityBootLoader({ onComplete, minDuration = 1400 }: SecurityBootLoaderProps) {
  const [progress, setProgress] = useState(0);
  const [isUnlocked, setIsUnlocked] = useState(false);

  useEffect(() => {
    const startTime = performance.now();

    const frame = (now: number) => {
      const elapsed = now - startTime;
      const rawPct = Math.min(100, Math.floor((elapsed / minDuration) * 100));
      setProgress(rawPct);

      if (rawPct >= 100) {
        setIsUnlocked(true);
        // Short pause to show unlock visual shockwave before dismiss
        const timer = setTimeout(() => {
          if (onComplete) onComplete();
        }, 250);
        return () => clearTimeout(timer);
      } else {
        requestAnimationFrame(frame);
      }
    };

    const animId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animId);
  }, [minDuration, onComplete]);

  // Stage indicator message based on boot progress
  const getBootStep = (pct: number) => {
    if (pct < 20) return '[1/6] Ініціалізація нейромережевого ядра DeBERTa & BiLSTM...';
    if (pct < 40) return '[2/6] Завантаження матриць синтаксичних та семантичних ознак...';
    if (pct < 60) return '[3/6] Підключення репутаційних баз Safe Browsing та URLhaus...';
    if (pct < 80) return '[4/6] Калібрування евристичного модуля виявлення обфускації...';
    if (pct < 98) return '[5/6] Верифікація криптографічних підписів SPF, DKIM та DMARC...';
    return '[6/6] Криптографічний шлюз активовано. Запуск системи...';
  };

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      transition={{ duration: 0.4, ease: 'easeInOut' }}
      className="fixed inset-0 flex flex-col items-center justify-center bg-[#0b1013] z-[9999] select-none overflow-hidden"
    >
      {/* Background ambient radial glow */}
      <div 
        className="absolute w-[500px] h-[500px] rounded-full pointer-events-none blur-3xl opacity-20"
        style={{
          background: isUnlocked
            ? 'radial-gradient(circle, #3ddc97 0%, transparent 70%)'
            : progress > 50
              ? 'radial-gradient(circle, #6ce5dc 0%, transparent 70%)'
              : 'radial-gradient(circle, #9b8cff 0%, transparent 70%)',
          transition: 'background 0.5s ease',
        }}
      />

      {/* 3D WebGL Canvas */}
      <div className="w-[280px] h-[280px] sm:w-[320px] sm:h-[320px] relative">
        <Canvas camera={{ position: [0, 0, 5.8], fov: 50 }}>
          <VaultDial progress={progress} isUnlocked={isUnlocked} />
        </Canvas>
      </div>

      {/* HUD Info Block below 3D */}
      <div className="flex flex-col items-center gap-3 mt-4 text-center px-4 max-w-md z-10 font-mono">
        {/* Brand Title */}
        <div className="flex items-center gap-2 text-cyan-400 font-bold text-base sm:text-lg tracking-wider">
          <Shield className="w-5 h-5 text-cyan-400 shrink-0" />
          <span>Семантичний аналіз загроз</span>
        </div>

        {/* Dynamic Boot Step Text */}
        <div className="text-xs text-zinc-400 min-h-[20px] transition-colors duration-200">
          <span className={isUnlocked ? 'text-emerald-400 font-semibold' : 'text-zinc-300'}>
            {getBootStep(progress)}
          </span>
        </div>

        {/* Progress Bar & Percentage */}
        <div className="w-64 sm:w-80 flex flex-col gap-1.5 mt-1">
          <div className="h-1.5 w-full bg-zinc-900 border border-zinc-800 rounded-full overflow-hidden p-0.5">
            <motion.div
              className={`h-full rounded-full transition-all duration-150 ${
                isUnlocked
                  ? 'bg-emerald-400 shadow-[0_0_12px_rgba(61,220,151,0.8)]'
                  : progress > 50
                    ? 'bg-cyan-400 shadow-[0_0_10px_rgba(108,229,220,0.6)]'
                    : 'bg-purple-400 shadow-[0_0_10px_rgba(155,140,255,0.6)]'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-[10px] text-zinc-500 font-mono px-0.5">
            <span>Шлюз безпеки WebGL</span>
            <span className={isUnlocked ? 'text-emerald-400 font-bold' : 'text-cyan-400'}>
              [ {progress}% ]
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
