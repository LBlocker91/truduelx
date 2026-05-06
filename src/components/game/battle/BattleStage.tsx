import { useEffect, useState, useRef } from 'react';
import { PlayerSprite, SpriteRarity } from '../PlayerSprite';

export type AttackKind = 'melee' | 'ranged' | 'tech' | 'aoe';

interface FighterVisual {
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  armorVariant?: string | null;
  weaponVariant?: string | null;
  isPlayer: boolean;
  characterClass?: string;
}

interface BattleStageProps {
  zoneId?: string;
  player: FighterVisual;
  enemy: FighterVisual;
  /** Bumped every time a new action lands. */
  actionTick: number;
  /** Who just acted. */
  lastActor: 'player' | 'enemy' | null;
  /** Damage applied to the *target* on the latest action. */
  lastDamage: number | null;
  /** Was the last action a heal/use_item? */
  lastWasHeal?: boolean;
  /** Tactical skill name shown above attacker briefly (e.g. "Volt Lance"). */
  lastSkillName?: string | null;
  /** Type of attack to render — drives VFX. */
  attackKind?: AttackKind;
  /** Crit flag for emphasis. */
  crit?: boolean;
}

const ZONE_BG_GRADIENT: Record<string, string> = {
  'station-hub':   'linear-gradient(180deg, hsl(220 50% 14%) 0%, hsl(210 60% 8%) 60%, hsl(200 80% 16%) 100%)',
  'neon-district': 'linear-gradient(180deg, hsl(280 55% 18%) 0%, hsl(220 60% 10%) 55%, hsl(190 80% 20%) 100%)',
  'wasteland':     'linear-gradient(180deg, hsl(20 55% 22%) 0%, hsl(15 60% 14%) 55%, hsl(35 70% 26%) 100%)',
};

const variantToRarity = (armor?: string | null, weapon?: string | null): SpriteRarity => {
  if (!armor && !weapon) return 'common';
  if (armor?.startsWith('heavy_')) return (weapon === 'staff' || weapon === 'axe') ? 'legendary' : 'epic';
  if (armor?.startsWith('medium_')) return 'rare';
  if (armor?.startsWith('light_')) return 'uncommon';
  return 'rare';
};

const inferAttackKind = (weaponVariant?: string | null): AttackKind => {
  if (!weaponVariant) return 'melee';
  if (weaponVariant === 'gun') return 'ranged';
  if (weaponVariant === 'staff') return 'tech';
  return 'melee';
};

// Floating damage / heal numbers displayed over the affected fighter.
const FloatNumber = ({ value, isHeal, crit }: { value: number; isHeal?: boolean; crit?: boolean }) => (
  <div
    className="absolute left-1/2 -translate-x-1/2 font-orbitron pointer-events-none z-30"
    style={{
      top: '-10%',
      color: isHeal ? 'hsl(140 100% 60%)' : crit ? 'hsl(45 100% 60%)' : 'hsl(0 90% 65%)',
      fontSize: crit ? '2.4rem' : '1.8rem',
      fontWeight: 900,
      textShadow: '0 0 10px currentColor, 2px 2px 0 rgba(0,0,0,0.7)',
      animation: 'damage-float 1s ease-out forwards',
    }}
  >
    {isHeal ? '+' : '-'}{value}{crit ? ' !' : ''}
  </div>
);

export const BattleStage = ({
  zoneId, player, enemy, actionTick, lastActor, lastDamage, lastWasHeal, lastSkillName, attackKind, crit,
}: BattleStageProps) => {
  const [phase, setPhase] = useState<'idle' | 'wind' | 'strike' | 'recover'>('idle');
  const [showImpact, setShowImpact] = useState(false);
  const [showProjectile, setShowProjectile] = useState(false);
  const [floatKey, setFloatKey] = useState(0);
  const [shake, setShake] = useState(false);
  const [skillBanner, setSkillBanner] = useState<string | null>(null);
  const tickRef = useRef(actionTick);

  const playerRarity = variantToRarity(player.armorVariant, player.weaponVariant);
  const enemyRarity: SpriteRarity = 'rare';
  const kind: AttackKind = attackKind ?? inferAttackKind(
    lastActor === 'player' ? player.weaponVariant : enemy.weaponVariant
  );

  // Trigger animation sequence when actionTick increases.
  useEffect(() => {
    if (actionTick === tickRef.current) return;
    tickRef.current = actionTick;
    if (!lastActor) return;

    setSkillBanner(lastSkillName ?? null);
    setPhase('wind');
    let t1: number, t2: number, t3: number, t4: number, t5: number;

    t1 = window.setTimeout(() => {
      setPhase('strike');
      // Projectile for ranged/tech only
      if (kind === 'ranged' || kind === 'tech') {
        setShowProjectile(true);
        t2 = window.setTimeout(() => setShowProjectile(false), 380);
      }
    }, 220);

    // Impact + damage number lands
    t3 = window.setTimeout(() => {
      setShowImpact(true);
      setFloatKey(k => k + 1);
      setShake(true);
      window.setTimeout(() => setShake(false), 280);
      window.setTimeout(() => setShowImpact(false), 360);
    }, kind === 'ranged' || kind === 'tech' ? 540 : 380);

    t4 = window.setTimeout(() => setPhase('recover'), 720);
    t5 = window.setTimeout(() => { setPhase('idle'); setSkillBanner(null); }, 980);

    return () => { [t1, t2, t3, t4, t5].forEach(id => id && clearTimeout(id)); };
  }, [actionTick, lastActor, lastSkillName, kind]);

  const playerActing = phase !== 'idle' && lastActor === 'player';
  const enemyActing = phase !== 'idle' && lastActor === 'enemy';
  const playerHit = phase === 'strike' && lastActor === 'enemy' && !lastWasHeal;
  const enemyHit = phase === 'strike' && lastActor === 'player' && !lastWasHeal;

  // Tween offset for attacker (lunge forward)
  const attackerOffset = (acting: boolean, dir: 1 | -1) => {
    if (!acting) return 0;
    if (kind === 'ranged' || kind === 'tech') {
      // Small step forward, hold while shooting
      return phase === 'wind' ? dir * 12 : phase === 'strike' ? dir * 24 : phase === 'recover' ? dir * 12 : 0;
    }
    // Melee — full lunge into target
    return phase === 'wind' ? dir * 22 : phase === 'strike' ? dir * 90 : phase === 'recover' ? dir * 30 : 0;
  };

  const playerOffset = attackerOffset(playerActing, 1);
  const enemyOffset = attackerOffset(enemyActing, -1);

  const bg = ZONE_BG_GRADIENT[zoneId ?? ''] ?? ZONE_BG_GRADIENT['station-hub'];

  return (
    <div
      className="relative w-full overflow-hidden rounded-lg border border-border"
      style={{
        background: bg,
        height: 'min(46vh, 360px)',
        transform: shake ? 'translate(2px, -1px)' : 'none',
        transition: 'transform 60ms linear',
      }}
    >
      {/* Starfield / particles */}
      <div className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          background:
            'radial-gradient(1px 1px at 20% 30%, white, transparent), ' +
            'radial-gradient(1px 1px at 70% 20%, white, transparent), ' +
            'radial-gradient(1px 1px at 40% 70%, white, transparent), ' +
            'radial-gradient(1.5px 1.5px at 85% 60%, white, transparent), ' +
            'radial-gradient(1px 1px at 15% 80%, white, transparent)',
        }}
      />
      {/* Floor plane */}
      <div className="absolute left-0 right-0 bottom-0 h-1/3 pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.55))',
        }}
      />
      {/* Floor grid */}
      <svg viewBox="0 0 100 30" preserveAspectRatio="none"
        className="absolute left-0 right-0 bottom-0 w-full h-1/3 pointer-events-none opacity-30">
        {Array.from({ length: 6 }).map((_, i) => (
          <line key={i} x1="0" y1={i * 5} x2="100" y2={i * 5} stroke="hsl(195 100% 60%)" strokeWidth="0.1" />
        ))}
      </svg>

      {/* Skill banner */}
      {skillBanner && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 font-orbitron text-base sm:text-lg tracking-widest text-primary"
          style={{ textShadow: '0 0 12px hsl(var(--primary)), 0 2px 0 rgba(0,0,0,0.8)' }}>
          {skillBanner.toUpperCase()}
        </div>
      )}

      {/* Player fighter — left side */}
      <div
        className="absolute bottom-6 left-[18%]"
        style={{
          transform: `translateX(${playerOffset}px) ${playerHit ? 'translateX(-6px)' : ''}`,
          transition: 'transform 200ms cubic-bezier(0.25, 0.1, 0.25, 1)',
          filter: playerHit ? 'brightness(2.5) drop-shadow(0 0 12px hsl(0 100% 60%))' : 'none',
        }}
      >
        <PlayerSprite
          direction="right"
          state={playerActing ? 'walk' : 'idle'}
          armorVariant={player.armorVariant ?? null}
          weaponVariant={player.weaponVariant ?? null}
          rarity={playerRarity}
          scale={1.3}
        />
        {playerHit && lastDamage != null && (
          <FloatNumber key={`p-${floatKey}`} value={lastDamage} crit={crit} />
        )}
        {playerActing && lastWasHeal && lastDamage != null && (
          <FloatNumber key={`ph-${floatKey}`} value={lastDamage} isHeal />
        )}
      </div>

      {/* Enemy fighter — right side */}
      <div
        className="absolute bottom-6 right-[18%]"
        style={{
          transform: `translateX(${enemyOffset}px) ${enemyHit ? 'translateX(6px)' : ''}`,
          transition: 'transform 200ms cubic-bezier(0.25, 0.1, 0.25, 1)',
          filter: enemyHit ? 'brightness(2.5) drop-shadow(0 0 12px hsl(0 100% 60%))' : 'none',
        }}
      >
        <PlayerSprite
          direction="left"
          state={enemyActing ? 'walk' : 'idle'}
          armorVariant={enemy.armorVariant ?? 'medium_blue'}
          weaponVariant={enemy.weaponVariant ?? 'sword'}
          rarity={enemyRarity}
          scale={1.3}
        />
        {enemyHit && lastDamage != null && (
          <FloatNumber key={`e-${floatKey}`} value={lastDamage} crit={crit} />
        )}
      </div>

      {/* Projectile (ranged / tech) */}
      {showProjectile && (
        <div
          className="absolute z-20 pointer-events-none"
          style={{
            top: '55%',
            left: lastActor === 'player' ? '32%' : 'auto',
            right: lastActor === 'enemy' ? '32%' : 'auto',
            width: kind === 'tech' ? 28 : 18,
            height: kind === 'tech' ? 28 : 6,
            borderRadius: kind === 'tech' ? '50%' : '3px',
            background: kind === 'tech'
              ? 'radial-gradient(circle, hsl(280 100% 70%) 0%, hsl(280 100% 50% / 0.6) 60%, transparent 80%)'
              : 'linear-gradient(90deg, hsl(45 100% 60%), hsl(15 100% 55%))',
            boxShadow: kind === 'tech'
              ? '0 0 24px hsl(280 100% 70%)'
              : '0 0 12px hsl(45 100% 60%)',
            animation: lastActor === 'player'
              ? 'projectile-right 0.36s linear forwards'
              : 'projectile-left 0.36s linear forwards',
          }}
        />
      )}

      {/* Impact burst at target */}
      {showImpact && (
        <div
          className="absolute z-25 pointer-events-none"
          style={{
            top: '52%',
            left: lastActor === 'player' ? 'auto' : '20%',
            right: lastActor === 'player' ? '20%' : 'auto',
            width: 80,
            height: 80,
            transform: 'translate(50%, -50%)',
            background: kind === 'tech'
              ? 'radial-gradient(circle, hsl(280 100% 75%) 0%, hsl(280 100% 50% / 0.6) 30%, transparent 70%)'
              : kind === 'ranged'
                ? 'radial-gradient(circle, hsl(45 100% 70%) 0%, hsl(15 100% 55% / 0.7) 30%, transparent 70%)'
                : 'radial-gradient(circle, hsl(0 0% 100%) 0%, hsl(0 100% 60% / 0.7) 25%, transparent 70%)',
            borderRadius: '50%',
            animation: 'impact-burst 0.36s ease-out forwards',
          }}
        />
      )}

      {/* Slash arc for melee */}
      {showImpact && kind === 'melee' && (
        <svg
          className="absolute z-25 pointer-events-none"
          style={{
            top: '38%',
            left: lastActor === 'player' ? 'auto' : '14%',
            right: lastActor === 'player' ? '14%' : 'auto',
            width: 90, height: 90,
            transform: 'translate(50%, -50%)',
            animation: 'slash-fade 0.32s ease-out forwards',
          }}
          viewBox="0 0 100 100"
        >
          <path d="M 10 80 Q 50 10 90 80" fill="none"
            stroke={lastActor === 'player' ? 'hsl(195 100% 70%)' : 'hsl(0 100% 65%)'}
            strokeWidth="6" strokeLinecap="round"
            style={{ filter: 'drop-shadow(0 0 6px currentColor)' }}
          />
        </svg>
      )}

      {/* Inline keyframes for one-off animations not in index.css */}
      <style>{`
        @keyframes projectile-right { from { transform: translateX(0); } to { transform: translateX(38vw); } }
        @keyframes projectile-left  { from { transform: translateX(0); } to { transform: translateX(-38vw); } }
        @keyframes impact-burst { 0% { transform: translate(50%, -50%) scale(0.4); opacity: 0; }
          30% { opacity: 1; } 100% { transform: translate(50%, -50%) scale(1.4); opacity: 0; } }
        @keyframes slash-fade { 0% { opacity: 0; transform: translate(50%, -50%) scale(0.6) rotate(-10deg); }
          40% { opacity: 1; } 100% { opacity: 0; transform: translate(50%, -50%) scale(1.1) rotate(10deg); } }
      `}</style>
    </div>
  );
};
