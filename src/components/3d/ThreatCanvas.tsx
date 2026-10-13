'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Line, Text, Grid, useGLTF, Environment, Float } from '@react-three/drei';
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

function CameraRig({ selectedPos }: { selectedPos: THREE.Vector3 | null }) {
  const { camera, controls } = useThree();
  const vec = new THREE.Vector3();
  const spawnTime = useRef(0);
  
  useFrame((state) => {
    if (spawnTime.current === 0) {
      spawnTime.current = state.clock.elapsedTime;
      // Start camera higher for a swooping effect
      camera.position.set(0, 12, 12);
    }
    const elapsed = state.clock.elapsedTime - spawnTime.current;
    
    if (elapsed < 1.5 && !selectedPos) {
      camera.position.lerp(new THREE.Vector3(0, 6, 12), 0.04);
    } else if (selectedPos && controls) {
      const ctrl = controls as any;
      ctrl.target.lerp(selectedPos, 0.05);
      
      vec.copy(selectedPos).add(new THREE.Vector3(2, 2, 4));
      camera.position.lerp(vec, 0.05);
    } else if (!selectedPos && controls) {
      const ctrl = controls as any;
      ctrl.target.lerp(new THREE.Vector3(0, 0, 0), 0.05);
    }
  });
  return null;
}

function ModelNode({ type, trigger, color, selected, hovered }: { type: string, trigger?: string, color: string, selected: boolean, hovered: boolean }) {
  let modelPath = '/models/data_core.glb';
  
  if (type !== 'root' && trigger) {
    const tr = trigger.toLowerCase();
    if (tr.includes('терміновість')) modelPath = '/models/malware_urgency.glb';
    else if (tr.includes('авторитет')) modelPath = '/models/malware_authority.glb';
    else if (tr.includes('фінансова')) modelPath = '/models/malware_financial.glb';
    else if (tr.includes('шантаж')) modelPath = '/models/malware_blackmail.glb';
    else if (tr.includes('викрадення')) modelPath = '/models/malware_data_extraction.glb';
    else if (tr.includes('цікавість')) modelPath = '/models/malware_curiosity.glb';
    else if (tr.includes('прохання')) modelPath = '/models/malware_sympathy.glb';
    else modelPath = '/models/malware_payload.glb'; // fallback
  }

  const { scene } = useGLTF(modelPath);
  const clone = useMemo(() => scene.clone(), [scene, modelPath]);

  useMemo(() => {
    clone.traverse((child) => {
      // Disable raycasting on the complex model parts
      child.raycast = () => null;

      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.material) {
          mesh.material = (mesh.material as THREE.Material).clone();
          const mat = mesh.material as THREE.MeshStandardMaterial;
          
          // Boost emission on hover, but preserve the native Blender color!
          if (mat.emissive && (mat.emissive.r > 0 || mat.emissive.g > 0 || mat.emissive.b > 0)) {
             mat.emissiveIntensity = selected || hovered ? 8 : 4;
          }
          
          // Ensure it renders nicely
          mat.roughness = 0.2;
          mat.metalness = 0.8;
        }
      }
    });
  }, [clone, selected, hovered]);

  const scale = selected || hovered ? 1.2 : 0.8;
  return <primitive object={clone} scale={[scale, scale, scale]} />;
}

function ThreatNode({ 
  node, 
  onClick, 
  selected 
}: { 
  node: NodeData; 
  onClick: (node: NodeData) => void;
  selected: boolean;
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
      // Easing function (easeOutExpo)
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
        // Spin fast during entrance
        modelRef.current.rotation.y = state.clock.elapsedTime * 0.5 + node.position[0] + (1 - t) * 15;
      }
    } else {
      // Idle Animation
      if (groupRef.current && groupRef.current.scale.x !== 1) {
        groupRef.current.position.set(...node.position);
        groupRef.current.scale.setScalar(1);
      }
      if (modelRef.current && !selected) {
        modelRef.current.rotation.y = state.clock.elapsedTime * 0.5 + node.position[0];
        modelRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.5 + node.position[2]) * 0.1;
      }
    }
  });

  let nodeType = 'safe';
  if (node.id === 'root') nodeType = 'root';
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
        <ModelNode type={nodeType} trigger={node.trigger} color={node.color} selected={selected} hovered={hovered} />
      </group>
      
      {/* Invisible solid sphere to provide a reliable hit area for raycasting 
          and prevent flickering when hovering over wireframe gaps */}
      <mesh scale={selected || hovered ? 1.3 : 1.0}>
        <sphereGeometry args={[1.0, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <Text
        position={[0, -1.0, 0]}
        fontSize={0.2}
        color={node.color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#0b1013"
      >
        {node.id === 'root' ? node.trigger.toUpperCase() : `${node.trigger.toUpperCase()} ${(node.score * 100).toFixed(0)}%`}
      </Text>
    </group>
  );
}

function DataParticle({ start, end, color }: { start: [number, number, number], end: [number, number, number], color: string }) {
  const ref = useRef<any>(null);
  const offset = useRef(Math.random()); 
  const speed = useRef(0.4 + Math.random() * 0.4);

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
    <mesh ref={ref}>
      <sphereGeometry args={[0.06, 8, 8]} />
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
      // Fade in smoothly
      if (elapsed < 1.0) {
        const opacityTarget = selected ? 0.9 : 0.4;
        lineRef.current.material.opacity = Math.max(0, elapsed - 0.2) * opacityTarget;
      } else {
        lineRef.current.material.opacity = selected ? 0.9 : 0.4;
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
      {/* Пакетна передача "даних" вздовж лінії */}
      <DataParticle start={start} end={end} color={color} />
      <DataParticle start={start} end={end} color={color} />
      <DataParticle start={start} end={end} color="#ffffff" />
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
  activeNode
}: { 
  vectors: any[];
  onNodeClick?: (node: any) => void;
  riskScore?: number;
  activeNode?: any;
}) {
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);



  // Dynamic colors based on risk
  const isHighRisk = riskScore > 60;
  const bgColor = isHighRisk ? '#1c0909' : '#0b1013';
  const ambientColor = isHighRisk ? '#ffcccc' : '#ffffff';
  const directionalColor = isHighRisk ? '#ff4444' : '#ffffff';
  const gridColor = isHighRisk ? '#ff5252' : '#6ce5dc';

  const rootNode: NodeData = {
    id: 'root',
    position: [0, 0, 0],
    color: isHighRisk ? '#ff4444' : '#829398',
    trigger: 'ДЖЕРЕЛО',
    score: 1,
    explanation: 'Початкове повідомлення. Натисніть на інші вузли для деталізації ознак.',
  };

  const childNodes: NodeData[] = useMemo(() => {
    return vectors.map((vec, i) => {
      const angle = (i / vectors.length) * Math.PI * 2;
      const radius = 6.5; 
      return {
        ...vec,
        position: [
          Math.cos(angle) * radius,
          (Math.random() - 0.5) * 2.5,
          Math.sin(angle) * radius,
        ] as [number, number, number],
      };
    });
  }, [vectors]);

  const allNodes = [rootNode, ...childNodes];

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
        camera={{ position: [0, 6, 8], fov: 45 }}
        onPointerMissed={handlePointerMissed}
      >
        <color attach="background" args={[bgColor]} />
        <ambientLight intensity={1.5} color={ambientColor} />
        <directionalLight position={[10, 10, 10]} intensity={3} color={directionalColor} />
        <directionalLight position={[-10, -10, -10]} intensity={1} color={isHighRisk ? "#ff0000" : "#00f3ff"} />
        <Environment preset="city" />
        
        <CameraRig selectedPos={selectedPos} />

        <Grid 
          infiniteGrid 
          fadeDistance={15} 
          sectionColor={gridColor} 
          cellColor={gridColor} 
          sectionSize={1} 
          cellSize={0.2} 
          position={[0, -2, 0]} 
          cellThickness={0.5} 
          sectionThickness={1}
          {...({
             opacity: isHighRisk ? 0.3 : 0.15,
             transparent: true
          } as any)}
        />

        {childNodes.map((node) => (
          <ThreatEdge
            key={`edge-${node.id}`}
            start={rootNode.position}
            end={node.position}
            color={node.color}
            selected={selectedNode?.id === node.id}
          />
        ))}

        <Suspense fallback={null}>
          {allNodes.map((node) => (
            <ThreatNode 
              key={node.id} 
              node={node} 
              onClick={handleNodeClick}
              selected={selectedNode?.id === node.id}
            />
          ))}
        </Suspense>

        <OrbitControls
          makeDefault
          autoRotate={!selectedNode}
          autoRotateSpeed={0.8}
          enableDamping
          dampingFactor={0.05}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 2.2}
          minDistance={3}
          maxDistance={15}
        />
      </Canvas>
    </div>
  );
}
