import { useEffect, useState, useRef } from 'react';
import { PlayerSprite, SpriteRarity } from '../PlayerSprite';
import { EnemySprite, inferEnemyKind } from './EnemySprite';

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
  lastActor: 'player' | 'enemy' | null;
  lastDamage: number | null;
  lastWasHeal?: boolean;
  lastSkillName?: string | null;
  attackKind?: AttackKind;
  crit?: boolean;
}

const ZONE_BG_GRADIENT: Record<string, string> = {
  'station-hub':   'linear-gradient(180deg, hsl(220 50% 12%) 0%, hsl(210 60% 6%) 55%, hsl(195 80% 14%) 100%)',
  'neon-district': 'linear-gradient(180deg, hsl(280 55% 16%) 0%, hsl(220 60% 8%) 55%, hsl(190 90% 18%) 100%)',
  'wasteland':     'linear-gradient(180deg, hsl(20 55% 20%) 0%, hsl(15 60% 12%) 55%, hsl(35 70% 24%) 100%)',
};

const ZONE_ACCENT: Record<string, string> = {
  'station-hub':   'hsl(195 100% 60%)',
  'neon-district': 'hsl(285 100% 65%)',
  'wasteland':     'hsl(28 100% 60%)',
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

const damageColor = (kind: AttackKind, isHeal: boolean, crit: boolean) => {
  if (isHeal) return 'hsl(140 100% 60%)';
  if (crit) return 'hsl(45 100% 60%)';
  if (kind === 'tech') return 'hsl(195 100% 65%)';
  return 'hsl(20 100% 65%)';
};

const FloatNumber = ({ value, color, crit }: { value: number; color: string; crit?: boolean }) => (
  <div
    className="absolute left-1/2 font-orbitron pointer-events-none z-30"
    style={{
      top: '-6%',
      color,
      fontSize: crit ? '2.6rem' : '1.9rem',
      fontWeight: 900,
      textShadow: '0 0 12px currentColor, 2px 2px 0 rgba(0,0,0,0.85)',
      animation: 'damage-float 1.05s cubic-bezier(.2,.8,.2,1) forwards',
    }}
  >
    {value < 0 || color === 'hsl(140 100% 60%)' ? '+' : '-'}{Math.abs(value)}{crit ? '!' : ''}
  </div>
);

export const BattleStage = ({
  zoneId, player, enemy, actionTick, lastActor, lastDamage, lastWasHeal, lastSkillName, attackKind, crit,
}: BattleStageProps) => {
  const [phase, setPhase] = useState<'idle' | 'wind' | 'strike' | 'recover'>('idle');
  const [showImpact, setShowImpact] = useState(false);
  const [showProjectile, setShowProjectile] = useState(false);
  const [showMuzzle, setShowMuzzle] = useState(false);
  const [showCharge, setShowCharge] = useState(false);
  const [showHealAura, setShowHealAura] = useState(false);
  const [floatKey, setFloatKey] = useState(0);
  const [shake, setShake] = useState(false);
  const [skillBanner, setSkillBanner] = useState<string | null>(null);
  const tickRef = useRef(actionTick);

  const playerRarity = variantToRarity(player.armorVariant, player.weaponVariant);
  const enemyKind = inferEnemyKind(enemy.name);

  // For enemies, prefer a kind-aware attack:
  // drones/bots → tech/ranged; humanoids may have weapon; beasts → melee.
  const enemyAttackKind: AttackKind = (() => {
    if (enemyKind === 'drone' || enemyKind === 'bot') return 'tech';
    if (enemyKind === 'beast') return 'melee';
    return inferAttackKind(enemy.weaponVariant);
  })();

  const kind: AttackKind = attackKind ?? (
    lastActor === 'enemy' ? enemyAttackKind : inferAttackKind(player.weaponVariant)
  );

  useEffect(() => {
    if (actionTick === tickRef.current) return;
    tickRef.current = actionTick;
    if (!lastActor) return;

    setSkillBanner(lastSkillName ?? null);

    // Heal action: glow on user, no projectile/strike
    if (lastWasHeal) {
      setShowHealAura(true);
      setFloatKey(k => k + 1);
      const tHeal = window.setTimeout(() => setShowHealAura(false), 700);
      const tBan = window.setTimeout(() => setSkillBanner(null), 950);
      return () => { clearTimeout(tHeal); clearTimeout(tBan); };
    }

    setPhase('wind');
    if (kind === 'tech') setShowCharge(true);

    const t1 = window.setTimeout(() => {
      setPhase('strike');
      if (kind === 'tech') setShowCharge(false);
      if (kind === 'ranged') {
        setShowMuzzle(true);
        window.setTimeout(() => setShowMuzzle(false), 160);
      }
      if (kind === 'ranged' || kind === 'tech') {
        setShowProjectile(true);
        window.setTimeout(() => setShowProjectile(false), 360);
      }
    }, 240);

    const t2 = window.setTimeout(() => {
      setShowImpact(true);
      setFloatKey(k => k + 1);
      setShake(true);
      window.setTimeout(() => setShake(false), 280);
      window.setTimeout(() => setShowImpact(false), 360);
    }, kind === 'ranged' || kind === 'tech' ? 560 : 400);

    const t3 = window.setTimeout(() => setPhase('recover'), 740);
    const t4 = window.setTimeout(() => { setPhase('idle'); setSkillBanner(null); }, 1000);

    return () => { [t1, t2, t3, t4].forEach(clearTimeout); };
  }, [actionTick, lastActor, lastSkillName, kind, lastWasHeal]);

  const playerActing = phase !== 'idle' && lastActor === 'player';
  const enemyActing = phase !== 'idle' && lastActor === 'enemy';
  const playerHit = phase === 'strike' && lastActor === 'enemy' && !lastWasHeal;
  const enemyHit = phase === 'strike' && lastActor === 'player' && !lastWasHeal;

  const attackerOffset = (acting: boolean, dir: 1 | -1) => {
    if (!acting) return 0;
    if (kind === 'ranged' || kind === 'tech') {
      return phase === 'wind' ? dir * 10 : phase === 'strike' ? dir * 22 : phase === 'recover' ? dir * 10 : 0;
    }
    return phase === 'wind' ? dir * 24 : phase === 'strike' ? dir * 100 : phase === 'recover' ? dir * 32 : 0;
  };

  const playerOffset = attackerOffset(playerActing, 1);
  const enemyOffset = attackerOffset(enemyActing, -1);

  const bg = ZONE_BG_GRADIENT[zoneId ?? ''] ?? ZONE_BG_GRADIENT['station-hub'];
  const accent = ZONE_ACCENT[zoneId ?? ''] ?? ZONE_ACCENT['station-hub'];

  const dmgColor = damageColor(kind, !!lastWasHeal, !!crit);

  return (
    <div
      className="relative w-full overflow-hidden rounded-lg border border-border shadow-[0_0_30px_rgba(0,0,0,0.6)_inset]"
      style={{
        background: bg,
        height: 'min(48vh, 380px)',
        transform: shake ? 'translate(2px, -1px)' : 'none',
        transition: 'transform 60ms linear',
      }}
    >
      {/* === Background layers === */}
      {/* Distant skyline silhouette */}
      <svg viewBox="0 0 200 60" preserveAspectRatio="none"
        className="absolute left-0 right-0 top-[20%] w-full h-[35%] pointer-events-none opacity-40">
        <path d="M0 60 L0 40 L10 40 L12 30 L20 30 L22 38 L30 38 L32 22 L42 22 L44 36 L52 36 L56 28 L64 28 L66 18 L74 18 L78 32 L86 32 L88 24 L98 24 L100 14 L108 14 L112 30 L120 30 L122 22 L130 22 L132 34 L140 34 L144 26 L152 26 L156 16 L164 16 L168 32 L176 32 L180 22 L188 22 L192 30 L200 30 L200 60 Z"
          fill="hsl(220 30% 8%)" stroke={accent} strokeOpacity="0.4" strokeWidth="0.3" />
      </svg>

      {/* Starfield */}
      <div className="absolute inset-0 pointer-events-none opacity-50"
        style={{
          background:
            'radial-gradient(1px 1px at 20% 30%, white, transparent), ' +
            'radial-gradient(1px 1px at 70% 20%, white, transparent), ' +
            'radial-gradient(1px 1px at 40% 70%, white, transparent), ' +
            'radial-gradient(1.5px 1.5px at 85% 60%, white, transparent), ' +
            'radial-gradient(1px 1px at 15% 80%, white, transparent), ' +
            'radial-gradient(1px 1px at 55% 45%, white, transparent)',
        }}
      />

      {/* Light sweep */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-2 left-0 w-1/3 h-[140%] light-sweep"
          style={{ background: `linear-gradient(90deg, transparent, ${accent}22, transparent)`, transform: 'skewX(-12deg)' }}/>
      </div>

      {/* Floor plane gradient */}
      <div className="absolute left-0 right-0 bottom-0 h-[36%] pointer-events-none"
        style={{ background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.65))' }} />

      {/* Floor neon grid */}
      <svg viewBox="0 0 100 36" preserveAspectRatio="none"
        className="absolute left-0 right-0 bottom-0 w-full h-[36%] pointer-events-none opacity-50">
        {Array.from({ length: 7 }).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 6} x2="100" y2={i * 6} stroke={accent} strokeWidth="0.12" opacity={0.3 + i * 0.08} />
        ))}
        {Array.from({ length: 11 }).map((_, i) => (
          <line key={`v${i}`} x1={i * 10} y1="0" x2={50 + (i - 5) * 28} y2="36" stroke={accent} strokeWidth="0.12" opacity="0.45" />
        ))}
      </svg>

      {/* Arena holographic boundary line */}
      <div className="absolute left-[6%] right-[6%] bottom-[12%] pointer-events-none rounded-full"
        style={{
          height: 6,
          background: `radial-gradient(ellipse at center, ${accent}55, transparent 70%)`,
        }} />

      {/* === Skill banner === */}
      {skillBanner && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 font-orbitron text-base sm:text-lg tracking-widest text-primary px-3 py-1 rounded"
          style={{
            textShadow: '0 0 12px hsl(var(--primary)), 0 2px 0 rgba(0,0,0,0.8)',
            background: 'rgba(0,0,0,0.35)',
            border: `1px solid ${accent}55`,
          }}>
          {skillBanner.toUpperCase()}
        </div>
      )}

      {/* === Player fighter === */}
      <div
        className="absolute bottom-6 left-[16%]"
        style={{
          transform: `translateX(${playerOffset}px) ${playerHit ? 'translateX(-6px)' : ''}`,
          transition: 'transform 200ms cubic-bezier(0.25, 0.1, 0.25, 1)',
          filter: playerHit ? 'brightness(2.5) drop-shadow(0 0 14px hsl(0 100% 60%))' : 'none',
        }}
      >
        {/* Foot platform glow */}
        <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-[120px] h-3 arena-pulse pointer-events-none rounded-full"
          style={{ background: `radial-gradient(ellipse, ${accent}88, transparent 70%)` }} />
        <div className={phase === 'idle' ? 'battle-stance' : ''}>
          <PlayerSprite
            direction="right"
            state={playerActing ? 'walk' : 'idle'}
            armorVariant={player.armorVariant ?? null}
            weaponVariant={player.weaponVariant ?? null}
            rarity={playerRarity}
            scale={1.4}
          />
        </div>
        {showHealAura && lastActor === 'player' && (
          <div className="absolute inset-0 pointer-events-none rounded-full"
            style={{
              background: 'radial-gradient(circle, hsl(140 100% 60% / 0.55), transparent 70%)',
              animation: 'pulse 0.6s ease-out',
            }} />
        )}
        {playerHit && lastDamage != null && (
          <FloatNumber key={`p-${floatKey}`} value={lastDamage} color={dmgColor} crit={crit} />
        )}
        {playerActing && lastWasHeal && lastDamage != null && (
          <FloatNumber key={`ph-${floatKey}`} value={lastDamage} color="hsl(140 100% 60%)" />
        )}
      </div>

      {/* === Enemy fighter === */}
      <div
        className="absolute bottom-6 right-[16%]"
        style={{
          transform: `translateX(${enemyOffset}px) ${enemyHit ? 'translateX(6px)' : ''}`,
          transition: 'transform 200ms cubic-bezier(0.25, 0.1, 0.25, 1)',
        }}
      >
        {/* Foot platform glow */}
        <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-[120px] h-3 arena-pulse pointer-events-none rounded-full"
          style={{ background: `radial-gradient(ellipse, hsl(0 100% 60% / 0.45), transparent 70%)`, animationDelay: '0.4s' }} />
        {enemy.isPlayer ? (
          <PlayerSprite
            direction="left"
            state={enemyActing ? 'walk' : 'idle'}
            armorVariant={enemy.armorVariant ?? 'medium_blue'}
            weaponVariant={enemy.weaponVariant ?? 'sword'}
            rarity="rare"
            scale={1.4}
          />
        ) : (
          <EnemySprite
            name={enemy.name}
            attacking={enemyActing}
            hit={enemyHit}
            scale={1.35}
          />
        )}
        {enemyHit && lastDamage != null && (
          <FloatNumber key={`e-${floatKey}`} value={lastDamage} color={dmgColor} crit={crit} />
        )}
      </div>

      {/* === Charge buildup at attacker (tech) === */}
      {showCharge && (
        <div
          className="absolute z-20 pointer-events-none"
          style={{
            top: '52%',
            left: lastActor === 'player' ? '24%' : 'auto',
            right: lastActor === 'enemy' ? '24%' : 'auto',
            width: 60, height: 60,
            transform: 'translate(-50%, -50%)',
            background: 'radial-gradient(circle, hsl(280 100% 75%) 0%, hsl(280 100% 50% / 0.4) 50%, transparent 75%)',
            borderRadius: '50%',
            animation: 'pulse 0.24s ease-in-out infinite',
            filter: 'blur(2px)',
          }}
        />
      )}

      {/* === Muzzle flash (ranged) === */}
      {showMuzzle && (
        <div
          className="absolute z-20 pointer-events-none"
          style={{
            top: '54%',
            left: lastActor === 'player' ? '28%' : 'auto',
            right: lastActor === 'enemy' ? '28%' : 'auto',
            width: 36, height: 36,
            transform: 'translate(-50%, -50%)',
            background: 'radial-gradient(circle, hsl(45 100% 75%) 0%, hsl(15 100% 55% / 0.7) 40%, transparent 75%)',
            borderRadius: '50%',
          }}
        />
      )}

      {/* === Projectile === */}
      {showProjectile && (
        <div
          className="absolute z-20 pointer-events-none"
          style={{
            top: '55%',
            left: lastActor === 'player' ? '30%' : 'auto',
            right: lastActor === 'enemy' ? '30%' : 'auto',
            width: kind === 'tech' ? 30 : 22,
            height: kind === 'tech' ? 30 : 6,
            borderRadius: kind === 'tech' ? '50%' : '3px',
            background: kind === 'tech'
              ? 'radial-gradient(circle, hsl(280 100% 75%) 0%, hsl(280 100% 50% / 0.6) 60%, transparent 80%)'
              : 'linear-gradient(90deg, hsl(45 100% 70%), hsl(15 100% 55%))',
            boxShadow: kind === 'tech'
              ? '0 0 28px hsl(280 100% 70%)'
              : '0 0 14px hsl(45 100% 60%)',
            animation: lastActor === 'player'
              ? 'projectile-right 0.36s linear forwards'
              : 'projectile-left 0.36s linear forwards',
          }}
        />
      )}

      {/* === Impact burst === */}
      {showImpact && (
        <div
          className="absolute z-25 pointer-events-none"
          style={{
            top: '52%',
            left: lastActor === 'player' ? 'auto' : '20%',
            right: lastActor === 'player' ? '20%' : 'auto',
            width: 90, height: 90,
            transform: 'translate(50%, -50%)',
            background: kind === 'tech'
              ? 'radial-gradient(circle, hsl(280 100% 80%) 0%, hsl(280 100% 50% / 0.6) 30%, transparent 70%)'
              : kind === 'ranged'
                ? 'radial-gradient(circle, hsl(45 100% 75%) 0%, hsl(15 100% 55% / 0.7) 30%, transparent 70%)'
                : 'radial-gradient(circle, hsl(0 0% 100%) 0%, hsl(0 100% 60% / 0.7) 25%, transparent 70%)',
            borderRadius: '50%',
            animation: 'impact-burst 0.36s ease-out forwards',
          }}
        />
      )}

      {/* === Slash arc (melee) === */}
      {showImpact && kind === 'melee' && (
        <svg
          className="absolute z-25 pointer-events-none"
          style={{
            top: '38%',
            left: lastActor === 'player' ? 'auto' : '14%',
            right: lastActor === 'player' ? '14%' : 'auto',
            width: 100, height: 100,
            transform: 'translate(50%, -50%)',
            animation: 'slash-fade 0.32s ease-out forwards',
          }}
          viewBox="0 0 100 100"
        >
          <path d="M 10 80 Q 50 10 90 80" fill="none"
            stroke={lastActor === 'player' ? 'hsl(195 100% 70%)' : 'hsl(0 100% 65%)'}
            strokeWidth="7" strokeLinecap="round"
            style={{ filter: 'drop-shadow(0 0 6px currentColor)' }}
          />
        </svg>
      )}

      {/* Inline keyframes for one-off animations not in index.css */}
      <style>{`
        @keyframes projectile-right { from { transform: translateX(0); } to { transform: translateX(38vw); } }
        @keyframes projectile-left  { from { transform: translateX(0); } to { transform: translateX(-38vw); } }
        @keyframes impact-burst { 0% { transform: translate(50%, -50%) scale(0.4); opacity: 0; }
          30% { opacity: 1; } 100% { transform: translate(50%, -50%) scale(1.5); opacity: 0; } }
        @keyframes slash-fade { 0% { opacity: 0; transform: translate(50%, -50%) scale(0.6) rotate(-12deg); }
          40% { opacity: 1; } 100% { opacity: 0; transform: translate(50%, -50%) scale(1.15) rotate(12deg); } }
      `}</style>
    </div>
  );
};
