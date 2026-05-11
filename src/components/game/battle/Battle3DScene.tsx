import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import * as THREE from 'three';
import { Character } from '@/types/game';
import { AttackPhase } from './BattleCharacter';

interface Battle3DSceneProps {
  player: Character;
  enemy: Character;
  playerPhase: AttackPhase;
  enemyPhase: AttackPhase;
  playerHit: boolean;
  enemyHit: boolean;
}

const CLASS_COLORS: Record<string, string> = {
  warrior: '#e85d3a',
  mage: '#7b5cff',
  rogue: '#3ad6a6',
  ranger: '#5dd462',
  paladin: '#f5c542',
  necromancer: '#9c4dff',
  default: '#5fb8ff',
};

function colorFor(c: Character): string {
  const k = (c.class || '').toLowerCase();
  return CLASS_COLORS[k] ?? CLASS_COLORS.default;
}

/** Billboard sprite using the character's portrait — gives unique identity in 3D space. */
function CharacterBillboard({ url, height }: { url: string; height: number }) {
  const tex = useLoader(THREE.TextureLoader, url);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  // Maintain aspect ratio
  const aspect = (tex.image?.width || 1) / (tex.image?.height || 1);
  const w = height * aspect;
  return (
    <mesh position={[0, height / 2 + 0.1, 0]}>
      <planeGeometry args={[w, height]} />
      <meshBasicMaterial map={tex} transparent alphaTest={0.5} side={THREE.DoubleSide} />
    </mesh>
  );
}

interface RigProps {
  position: [number, number, number];
  facing: 1 | -1;
  color: string;
  phase: AttackPhase;
  beingHit: boolean;
  portraitUrl: string;
}

function Fighter3D({ position, facing, color, phase, beingHit, portraitUrl }: RigProps) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const weapon = useRef<THREE.Mesh>(null);
  const t0 = useRef(0);

  useFrame((state, dt) => {
    t0.current += dt;
    if (!root.current || !body.current || !rightArm.current) return;

    const t = state.clock.elapsedTime;
    // Idle bob
    const idleBob = Math.sin(t * 2.2 + (facing === 1 ? 0 : Math.PI)) * 0.04;

    // Targets per phase
    let targetX = position[0];
    let targetY = position[1] + idleBob;
    let targetZ = position[2];
    let bodyRotZ = 0;
    let armRotX = -0.2;
    let armRotZ = 0;
    let scale = 1;

    if (phase === 'lunging') {
      targetX = position[0] + facing * 0.4;
      bodyRotZ = -facing * 0.18;
      armRotX = 0.6;
      scale = 1.04;
    } else if (phase === 'striking') {
      targetX = position[0] + facing * 1.4;
      targetY = position[1] + 0.15;
      bodyRotZ = facing * 0.05;
      armRotX = -1.6;
      armRotZ = -facing * 0.4;
      scale = 1.1;
    } else if (phase === 'returning') {
      targetX = position[0] + facing * 0.2;
      bodyRotZ = facing * 0.1;
      armRotX = 0.1;
      scale = 0.98;
    }

    if (beingHit) {
      targetX += -facing * 0.25;
      bodyRotZ += -facing * 0.25;
    }

    // Smooth toward targets
    const lerp = phase === 'striking' ? 0.35 : 0.18;
    root.current.position.x += (targetX - root.current.position.x) * lerp;
    root.current.position.y += (targetY - root.current.position.y) * lerp;
    root.current.position.z += (targetZ - root.current.position.z) * lerp;
    body.current.rotation.z += (bodyRotZ - body.current.rotation.z) * lerp;
    rightArm.current.rotation.x += (armRotX - rightArm.current.rotation.x) * lerp;
    rightArm.current.rotation.z += (armRotZ - rightArm.current.rotation.z) * lerp;
    const sc = root.current.scale.x;
    root.current.scale.setScalar(sc + (scale - sc) * lerp);
  });

  const skin = '#f1c9a5';

  return (
    <group ref={root} position={position} rotation={[0, facing === 1 ? 0 : Math.PI, 0]}>
      {/* Ground shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[0.55, 24]} />
        <meshBasicMaterial color="#000" transparent opacity={0.45} />
      </mesh>

      <group ref={body}>
        {/* Legs */}
        <mesh position={[-0.18, 0.45, 0]} castShadow>
          <boxGeometry args={[0.22, 0.9, 0.22]} />
          <meshStandardMaterial color="#222" roughness={0.7} />
        </mesh>
        <mesh position={[0.18, 0.45, 0]} castShadow>
          <boxGeometry args={[0.22, 0.9, 0.22]} />
          <meshStandardMaterial color="#222" roughness={0.7} />
        </mesh>

        {/* Torso */}
        <mesh position={[0, 1.25, 0]} castShadow>
          <boxGeometry args={[0.7, 0.8, 0.4]} />
          <meshStandardMaterial color={color} roughness={0.4} metalness={0.3} emissive={color} emissiveIntensity={beingHit ? 0.8 : 0.15} />
        </mesh>

        {/* Shoulder pads */}
        <mesh position={[-0.42, 1.55, 0]} castShadow>
          <sphereGeometry args={[0.18, 16, 16]} />
          <meshStandardMaterial color={color} metalness={0.5} roughness={0.3} />
        </mesh>
        <mesh position={[0.42, 1.55, 0]} castShadow>
          <sphereGeometry args={[0.18, 16, 16]} />
          <meshStandardMaterial color={color} metalness={0.5} roughness={0.3} />
        </mesh>

        {/* Left arm (static) */}
        <group position={[-0.42, 1.4, 0]}>
          <mesh position={[0, -0.35, 0]} castShadow>
            <boxGeometry args={[0.18, 0.7, 0.18]} />
            <meshStandardMaterial color={skin} />
          </mesh>
        </group>

        {/* Right arm (animated) — pivoted at shoulder */}
        <group ref={rightArm} position={[0.42, 1.55, 0]}>
          <mesh position={[0, -0.35, 0]} castShadow>
            <boxGeometry args={[0.18, 0.7, 0.18]} />
            <meshStandardMaterial color={skin} />
          </mesh>
          {/* Sword/weapon */}
          <mesh ref={weapon} position={[0, -0.85, 0]} rotation={[0, 0, 0]} castShadow>
            <boxGeometry args={[0.08, 0.9, 0.04]} />
            <meshStandardMaterial color="#dfe9ff" metalness={0.95} roughness={0.15} emissive="#88c2ff" emissiveIntensity={0.35} />
          </mesh>
          {/* Hilt */}
          <mesh position={[0, -0.42, 0]}>
            <boxGeometry args={[0.22, 0.08, 0.08]} />
            <meshStandardMaterial color="#553" metalness={0.4} />
          </mesh>
        </group>

        {/* Head */}
        <mesh position={[0, 1.85, 0]} castShadow>
          <sphereGeometry args={[0.22, 24, 24]} />
          <meshStandardMaterial color={skin} roughness={0.6} />
        </mesh>

        {/* Portrait floats above as identity emblem */}
        <Float floatIntensity={0.4} rotationIntensity={0.0} speed={1.4}>
          <group position={[0, 2.5, 0]} rotation={[0, facing === 1 ? 0 : Math.PI, 0]}>
            <CharacterBillboard url={portraitUrl} height={0.7} />
          </group>
        </Float>
      </group>

      {/* Strike VFX */}
      {phase === 'striking' && (
        <mesh position={[facing * 1.0, 1.3, 0]} rotation={[0, 0, facing * 0.5]}>
          <torusGeometry args={[0.55, 0.06, 8, 24, Math.PI * 1.2]} />
          <meshBasicMaterial color="#7ad7ff" transparent opacity={0.85} />
        </mesh>
      )}

      {/* Hit ring */}
      {beingHit && (
        <mesh position={[0, 1.3, 0]}>
          <ringGeometry args={[0.6, 0.78, 32]} />
          <meshBasicMaterial color="#ff5d3a" transparent opacity={0.85} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

function ArenaFloor() {
  const grid = useMemo(() => {
    const size = 14;
    const divisions = 14;
    const g = new THREE.GridHelper(size, divisions, '#5fb8ff', '#2a4a6a');
    (g.material as THREE.Material).transparent = true;
    (g.material as THREE.Material).opacity = 0.55;
    return g;
  }, []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#0b1426" roughness={0.85} metalness={0.1} />
      </mesh>
      <primitive object={grid} position={[0, 0.005, 0]} />
      {/* Center arena ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[3.4, 3.6, 64]} />
        <meshBasicMaterial color="#5fb8ff" transparent opacity={0.6} />
      </mesh>
    </group>
  );
}

function CameraShaker({ trigger }: { trigger: number }) {
  const start = useRef(0);
  const last = useRef(trigger);
  useFrame((state) => {
    if (trigger !== last.current) {
      last.current = trigger;
      start.current = state.clock.elapsedTime;
    }
    const dt = state.clock.elapsedTime - start.current;
    const cam = state.camera;
    if (dt < 0.35 && start.current > 0) {
      const k = (1 - dt / 0.35) * 0.18;
      cam.position.x = (Math.random() - 0.5) * k;
      cam.position.y = 3 + (Math.random() - 0.5) * k;
    } else {
      cam.position.x += (0 - cam.position.x) * 0.15;
      cam.position.y += (3 - cam.position.y) * 0.15;
    }
    cam.lookAt(0, 1.2, 0);
  });
  return null;
}

export const Battle3DScene = ({
  player, enemy, playerPhase, enemyPhase, playerHit, enemyHit,
}: Battle3DSceneProps) => {
  const shakeKey = (playerHit ? 1 : 0) + (enemyHit ? 2 : 0);

  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [0, 3, 7.2], fov: 42 }}
      style={{ width: '100%', height: '100%' }}
    >
      <Suspense fallback={null}>
        <color attach="background" args={['#050912']} />
        <fog attach="fog" args={['#050912', 9, 22]} />

        <hemisphereLight args={['#88b8ff', '#1a0e2a', 0.55]} />
        <directionalLight
          position={[4, 8, 4]}
          intensity={1.4}
          color="#ffe5b8"
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <pointLight position={[-3, 2, 2]} intensity={1.2} color="#7ad7ff" distance={10} />
        <pointLight position={[3, 2, 2]} intensity={1.2} color="#ff7a5d" distance={10} />

        <ArenaFloor />

        <Fighter3D
          position={[-2.4, 0, 0]}
          facing={1}
          color={colorFor(player)}
          phase={playerPhase}
          beingHit={playerHit}
          portraitUrl={player.image}
        />
        <Fighter3D
          position={[2.4, 0, 0]}
          facing={-1}
          color={colorFor(enemy)}
          phase={enemyPhase}
          beingHit={enemyHit}
          portraitUrl={enemy.image}
        />

        <CameraShaker trigger={shakeKey} />
      </Suspense>
    </Canvas>
  );
};
