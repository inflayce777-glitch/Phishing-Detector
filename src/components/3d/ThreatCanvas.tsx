'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Line, Text, Grid, useGLTF } from '@react-three/drei';
import { useRef, useMemo, useState, useEffect, Suspense } from 'react';
import * as THREE from 'three';

interface NodeData {
  id: string;
  position: [number, number, number];
  color: string;
  trigger: string;
  score: number;
  explanation?: string;
}

// Shared geometry to avoid GPU reallocation stutters
const sharedParticleGeo = new THREE.SphereGeometry(0.07, 8, 8);
const sharedHitGeo = new THREE.SphereGeometry(1.0, 16, 16);

function CameraRig({ selectedPos }: { selectedPos: THREE.Vector3 | null }) {
  const { camera, controls } = useThree();
  const isTransitioning = useRef(true);

  useEffect(() => {
    // When selectedPos changes, trigger smooth camera lerp
    isTransitioning.current = true;
  }, [selectedPos]);

  useFrame(() => {
    if (!controls) return;
    const ctrl = controls as any;

    if (isTransitioning.current) {
      const targetCenter = selectedPos || new THREE.Vector3(0, 0, 0);
      const targetCam = selectedPos 
        ? new THREE.Vector3(selectedPos.x + 2.2, selectedPos.y + 1.8, selectedPos.z + 3.8)
        : new THREE.Vector3(0, 5.5, 9);

      ctrl.target.lerp(targetCenter, 0.08);
      camera.position.lerp(targetCam, 0.08);

      // Once within close range, release control back to user's mouse!
      if (
        ctrl.target.distanceTo(targetCenter) < 0.04 && 
        camera.position.distanceTo(targetCam) < 0.06
      ) {
        ctrl.target.copy(targetCenter);
        camera.position.copy(targetCam);
        isTransitioning.current = false;
      }
    }
  });

  return null;
}

function ModelNode({ type, trigger, selected, hovered }: { type: string, trigger?: string, selected: boolean, hovered: boolean }) {
  let modelPath = '/models/data_core.glb';
  
  if (type === 'shield' || type === 'safe_shield') {
    modelPath = '/models/cyber_shield.glb';
  } else if (type !== 'root' && trigger) {
    const tr = trigger.toLowerCase();
    if (tr.includes('терміновість')) modelPath = '/models/malware_urgency.glb';
    else if (tr.includes('авторитет')) modelPath = '/models/malware_authority.glb';
    else if (tr.includes('фінансова')) modelPath = '/models/malware_financial.glb';
    else if (tr.includes('шантаж')) modelPath = '/models/malware_blackmail.glb';
    else if (tr.includes('викрадення')) modelPath = '/models/malware_data_extraction.glb';
    else if (tr.includes('цікавість')) modelPath = '/models/malware_curiosity.glb';
    else if (tr.includes('прохання')) modelPath = '/models/malware_sympathy.glb';
    else modelPath = '/models/malware_payload.glb';
  }

  const { scene } = useGLTF(modelPath);
  
  // Clone scene and materials once to prevent memory leaks and garbage collection stutters
  const clone = useMemo(() => {
    const clonedScene = scene.clone();
    clonedScene.traverse((child) => {
      child.raycast = () => null;
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.material) {
          mesh.material = (mesh.material as THREE.Material).clone();
          const mat = mesh.material as THREE.MeshStandardMaterial;
          mat.roughness = 0.2;
          mat.metalness = 0.85;
        }
      }
    });
    return clonedScene;
  }, [scene]);

  // Update emissive intensity dynamically without re-cloning materials
  useEffect(() => {
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat && mat.emissive) {
          mat.emissiveIntensity = selected || hovered ? 8 : 4;
        }
      }
    });
  }, [clone, selected, hovered]);

  const scale = selected || hovered ? 1.25 : 0.85;
  return <primitive object={clone} scale={[scale, scale, scale]} />;
}

function ThreatNode({ 
  node, 
  onClick, 
  selected,
  isShield
}: { 
  node: NodeData; 
  onClick: (node: NodeData) => void;
  selected: boolean;
  isShield?: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const modelRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const spawnTime = useRef(0);

  useFrame((state) => {
    if (spawnTime.current === 0) spawnTime.current = state.clock.elapsedTime;
    const elapsed = state.clock.elapsedTime - spawnTime.current;
    
    // Entrance Animation (1 second)
    if (elapsed < 1.0) {
      const t = elapsed === 1.0 ? 1 : 1 - Math.pow(2, -10 * elapsed);
      
      if (groupRef.current) {
        if (node.id !== 'root') {
          groupRef.current.position.set(
            node.position[0] * t,
            node.position[1] * t,
            node.position[2] * t
          );
        }
        groupRef.current.scale.setScalar(t);
      }
      
      if (modelRef.current) {
        modelRef.current.rotation.y = state.clock.elapsedTime * 0.6 + node.position[0] + (1 - t) * 15;
      }
    } else {
      // Smooth idle rotation
      if (groupRef.current && groupRef.current.scale.x !== 1) {
        groupRef.current.position.set(...node.position);
        groupRef.current.scale.setScalar(1);
      }
      if (modelRef.current && !selected) {
        modelRef.current.rotation.y = state.clock.elapsedTime * 0.5 + node.position[0];
        modelRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.5 + node.position[2]) * 0.08;
      }
    }
  });

  let nodeType = 'safe';
  if (isShield) nodeType = 'shield';
  else if (node.id === 'root') nodeType = 'root';
  else if (node.score >= 0.5) nodeType = 'danger';

  return (
    <group 
      ref={groupRef} 
      position={node.position} 
      onClick={(e) => { e.stopPropagation(); onClick(node); }}
      onPointerEnter={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
      onPointerLeave={(e) => { setHovered(false); document.body.style.cursor = 'auto'; }}
    >
      <group ref={modelRef}>
        <ModelNode type={nodeType} trigger={node.trigger} selected={selected} hovered={hovered} />
      </group>
      
      {/* Invisible sphere for reliable raycast hit-testing */}
      <mesh geometry={sharedHitGeo} scale={selected || hovered ? 1.35 : 1.1}>
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <Text
        position={[0, -1.05, 0]}
        fontSize={0.22}
        color={node.color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.025}
        outlineColor="#0b1013"
      >
        {node.id === 'root' 
          ? (isShield ? 'СИСТЕМА ЧИСТА: 0 ЗАГРОЗ' : node.trigger.toUpperCase()) 
          : `${node.trigger.toUpperCase()} ${(node.score * 100).toFixed(0)}%`}
      </Text>
    </group>
  );
}

function DataParticle({ start, end, color, speedMul = 1 }: { start: [number, number, number], end: [number, number, number], color: string, speedMul?: number }) {
  const ref = useRef<any>(null);
  const offset = useRef(Math.random()); 
  const speed = useRef((0.45 + Math.random() * 0.4) * speedMul);

  useFrame((state, delta) => {
    if (ref.current) {
      offset.current += delta * speed.current;
      if (offset.current > 1) offset.current = 0; 
      ref.current.position.x = start[0] + (end[0] - start[0]) * offset.current;
      ref.current.position.y = start[1] + (end[1] - start[1]) * offset.current;
      ref.current.position.z = start[2] + (end[2] - start[2]) * offset.current;
    }
  });

  return (
    <mesh ref={ref} geometry={sharedParticleGeo}>
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
}

function ThreatEdge({ 
  start, 
  end, 
  color, 
  selected 
}: { 
  start: [number, number, number], 
  end: [number, number, number], 
  color: string, 
  selected: boolean 
}) {
  const lineRef = useRef<any>(null);
  const spawnTime = useRef(0);
  
  useFrame((state) => {
    if (spawnTime.current === 0) spawnTime.current = state.clock.elapsedTime;
    const elapsed = state.clock.elapsedTime - spawnTime.current;
    
    if (lineRef.current && lineRef.current.material) {
      if (elapsed < 1.0) {
        const opacityTarget = selected ? 0.95 : 0.45;
        lineRef.current.material.opacity = Math.max(0, elapsed - 0.2) * opacityTarget;
      } else {
        lineRef.current.material.opacity = selected ? 0.95 : 0.45;
      }
    }
  });

  return (
    <group>
      <Line
        ref={lineRef}
        points={[start, end]}
        color={color}
        lineWidth={selected ? 4 : 2}
        transparent
      />
      <DataParticle start={start} end={end} color={color} speedMul={1.1} />
      <DataParticle start={start} end={end} color="#ffffff" speedMul={0.9} />
    </group>
  );
}

function RadarPulse({ color = '#00f3ff' }: { color?: string }) {
  const ringRef1 = useRef<THREE.Mesh>(null);
  const ringRef2 = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t1 = (state.clock.elapsedTime * 0.7) % 2.5;
    const p1 = t1 / 2.5;
    if (ringRef1.current) {
      const scale1 = 1 + p1 * 7;
      ringRef1.current.scale.set(scale1, scale1, 1);
      (ringRef1.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (1 - p1) * 0.35);
    }

    const t2 = ((state.clock.elapsedTime * 0.7) + 1.25) % 2.5;
    const p2 = t2 / 2.5;
    if (ringRef2.current) {
      const scale2 = 1 + p2 * 7;
      ringRef2.current.scale.set(scale2, scale2, 1);
      (ringRef2.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (1 - p2) * 0.25);
    }
  });

  return (
    <group position={[0, -1.95, 0]}>
      <mesh ref={ringRef1} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.9, 1.05, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.35} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={ringRef2} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.9, 1.05, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.25} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

// Preload models
useGLTF.preload('/models/data_core.glb');
useGLTF.preload('/models/malware_payload.glb');
useGLTF.preload('/models/cyber_shield.glb');
useGLTF.preload('/models/malware_urgency.glb');
useGLTF.preload('/models/malware_authority.glb');
useGLTF.preload('/models/malware_financial.glb');
useGLTF.preload('/models/malware_blackmail.glb');
useGLTF.preload('/models/malware_data_extraction.glb');
useGLTF.preload('/models/malware_curiosity.glb');
useGLTF.preload('/models/malware_sympathy.glb');

export default function ThreatCanvas({ 
  vectors,
  onNodeClick,
  riskScore = 0,
  activeNode,
  autoRotate = true
}: { 
  vectors: any[];
  onNodeClick?: (node: any) => void;
  riskScore?: number;
  activeNode?: any;
  autoRotate?: boolean;
}) {
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);

  const isHighRisk = riskScore > 60;
  const isSafe = riskScore <= 30 && vectors.length === 0;

  const bgColor = isHighRisk ? '#180709' : (isSafe ? '#081412' : '#0b1013');
  const ambientColor = isHighRisk ? '#ffcccc' : (isSafe ? '#bbf7d0' : '#ffffff');
  const directionalColor = isHighRisk ? '#ff4444' : (isSafe ? '#34d399' : '#ffffff');
  const gridColor = isHighRisk ? '#ff5252' : (isSafe ? '#10b981' : '#6ce5dc');
  const pulseColor = isHighRisk ? '#ff003c' : (isSafe ? '#10b981' : '#00f3ff');

  const rootNode: NodeData = useMemo(() => {
    if (vectors.length === 0 && !isHighRisk) {
      return {
        id: 'root',
        position: [0, 0, 0],
        color: '#10b981',
        trigger: 'ВЕРИФІКОВАНО',
        score: 0,
        explanation: 'Система провела повний семантичний, лексичний та інфраструктурний аналіз: аномалій або фішингових векторів не виявлено.',
      };
    }
    return {
      id: 'root',
      position: [0, 0, 0],
      color: isHighRisk ? '#ff4444' : '#829398',
      trigger: 'ДЖЕРЕЛО',
      score: 1,
      explanation: 'Початкове повідомлення. Натисніть на інші вузли для деталізації ознак.',
    };
  }, [vectors.length, isHighRisk]);

  const childNodes: NodeData[] = useMemo(() => {
    return vectors.map((vec, i) => {
      const angle = (i / vectors.length) * Math.PI * 2;
      const radius = 6.5; 
      return {
        ...vec,
        position: [
          Math.cos(angle) * radius,
          (Math.sin(i * 1.5)) * 1.2,
          Math.sin(angle) * radius,
        ] as [number, number, number],
      };
    });
  }, [vectors]);

  const allNodes = useMemo(() => [rootNode, ...childNodes], [rootNode, childNodes]);

  useEffect(() => {
    if (!activeNode) {
      setSelectedNode(null);
    } else {
      const found = allNodes.find(n => n.id === activeNode.id);
      if (found) setSelectedNode(found);
    }
  }, [activeNode, allNodes]);

  const selectedPos = selectedNode ? new THREE.Vector3(...selectedNode.position) : null;

  const handlePointerMissed = () => {
    setSelectedNode(null);
    if (onNodeClick) onNodeClick(null);
  };

  const handleNodeClick = (node: NodeData) => {
    setSelectedNode(node);
    if (onNodeClick) onNodeClick(node);
  };

  return (
    <div style={{ height: '100%', width: '100%', background: 'var(--fx-bg)' }}>
      <Canvas 
        camera={{ position: [0, 5.5, 9], fov: 45 }}
        onPointerMissed={handlePointerMissed}
      >
        <color attach="background" args={[bgColor]} />
        <ambientLight intensity={1.6} color={ambientColor} />
        <directionalLight position={[10, 12, 10]} intensity={3} color={directionalColor} />
        <directionalLight position={[-10, -10, -10]} intensity={1.2} color={isHighRisk ? "#ff003c" : (isSafe ? "#10b981" : "#00f3ff")} />
        <pointLight position={[0, 0, 0]} intensity={2.5} color={pulseColor} distance={16} />
        
        <Suspense fallback={null}>
          <CameraRig selectedPos={selectedPos} />

          <Grid 
            infiniteGrid 
            fadeDistance={18} 
            sectionColor={gridColor} 
            cellColor={gridColor} 
            sectionSize={1} 
            cellSize={0.2} 
            position={[0, -2, 0]} 
            cellThickness={0.5} 
            sectionThickness={1}
            {...({
               opacity: isHighRisk ? 0.35 : (isSafe ? 0.25 : 0.18),
               transparent: true
            } as any)}
          />

          <RadarPulse color={pulseColor} />

          {childNodes.map((node) => (
            <ThreatEdge
              key={`edge-${node.id}`}
              start={rootNode.position}
              end={node.position}
              color={node.color}
              selected={selectedNode?.id === node.id}
            />
          ))}

          {allNodes.map((node) => (
            <ThreatNode 
              key={node.id} 
              node={node} 
              onClick={handleNodeClick}
              selected={selectedNode?.id === node.id}
              isShield={node.id === 'root' && isSafe}
            />
          ))}
        </Suspense>

        <OrbitControls
          makeDefault
          autoRotate={autoRotate && !selectedNode}
          autoRotateSpeed={0.9}
          enableDamping
          dampingFactor={0.06}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 2.15}
          minDistance={3}
          maxDistance={16}
        />
      </Canvas>
    </div>
  );
}
