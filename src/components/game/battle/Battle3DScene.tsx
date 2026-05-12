import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
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

const RANGED_CLASSES = new Set(['mage', 'ranger', 'necromancer']);

function colorFor(c: Character): string {
  return CLASS_COLORS[(c.class || '').toLowerCase()] ?? CLASS_COLORS.default;
}
function isRanged(c: Character): boolean {
  return RANGED_CLASSES.has((c.class || '').toLowerCase());
}

/** Portrait billboard above the rig (safe against missing images). */
function CharacterBillboard({ url, height }: { url: string; height: number }) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  const [aspect, setAspect] = useState(1);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    new THREE.TextureLoader().load(
      url,
      (t) => {
        if (cancelled) return;
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
        const w = t.image?.width || 1;
        const h = t.image?.height || 1;
        setAspect(w / h);
        setTex(t);
      },
      undefined,
      () => {}
    );
    return () => { cancelled = true; };
  }, [url]);

  if (!tex) {
    return (
      <mesh position={[0, height / 2 + 0.1, 0]}>
        <planeGeometry args={[height * 0.7, height]} />
        <meshBasicMaterial color="#1a2540" transparent opacity={0.6} />
      </mesh>
    );
  }
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
  ranged: boolean;
  portraitUrl: string;
  seed: number;
}

function Fighter3D({ position, facing, color, phase, beingHit, ranged, portraitUrl, seed }: RigProps) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Mesh>(null);
  const rightArm = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const head = useRef<THREE.Mesh>(null);
  const muzzle = useRef<THREE.Mesh>(null);
  const projectile = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.Mesh>(null);
  const hitPulse = useRef(0);

  // Track hit edge to start a knockback impulse
  const lastHit = useRef(false);
  useEffect(() => {
    if (beingHit && !lastHit.current) hitPulse.current = 1;
    lastHit.current = beingHit;
  }, [beingHit]);

  useFrame((state, dt) => {
    if (!root.current || !body.current || !rightArm.current || !leftArm.current || !torso.current || !head.current) return;
    const t = state.clock.elapsedTime + seed;

    // --- Subtle idle: breathing (torso scale Y), micro-sway, head bob ---
    const breath = 1 + Math.sin(t * 1.6) * 0.025;
    torso.current.scale.y += (breath - torso.current.scale.y) * 0.15;
    const idleSway = Math.sin(t * 1.1) * 0.015;
    const idleBob = Math.sin(t * 1.6) * 0.02;
    head.current.position.y = 1.85 + Math.sin(t * 1.6 + 0.4) * 0.015;

    // --- Phase targets ---
    let targetX = position[0] + idleSway;
    let targetY = position[1] + idleBob;
    let targetZ = position[2];
    let bodyRotZ = 0;
    let bodyRotY = 0;
    let armRotX = -0.15 + Math.sin(t * 1.6) * 0.04;
    let armRotZ = 0;
    let leftRotX = 0.05 + Math.sin(t * 1.6 + Math.PI) * 0.04;
    let scale = 1;

    if (phase === 'lunging') {
      if (ranged) {
        // Aim stance: lean back, raise weapon arm
        targetX = position[0] - facing * 0.15;
        bodyRotZ = facing * 0.08;
        armRotX = -1.4;
        leftRotX = -0.6;
        scale = 1.02;
      } else {
        // Wind-up
        targetX = position[0] - facing * 0.2;
        bodyRotZ = facing * 0.18;
        armRotX = 0.9;
        scale = 1.03;
      }
    } else if (phase === 'striking') {
      if (ranged) {
        // Recoil
        targetX = position[0] - facing * 0.25;
        bodyRotZ = facing * 0.04;
        armRotX = -1.7;
        scale = 1.05;
      } else {
        // Lunge forward & swing
        targetX = position[0] + facing * 1.3;
        targetY = position[1] + 0.12;
        bodyRotZ = -facing * 0.1;
        armRotX = -1.5;
        armRotZ = -facing * 0.4;
        scale = 1.08;
      }
    } else if (phase === 'returning') {
      targetX = position[0] + (ranged ? 0 : facing * 0.1);
      bodyRotZ = ranged ? 0 : facing * 0.06;
      armRotX = -0.05;
      scale = 0.99;
    }

    // Hit knockback impulse (decays each frame)
    if (hitPulse.current > 0) {
      targetX += -facing * 0.35 * hitPulse.current;
      bodyRotZ += -facing * 0.3 * hitPulse.current;
      hitPulse.current = Math.max(0, hitPulse.current - dt * 4.5);
    }

    const lerp = phase === 'striking' ? 0.32 : 0.18;
    root.current.position.x += (targetX - root.current.position.x) * lerp;
    root.current.position.y += (targetY - root.current.position.y) * lerp;
    root.current.position.z += (targetZ - root.current.position.z) * lerp;
    body.current.rotation.z += (bodyRotZ - body.current.rotation.z) * lerp;
    body.current.rotation.y += (bodyRotY - body.current.rotation.y) * lerp;
    rightArm.current.rotation.x += (armRotX - rightArm.current.rotation.x) * lerp;
    rightArm.current.rotation.z += (armRotZ - rightArm.current.rotation.z) * lerp;
    leftArm.current.rotation.x += (leftRotX - leftArm.current.rotation.x) * lerp;
    const sc = root.current.scale.x;
    root.current.scale.setScalar(sc + (scale - sc) * lerp);

    // Hit emissive flash on torso
    const mat = torso.current.material as THREE.MeshStandardMaterial;
    if (mat && 'emissiveIntensity' in mat) {
      const target = beingHit ? 1.2 : 0.18;
      mat.emissiveIntensity += (target - mat.emissiveIntensity) * 0.25;
    }

    // Ground glow pulse
    if (glow.current) {
      const m = glow.current.material as THREE.MeshBasicMaterial;
      const targetOp = beingHit ? 0.55 : 0.28 + Math.sin(t * 2) * 0.04;
      m.opacity += (targetOp - m.opacity) * 0.15;
    }

    // Muzzle flash + projectile streak (ranged + striking only)
    if (muzzle.current && projectile.current) {
      const muzMat = muzzle.current.material as THREE.MeshBasicMaterial;
      const projMat = projectile.current.material as THREE.MeshBasicMaterial;
      const visible = ranged && phase === 'striking';
      muzMat.opacity += ((visible ? 1 : 0) - muzMat.opacity) * 0.4;
      projMat.opacity += ((visible ? 0.85 : 0) - projMat.opacity) * 0.3;
    }
  });

  const skin = '#f1c9a5';

  return (
    <group ref={root} position={position} rotation={[0, facing === 1 ? 0 : Math.PI, 0]}>
      {/* Contact shadow disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <circleGeometry args={[0.62, 28]} />
        <meshBasicMaterial color="#000" transparent opacity={0.5} />
      </mesh>
      {/* Glow ring under fighter */}
      <mesh ref={glow} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0]}>
        <ringGeometry args={[0.55, 0.95, 40]} />
        <meshBasicMaterial color={color} transparent opacity={0.28} side={THREE.DoubleSide} />
      </mesh>

      <group ref={body}>
        {/* Legs */}
        <mesh position={[-0.18, 0.45, 0]} castShadow>
          <boxGeometry args={[0.22, 0.9, 0.22]} />
          <meshStandardMaterial color="#1a1a22" roughness={0.7} />
        </mesh>
        <mesh position={[0.18, 0.45, 0]} castShadow>
          <boxGeometry args={[0.22, 0.9, 0.22]} />
          <meshStandardMaterial color="#1a1a22" roughness={0.7} />
        </mesh>

        {/* Torso */}
        <mesh ref={torso} position={[0, 1.25, 0]} castShadow>
          <boxGeometry args={[0.7, 0.8, 0.4]} />
          <meshStandardMaterial color={color} roughness={0.35} metalness={0.4} emissive={color} emissiveIntensity={0.18} />
        </mesh>

        {/* Shoulder pads */}
        <mesh position={[-0.42, 1.55, 0]} castShadow>
          <sphereGeometry args={[0.18, 16, 16]} />
          <meshStandardMaterial color={color} metalness={0.6} roughness={0.25} />
        </mesh>
        <mesh position={[0.42, 1.55, 0]} castShadow>
          <sphereGeometry args={[0.18, 16, 16]} />
          <meshStandardMaterial color={color} metalness={0.6} roughness={0.25} />
        </mesh>

        {/* Left arm */}
        <group ref={leftArm} position={[-0.42, 1.55, 0]}>
          <mesh position={[0, -0.35, 0]} castShadow>
            <boxGeometry args={[0.18, 0.7, 0.18]} />
            <meshStandardMaterial color={skin} />
          </mesh>
        </group>

        {/* Right arm — animated */}
        <group ref={rightArm} position={[0.42, 1.55, 0]}>
          <mesh position={[0, -0.35, 0]} castShadow>
            <boxGeometry args={[0.18, 0.7, 0.18]} />
            <meshStandardMaterial color={skin} />
          </mesh>
          {ranged ? (
            <>
              {/* Gun/staff barrel */}
              <mesh position={[0, -0.7, 0.25]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                <cylinderGeometry args={[0.06, 0.06, 0.7, 12]} />
                <meshStandardMaterial color="#2a2f3a" metalness={0.9} roughness={0.25} />
              </mesh>
              {/* Muzzle flash */}
              <mesh ref={muzzle} position={[0, -0.7, 0.65]}>
                <sphereGeometry args={[0.18, 12, 12]} />
                <meshBasicMaterial color="#ffd27a" transparent opacity={0} />
              </mesh>
              {/* Projectile streak */}
              <mesh ref={projectile} position={[0, -0.7, 1.6]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.04, 0.04, 1.8, 8]} />
                <meshBasicMaterial color="#ffe28a" transparent opacity={0} />
              </mesh>
            </>
          ) : (
            <>
              {/* Sword */}
              <mesh position={[0, -0.95, 0]} castShadow>
                <boxGeometry args={[0.08, 1.0, 0.04]} />
                <meshStandardMaterial color="#dfe9ff" metalness={0.95} roughness={0.12} emissive="#88c2ff" emissiveIntensity={0.35} />
              </mesh>
              <mesh position={[0, -0.42, 0]}>
                <boxGeometry args={[0.24, 0.08, 0.08]} />
                <meshStandardMaterial color="#553" metalness={0.4} />
              </mesh>
            </>
          )}
        </group>

        {/* Head */}
        <mesh ref={head} position={[0, 1.85, 0]} castShadow>
          <sphereGeometry args={[0.22, 24, 24]} />
          <meshStandardMaterial color={skin} roughness={0.6} />
        </mesh>

        {/* Portrait emblem */}
        <Float floatIntensity={0.4} rotationIntensity={0} speed={1.4}>
          <group position={[0, 2.55, 0]} rotation={[0, facing === 1 ? 0 : Math.PI, 0]}>
            <CharacterBillboard url={portraitUrl} height={0.7} />
          </group>
        </Float>
      </group>

      {/* Melee slash arc */}
      {!ranged && phase === 'striking' && (
        <mesh position={[facing * 1.0, 1.3, 0]} rotation={[0, 0, facing * 0.5]}>
          <torusGeometry args={[0.6, 0.07, 10, 28, Math.PI * 1.3]} />
          <meshBasicMaterial color="#9be0ff" transparent opacity={0.9} />
        </mesh>
      )}

      {/* Hit ring */}
      {beingHit && (
        <mesh position={[0, 1.3, 0]}>
          <ringGeometry args={[0.6, 0.82, 32]} />
          <meshBasicMaterial color="#ff5d3a" transparent opacity={0.85} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

function ArenaFloor() {
  const grid = useMemo(() => {
    const g = new THREE.GridHelper(20, 20, '#5fb8ff', '#1d3550');
    (g.material as THREE.Material).transparent = true;
    (g.material as THREE.Material).opacity = 0.5;
    return g;
  }, []);
  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[26, 26]} />
        <meshStandardMaterial color="#070d1a" roughness={0.85} metalness={0.15} />
      </mesh>
      <primitive object={grid} position={[0, 0.005, 0]} />
      {/* Center arena ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <ringGeometry args={[3.4, 3.62, 64]} />
        <meshBasicMaterial color="#5fb8ff" transparent opacity={0.7} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.011, 0]}>
        <ringGeometry args={[3.0, 3.08, 64]} />
        <meshBasicMaterial color="#ff7a5d" transparent opacity={0.35} />
      </mesh>
      {/* Backdrop pillars for depth */}
      {[-6, -3, 3, 6].map((x) => (
        <mesh key={x} position={[x, 1.4, -5.5]} castShadow>
          <boxGeometry args={[0.4, 2.8, 0.4]} />
          <meshStandardMaterial color="#101a2e" roughness={0.6} metalness={0.5} emissive="#1c4a7a" emissiveIntensity={0.4} />
        </mesh>
      ))}
      {/* Back wall glow plane */}
      <mesh position={[0, 2.5, -7]}>
        <planeGeometry args={[28, 7]} />
        <meshBasicMaterial color="#0a1a36" />
      </mesh>
    </group>
  );
}

/** Camera shake + push-in on attacks/hits. */
function CameraRig({
  shakeKey,
  pushIn,
}: {
  shakeKey: number;
  pushIn: boolean;
}) {
  const start = useRef(0);
  const last = useRef(shakeKey);
  useFrame((state) => {
    if (shakeKey !== last.current) {
      last.current = shakeKey;
      start.current = state.clock.elapsedTime;
    }
    const dt = state.clock.elapsedTime - start.current;
    const cam = state.camera;

    // Push-in target
    const targetZ = pushIn ? 6.2 : 7.4;
    const targetY = 2.8;
    cam.position.z += (targetZ - cam.position.z) * 0.08;
    cam.position.y += (targetY - cam.position.y) * 0.08;

    // Shake
    if (dt < 0.32 && start.current > 0) {
      const k = (1 - dt / 0.32) * 0.16;
      cam.position.x = (Math.random() - 0.5) * k;
      cam.position.y = targetY + (Math.random() - 0.5) * k;
    } else {
      cam.position.x += (0 - cam.position.x) * 0.15;
    }
    cam.lookAt(0, 1.3, 0);
  });
  return null;
}

export const Battle3DScene = ({
  player, enemy, playerPhase, enemyPhase, playerHit, enemyHit,
}: Battle3DSceneProps) => {
  const shakeKey = (playerHit ? 1 : 0) + (enemyHit ? 2 : 0);
  const pushIn = playerPhase !== 'idle' || enemyPhase !== 'idle';

  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [0, 2.8, 7.4], fov: 40 }}
      style={{ width: '100%', height: '100%' }}
    >
      <Suspense fallback={null}>
        <color attach="background" args={['#04070f']} />
        <fog attach="fog" args={['#04070f', 8, 22]} />

        {/* Ambient/key/fill */}
        <hemisphereLight args={['#88b8ff', '#160d2a', 0.5]} />
        <directionalLight
          position={[5, 9, 4]}
          intensity={1.3}
          color="#ffe5b8"
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        {/* Rim lights from behind each fighter for separation */}
        <spotLight position={[-5, 4, -3]} angle={0.6} penumbra={0.7} intensity={2.2} color="#7ad7ff" target-position={[-2.4, 1, 0]} castShadow />
        <spotLight position={[5, 4, -3]} angle={0.6} penumbra={0.7} intensity={2.2} color="#ff7a5d" target-position={[2.4, 1, 0]} castShadow />
        {/* Soft key fills */}
        <pointLight position={[-3, 2.5, 3]} intensity={0.9} color="#9bd0ff" distance={11} />
        <pointLight position={[3, 2.5, 3]} intensity={0.9} color="#ffb39a" distance={11} />

        <ArenaFloor />

        <Fighter3D
          position={[-2.4, 0, 0]}
          facing={1}
          color={colorFor(player)}
          phase={playerPhase}
          beingHit={playerHit}
          ranged={isRanged(player)}
          portraitUrl={player.image}
          seed={0}
        />
        <Fighter3D
          position={[2.4, 0, 0]}
          facing={-1}
          color={colorFor(enemy)}
          phase={enemyPhase}
          beingHit={enemyHit}
          ranged={isRanged(enemy)}
          portraitUrl={enemy.image}
          seed={1.7}
        />

        <CameraRig shakeKey={shakeKey} pushIn={pushIn} />
      </Suspense>
    </Canvas>
  );
};
