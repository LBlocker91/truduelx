import { useEffect, useState, useRef } from 'react';
import { PlayerSprite, SpriteRarity } from '../PlayerSprite';
import { EnemySprite, inferEnemyKind } from './EnemySprite';
import { classifySkillVfx, VFX_PRESET, SkillVfx, SkillLike } from './skill-vfx';

/** Legacy attack kind kept for the existing call-site. */
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
  /** Bumped every time a new action lands. Drives the animation. */
  actionTick: number;
  lastActor: 'player' | 'enemy' | null;
  lastDamage: number | null;
  lastWasHeal?: boolean;
  lastSkillName?: string | null;
  /** Full skill row when a skill was used — drives skill-specific VFX. */
  lastSkill?: SkillLike | null;
  /** Legacy fallback when no skill row is provided (basic attacks). */
  attackKind?: AttackKind;
  crit?: boolean;
  onAnimationComplete?: () => void;
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

const FloatNumber = ({ value, color, crit, label }: { value: number; color: string; crit?: boolean; label?: string }) => (
  <div
    className="absolute left-1/2 font-orbitron pointer-events-none z-30 whitespace-nowrap"
    style={{
      top: '-6%',
      color,
      fontSize: crit ? '2.6rem' : '1.9rem',
      fontWeight: 900,
      textShadow: '0 0 12px currentColor, 2px 2px 0 rgba(0,0,0,0.85)',
      animation: 'damage-float 1.05s cubic-bezier(.2,.8,.2,1) forwards',
    }}
  >
    {label ?? (color === 'hsl(140 100% 60%)' ? '+' : '-')}{Math.abs(value)}{crit ? '!' : ''}
  </div>
);

export const BattleStage = ({
  zoneId, player, enemy, actionTick, lastActor, lastDamage, lastWasHeal, lastSkillName, lastSkill, attackKind, crit,
  onAnimationComplete,
}: BattleStageProps) => {
  // Animation phase machine — only the actor animates; the other holds idle.
  const [phase, setPhase] = useState<'idle' | 'wind' | 'strike' | 'recover'>('idle');
  const [showImpact, setShowImpact] = useState(false);
  const [showProjectile, setShowProjectile] = useState(false);
  const [showMuzzle, setShowMuzzle] = useState(false);
  const [showCharge, setShowCharge] = useState(false);
  const [showHealAura, setShowHealAura] = useState(false);
  const [showBuffRing, setShowBuffRing] = useState(false);
  const [showShieldDome, setShowShieldDome] = useState(false);
  const [showStunRing, setShowStunRing] = useState(false);
  const [showDotDrip, setShowDotDrip] = useState(false);
  const [showShockwave, setShowShockwave] = useState(false);
  const [showUltimateFlash, setShowUltimateFlash] = useState(false);
  const [floatKey, setFloatKey] = useState(0);
  const [shake, setShake] = useState<'none' | 'small' | 'large'>('none');
  const [skillBanner, setSkillBanner] = useState<string | null>(null);
  const [bannerColor, setBannerColor] = useState<string>('hsl(195 100% 70%)');
  const tickRef = useRef(actionTick);

  const playerRarity = variantToRarity(player.armorVariant, player.weaponVariant);
  const enemyKind = inferEnemyKind(enemy.name);
  const attackerWeapon = lastActor === 'player' ? player.weaponVariant : enemy.weaponVariant;

  // Determine VFX from skill row; fall back to weapon-driven basic attack.
  const vfx: SkillVfx = (() => {
    if (lastSkill) return classifySkillVfx(lastSkill, attackerWeapon);
    // Legacy compat with attackKind
    if (attackKind === 'tech') return 'tech_bolt';
    if (attackKind === 'ranged') return 'ranged_shot';
    if (attackKind === 'aoe') return 'tech_aoe';
    return classifySkillVfx(null, attackerWeapon);
  })();
  const preset = VFX_PRESET[vfx];

  useEffect(() => {
    if (actionTick === tickRef.current) return;
    tickRef.current = actionTick;
    if (!lastActor) return;

    setSkillBanner(lastSkillName ?? null);
    setBannerColor(preset.bannerColor);

    // === Heal / buff / shield self-cast — no projectile, no strike ===
    if (lastWasHeal || preset.hasHealAura) {
      setShowHealAura(true);
      setFloatKey(k => k + 1);
      const tEnd = window.setTimeout(() => setShowHealAura(false), 800);
      const tBan = window.setTimeout(() => setSkillBanner(null), 1000);
      const tDone = window.setTimeout(() => onAnimationComplete?.(), 1000);
      return () => { clearTimeout(tEnd); clearTimeout(tBan); clearTimeout(tDone); };
    }
    if (preset.hasBuffRing) {
      setShowBuffRing(true);
      const t1 = window.setTimeout(() => setShowBuffRing(false), 900);
      const t2 = window.setTimeout(() => setSkillBanner(null), 1100);
      const tDone = window.setTimeout(() => onAnimationComplete?.(), 1100);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(tDone); };
    }
    if (preset.hasShieldDome) {
      setShowShieldDome(true);
      const t1 = window.setTimeout(() => setShowShieldDome(false), 1100);
      const t2 = window.setTimeout(() => setSkillBanner(null), 1200);
      const tDone = window.setTimeout(() => onAnimationComplete?.(), 1200);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(tDone); };
    }

    // === Offensive sequence ===
    setPhase('wind');
    if (preset.hasCharge) setShowCharge(true);
    if (preset.isUltimate) setShowUltimateFlash(true);

    const t1 = window.setTimeout(() => {
      setPhase('strike');
      if (preset.hasCharge) setShowCharge(false);
      if (preset.hasMuzzle) {
        setShowMuzzle(true);
        window.setTimeout(() => setShowMuzzle(false), 160);
      }
      if (preset.hasProjectile) {
        setShowProjectile(true);
        window.setTimeout(() => setShowProjectile(false), 380);
      }
    }, preset.isUltimate ? 380 : 240);

    const impactDelay = preset.hasProjectile ? (preset.isUltimate ? 700 : 560) : (preset.isUltimate ? 540 : 400);
    const t2 = window.setTimeout(() => {
      setShowImpact(true);
      setFloatKey(k => k + 1);
      setShake(preset.shake);
      if (preset.hasShockwave) setShowShockwave(true);
      if (preset.hasStunRing) setShowStunRing(true);
      if (preset.hasDotDrip) setShowDotDrip(true);
      window.setTimeout(() => setShake('none'), preset.shake === 'large' ? 420 : 240);
      window.setTimeout(() => setShowImpact(false), 380);
      window.setTimeout(() => setShowShockwave(false), 600);
      window.setTimeout(() => setShowStunRing(false), 900);
      window.setTimeout(() => setShowDotDrip(false), 1200);
    }, impactDelay);

    const t3 = window.setTimeout(() => setPhase('recover'), impactDelay + 220);
    const t4 = window.setTimeout(() => {
      setPhase('idle');
      setSkillBanner(null);
      setShowUltimateFlash(false);
    }, impactDelay + 480);
    const tDone = window.setTimeout(() => onAnimationComplete?.(), impactDelay + 500);

    return () => { [t1, t2, t3, t4, tDone].forEach(clearTimeout); };
  }, [actionTick, lastActor, lastSkillName, lastWasHeal, onAnimationComplete, preset]);

  // Strict turn-based: only the acting fighter animates.
  const playerActing = phase !== 'idle' && lastActor === 'player';
  const enemyActing = phase !== 'idle' && lastActor === 'enemy';
  const playerHit = phase === 'strike' && lastActor === 'enemy' && !lastWasHeal && !preset.hasHealAura && !preset.hasBuffRing && !preset.hasShieldDome;
  const enemyHit = phase === 'strike' && lastActor === 'player' && !lastWasHeal && !preset.hasHealAura && !preset.hasBuffRing && !preset.hasShieldDome;

  // Lunge offsets — only attacker moves.
  const attackerOffset = (acting: boolean, dir: 1 | -1) => {
    if (!acting) return 0;
    const ranged = preset.hasProjectile;
    if (ranged) {
      return phase === 'wind' ? dir * 10 : phase === 'strike' ? dir * 22 : phase === 'recover' ? dir * 10 : 0;
    }
    const big = preset.shake === 'large';
    const lunge = big ? 120 : 100;
    return phase === 'wind' ? dir * 24 : phase === 'strike' ? dir * lunge : phase === 'recover' ? dir * 32 : 0;
  };

  const playerOffset = attackerOffset(playerActing, 1);
  const enemyOffset = attackerOffset(enemyActing, -1);

  const bg = ZONE_BG_GRADIENT[zoneId ?? ''] ?? ZONE_BG_GRADIENT['station-hub'];
  const accent = ZONE_ACCENT[zoneId ?? ''] ?? ZONE_ACCENT['station-hub'];

  const damageColor = preset.damageColor;
  const shakeClass = shake === 'large' ? 'animate-stage-shake-large' : shake === 'small' ? 'animate-stage-shake-small' : '';
  const showHitFlash = phase === 'strike' && !lastWasHeal && !preset.hasHealAura && !preset.hasBuffRing && !preset.hasShieldDome;

  return (
    <div
      className={`relative w-full overflow-hidden rounded-lg border border-border shadow-[0_0_30px_rgba(0,0,0,0.6)_inset] ${shakeClass}`}
      style={{
        background: bg,
        height: 'min(48vh, 380px)',
      }}
    >
      {/* Skyline */}
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

      {/* Floor gradient */}
      <div className="absolute left-0 right-0 bottom-0 h-[36%] pointer-events-none"
        style={{ background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.65))' }} />

      {/* Pseudo-3D perspective floor grid */}
      <div className="absolute left-0 right-0 bottom-0 h-[42%] pointer-events-none stage-3d overflow-hidden">
        <svg viewBox="0 0 100 60" preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full stage-floor-3d opacity-55">
          {Array.from({ length: 9 }).map((_, i) => (
            <line key={`h${i}`} x1="0" y1={i * 7.5} x2="100" y2={i * 7.5} stroke={accent} strokeWidth="0.18" opacity={0.25 + i * 0.08} />
          ))}
          {Array.from({ length: 13 }).map((_, i) => (
            <line key={`v${i}`} x1={i * 8.33} y1="0" x2={i * 8.33} y2="60" stroke={accent} strokeWidth="0.12" opacity="0.4" />
          ))}
        </svg>
      </div>

      {/* Arena boundary */}
      <div className="absolute left-[6%] right-[6%] bottom-[12%] pointer-events-none rounded-full"
        style={{ height: 6, background: `radial-gradient(ellipse at center, ${accent}55, transparent 70%)` }} />

      {/* Hit flash — quick white pop on every damage strike */}
      {showHitFlash && (
        <div
          className="absolute inset-0 pointer-events-none z-30"
          style={{
            background: preset.isUltimate
              ? `radial-gradient(ellipse at center, ${preset.hue}aa 0%, transparent 70%)`
              : 'radial-gradient(ellipse at center, hsl(0 0% 100% / 0.45) 0%, transparent 65%)',
            animation: 'hit-flash 0.22s ease-out forwards',
          }}
        />
      )}

      {/* Ultimate full-screen flash */}
      {showUltimateFlash && (
        <div
          className="absolute inset-0 pointer-events-none z-30"
          style={{
            background: `radial-gradient(ellipse at center, ${preset.hue}55 0%, transparent 65%)`,
            animation: 'ultimate-flash 0.9s ease-out forwards',
          }}
        />
      )}

      {/* Skill banner */}
      {skillBanner && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 font-orbitron text-base sm:text-lg tracking-widest px-3 py-1 rounded"
          style={{
            color: bannerColor,
            textShadow: `0 0 14px ${bannerColor}, 0 2px 0 rgba(0,0,0,0.85)`,
            background: 'rgba(0,0,0,0.4)',
            border: `1px solid ${bannerColor}66`,
            fontSize: preset.isUltimate ? '1.4rem' : undefined,
            letterSpacing: preset.isUltimate ? '0.3em' : undefined,
          }}>
          {preset.isUltimate && '★ '}{skillBanner.toUpperCase()}{preset.isUltimate && ' ★'}
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
        <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-[120px] h-3 arena-pulse pointer-events-none rounded-full"
          style={{ background: `radial-gradient(ellipse, ${accent}88, transparent 70%)` }} />
        <div className={phase === 'idle' ? 'battle-stance' : ''}>
          <PlayerSprite
            direction="right"
            state={playerActing && !preset.hasProjectile ? 'walk' : 'idle'}
            armorVariant={player.armorVariant ?? null}
            weaponVariant={player.weaponVariant ?? null}
            rarity={playerRarity}
            scale={1.4}
          />
        </div>

        {/* Self-cast effects (only when player is the actor) */}
        {lastActor === 'player' && showHealAura && (
          <SelfAura color="hsl(140 100% 60%)" pattern="rising" />
        )}
        {lastActor === 'player' && showBuffRing && (
          <SelfAura color="hsl(45 100% 60%)" pattern="ring" />
        )}
        {lastActor === 'player' && showShieldDome && (
          <ShieldDome color="hsl(195 100% 70%)" />
        )}

        {/* Damage / heal numbers */}
        {playerHit && lastDamage != null && (
          <FloatNumber key={`p-${floatKey}`} value={lastDamage} color={damageColor} crit={crit} />
        )}
        {playerActing && lastActor === 'player' && lastWasHeal && lastDamage != null && (
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
        <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-[120px] h-3 arena-pulse pointer-events-none rounded-full"
          style={{ background: `radial-gradient(ellipse, hsl(0 100% 60% / 0.45), transparent 70%)`, animationDelay: '0.4s' }} />
        {enemy.isPlayer ? (
          <PlayerSprite
            direction="left"
            state={enemyActing && !preset.hasProjectile ? 'walk' : 'idle'}
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

        {/* Enemy-side self-cast (e.g. enemy heals) */}
        {lastActor === 'enemy' && showHealAura && (
          <SelfAura color="hsl(140 100% 60%)" pattern="rising" />
        )}
        {lastActor === 'enemy' && showBuffRing && (
          <SelfAura color="hsl(45 100% 60%)" pattern="ring" />
        )}
        {lastActor === 'enemy' && showShieldDome && (
          <ShieldDome color="hsl(195 100% 70%)" />
        )}

        {/* Stun ring & DoT drip — anchored to whoever was hit */}
        {showStunRing && lastActor === 'player' && (
          <StunRing color="hsl(55 100% 60%)" />
        )}
        {showDotDrip && lastActor === 'player' && (
          <DotDrip color={preset.hue} />
        )}

        {enemyHit && lastDamage != null && (
          <FloatNumber key={`e-${floatKey}`} value={lastDamage} color={damageColor} crit={crit} />
        )}
      </div>

      {/* Stun / DoT on player when enemy applied them */}
      {showStunRing && lastActor === 'enemy' && (
        <div className="absolute bottom-6 left-[16%] pointer-events-none">
          <StunRing color="hsl(55 100% 60%)" />
        </div>
      )}
      {showDotDrip && lastActor === 'enemy' && (
        <div className="absolute bottom-6 left-[16%] pointer-events-none">
          <DotDrip color={preset.hue} />
        </div>
      )}

      {/* Charge buildup at attacker */}
      {showCharge && (
        <div
          className="absolute z-20 pointer-events-none"
          style={{
            top: '52%',
            left: lastActor === 'player' ? '24%' : 'auto',
            right: lastActor === 'enemy' ? '24%' : 'auto',
            width: 60, height: 60,
            transform: 'translate(-50%, -50%)',
            background: `radial-gradient(circle, ${preset.hue} 0%, ${preset.hue}66 50%, transparent 75%)`,
            borderRadius: '50%',
            animation: 'pulse 0.24s ease-in-out infinite',
            filter: 'blur(2px)',
          }}
        />
      )}

      {/* Muzzle flash */}
      {showMuzzle && (
        <div
          className="absolute z-20 pointer-events-none"
          style={{
            top: '54%',
            left: lastActor === 'player' ? '28%' : 'auto',
            right: lastActor === 'enemy' ? '28%' : 'auto',
            width: 36, height: 36,
            transform: 'translate(-50%, -50%)',
            background: `radial-gradient(circle, hsl(45 100% 80%) 0%, ${preset.hue} 40%, transparent 75%)`,
            borderRadius: '50%',
          }}
        />
      )}

      {/* Projectile */}
      {showProjectile && (
        <div
          className="absolute z-20 pointer-events-none"
          style={{
            top: '55%',
            left: lastActor === 'player' ? '30%' : 'auto',
            right: lastActor === 'enemy' ? '30%' : 'auto',
            width: vfx === 'tech_aoe' || vfx === 'ultimate' ? 38 : vfx === 'tech_bolt' || vfx === 'control_stun' ? 30 : 22,
            height: vfx === 'tech_aoe' || vfx === 'ultimate' ? 38 : vfx === 'tech_bolt' || vfx === 'control_stun' ? 30 : 6,
            borderRadius: vfx === 'ranged_shot' ? '3px' : '50%',
            background: vfx === 'ranged_shot'
              ? `linear-gradient(90deg, hsl(45 100% 70%), ${preset.hue})`
              : `radial-gradient(circle, ${preset.hue} 0%, ${preset.hue}99 60%, transparent 80%)`,
            boxShadow: `0 0 24px ${preset.hue}`,
            animation: lastActor === 'player'
              ? 'projectile-right 0.36s linear forwards'
              : 'projectile-left 0.36s linear forwards',
          }}
        />
      )}

      {/* Impact burst */}
      {showImpact && (
        <div
          className="absolute z-25 pointer-events-none"
          style={{
            top: '52%',
            left: lastActor === 'player' ? 'auto' : '20%',
            right: lastActor === 'player' ? '20%' : 'auto',
            width: preset.isUltimate ? 140 : 90,
            height: preset.isUltimate ? 140 : 90,
            transform: 'translate(50%, -50%)',
            background: `radial-gradient(circle, hsl(0 0% 100%) 0%, ${preset.hue} 30%, transparent 70%)`,
            borderRadius: '50%',
            animation: 'impact-burst 0.4s ease-out forwards',
          }}
        />
      )}

      {/* Slash arc */}
      {showImpact && preset.hasSlash && (
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
            stroke={preset.hue}
            strokeWidth="7" strokeLinecap="round"
            style={{ filter: 'drop-shadow(0 0 8px currentColor)' }}
          />
        </svg>
      )}

      {/* Shockwave ring on heavy / aoe / ultimate */}
      {showShockwave && (
        <div
          className="absolute z-25 pointer-events-none rounded-full"
          style={{
            top: '60%',
            left: lastActor === 'player' ? 'auto' : '20%',
            right: lastActor === 'player' ? '20%' : 'auto',
            width: 60, height: 60,
            transform: 'translate(50%, -50%)',
            border: `3px solid ${preset.hue}`,
            boxShadow: `0 0 20px ${preset.hue}`,
            animation: 'shockwave-expand 0.6s ease-out forwards',
          }}
        />
      )}

      {/* Inline keyframes */}
      <style>{`
        @keyframes projectile-right { from { transform: translateX(0); } to { transform: translateX(38vw); } }
        @keyframes projectile-left  { from { transform: translateX(0); } to { transform: translateX(-38vw); } }
        @keyframes impact-burst { 0% { transform: translate(50%, -50%) scale(0.4); opacity: 0; }
          30% { opacity: 1; } 100% { transform: translate(50%, -50%) scale(1.5); opacity: 0; } }
        @keyframes slash-fade { 0% { opacity: 0; transform: translate(50%, -50%) scale(0.6) rotate(-12deg); }
          40% { opacity: 1; } 100% { opacity: 0; transform: translate(50%, -50%) scale(1.15) rotate(12deg); } }
        @keyframes shockwave-expand { 0% { transform: translate(50%, -50%) scale(0.3); opacity: 1; }
          100% { transform: translate(50%, -50%) scale(3.2); opacity: 0; } }
        @keyframes ultimate-flash { 0% { opacity: 0; } 25% { opacity: 1; } 100% { opacity: 0; } }
        @keyframes self-aura-pulse { 0% { transform: scale(0.5); opacity: 0; }
          40% { opacity: 1; } 100% { transform: scale(1.3); opacity: 0; } }
        @keyframes self-aura-rise { 0% { transform: translateY(20px) scale(0.6); opacity: 0; }
          25% { opacity: 1; } 100% { transform: translateY(-30px) scale(1.1); opacity: 0; } }
        @keyframes shield-pulse { 0% { transform: scale(0.7); opacity: 0; }
          25% { opacity: 0.9; } 75% { opacity: 0.6; } 100% { transform: scale(1.15); opacity: 0; } }
        @keyframes stun-ring-spin { from { transform: translate(-50%, -50%) rotate(0); } to { transform: translate(-50%, -50%) rotate(360deg); } }
        @keyframes dot-drip { 0% { transform: translateY(-10px); opacity: 0; }
          30% { opacity: 1; } 100% { transform: translateY(40px); opacity: 0; } }
      `}</style>
    </div>
  );
};

// ===== Self-cast VFX subcomponents =====

const SelfAura = ({ color, pattern }: { color: string; pattern: 'rising' | 'ring' }) => (
  <div className="absolute inset-0 pointer-events-none z-20">
    {pattern === 'rising' && (
      <>
        <div className="absolute inset-0 rounded-full"
          style={{ background: `radial-gradient(circle at 50% 60%, ${color}88, transparent 65%)`,
            animation: 'self-aura-rise 0.8s ease-out forwards' }} />
        {[15, 50, 85].map((x, i) => (
          <div key={i} className="absolute"
            style={{
              left: `${x}%`, bottom: '20%', width: 6, height: 6, borderRadius: '50%',
              background: color, boxShadow: `0 0 10px ${color}`,
              animation: `self-aura-rise 0.9s ease-out ${i * 0.12}s forwards`,
            }} />
        ))}
      </>
    )}
    {pattern === 'ring' && (
      <div className="absolute left-1/2 top-1/2 rounded-full -translate-x-1/2 -translate-y-1/2"
        style={{
          width: '120%', height: '120%', border: `3px solid ${color}`,
          boxShadow: `0 0 20px ${color}, inset 0 0 20px ${color}66`,
          animation: 'self-aura-pulse 0.9s ease-out forwards',
        }} />
    )}
  </div>
);

const ShieldDome = ({ color }: { color: string }) => (
  <div className="absolute inset-0 pointer-events-none z-20">
    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
      style={{
        width: '140%', height: '140%',
        background: `radial-gradient(circle, transparent 55%, ${color}33 70%, ${color}88 85%, transparent 92%)`,
        border: `2px solid ${color}`,
        boxShadow: `0 0 30px ${color}, inset 0 0 30px ${color}88`,
        animation: 'shield-pulse 1.1s ease-out forwards',
      }} />
  </div>
);

const StunRing = ({ color }: { color: string }) => (
  <div className="absolute left-1/2 top-1/4 -translate-x-1/2 pointer-events-none z-25"
    style={{ width: 60, height: 60 }}>
    <svg viewBox="0 0 60 60" className="w-full h-full"
      style={{ animation: 'stun-ring-spin 0.6s linear infinite', transformOrigin: 'center' }}>
      <circle cx="30" cy="30" r="22" fill="none" stroke={color} strokeWidth="2" strokeDasharray="4 4"
        style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
      <polygon points="30,8 33,16 26,16" fill={color} />
      <polygon points="30,52 33,44 26,44" fill={color} />
    </svg>
  </div>
);

const DotDrip = ({ color }: { color: string }) => (
  <div className="absolute inset-0 pointer-events-none z-25">
    {[20, 50, 80].map((x, i) => (
      <div key={i} className="absolute"
        style={{
          left: `${x}%`, top: '20%', width: 5, height: 12, borderRadius: '50%',
          background: color, boxShadow: `0 0 8px ${color}`,
          animation: `dot-drip 1.1s ease-in ${i * 0.15}s infinite`,
        }} />
    ))}
  </div>
);
