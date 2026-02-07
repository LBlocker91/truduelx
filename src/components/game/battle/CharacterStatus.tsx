import { Character } from '@/types/game';

interface CharacterStatusProps {
  character: Character;
  isPlayer: boolean;
}

export const CharacterStatus = ({ character, isPlayer }: CharacterStatusProps) => {
  const healthPercent = (character.stats.health / character.stats.maxHealth) * 100;
  const energyPercent = (character.stats.energy / character.stats.maxEnergy) * 100;
  const ragePercent = (character.rage / character.maxRage) * 100;

  return (
    <div
      className={`flex flex-col gap-0.5 ${isPlayer ? 'items-start' : 'items-end'}`}
      style={{ minWidth: '160px', maxWidth: '220px' }}
    >
      {/* Name + Level row */}
      <div className={`flex items-center gap-2 w-full ${isPlayer ? '' : 'flex-row-reverse'}`}>
        {/* Level badge */}
        <div
          className="w-7 h-7 rounded flex items-center justify-center font-orbitron text-[10px] font-black shrink-0"
          style={{
            background: 'linear-gradient(180deg, hsl(230 20% 30%) 0%, hsl(230 25% 18%) 100%)',
            border: '1.5px solid hsl(var(--border))',
            color: 'hsl(var(--foreground))',
          }}
        >
          {character.level}
        </div>
        <span className={`font-orbitron text-[11px] font-bold truncate max-w-[140px] leading-none ${isPlayer ? '' : 'text-right'}`}
          style={{ color: 'hsl(var(--foreground))' }}
        >
          {character.name}
        </span>
        {/* Status effect icons */}
        {character.statusEffects.length > 0 && (
          <div className="flex gap-0.5">
            {character.statusEffects.map((e, i) => (
              <span key={i} className="text-[9px]" title={`${e.type} (${e.turnsRemaining}t)`}>
                {e.type === 'stun' ? '💫' : e.type === 'dot' ? '🔥' : e.type === 'buff_attack' ? '⚔️' : '🛡️'}
              </span>
            ))}
          </div>
        )}
        {character.isDefending && <span className="text-[9px]">🛡️</span>}
      </div>

      {/* HP Bar - EpicDuel style: chunky with dark background, bright green fill */}
      <BarRow
        value={character.stats.health}
        max={character.stats.maxHealth}
        percent={healthPercent}
        fillColor="linear-gradient(180deg, #4ade80 0%, #16a34a 50%, #15803d 100%)"
        label="HP"
        isPlayer={isPlayer}
      />

      {/* Energy Bar - blue */}
      <BarRow
        value={character.stats.energy}
        max={character.stats.maxEnergy}
        percent={energyPercent}
        fillColor="linear-gradient(180deg, #38bdf8 0%, #0284c7 50%, #0369a1 100%)"
        label="EP"
        isPlayer={isPlayer}
      />

      {/* Rage Bar - orange/red, thinner */}
      <BarRow
        value={Math.floor(character.rage)}
        max={character.maxRage}
        percent={ragePercent}
        fillColor={ragePercent >= 100
          ? 'linear-gradient(180deg, #f97316 0%, #ef4444 50%, #dc2626 100%)'
          : 'linear-gradient(180deg, #fb923c 0%, #ea580c 50%, #c2410c 100%)'}
        label="RG"
        isPlayer={isPlayer}
        thin
      />
    </div>
  );
};

interface BarRowProps {
  value: number;
  max: number;
  percent: number;
  fillColor: string;
  label: string;
  isPlayer: boolean;
  thin?: boolean;
}

const BarRow = ({ value, max, percent, fillColor, label, isPlayer, thin }: BarRowProps) => (
  <div className={`flex items-center gap-1 w-full ${isPlayer ? '' : 'flex-row-reverse'}`}>
    <span
      className="font-orbitron text-[8px] font-bold w-5 shrink-0"
      style={{
        color: 'hsl(var(--muted-foreground))',
        textAlign: isPlayer ? 'right' : 'left',
      }}
    >
      {label}
    </span>
    <div
      className="flex-1 relative overflow-hidden"
      style={{
        height: thin ? '10px' : '14px',
        background: 'linear-gradient(180deg, hsl(230 30% 8%) 0%, hsl(230 25% 12%) 100%)',
        border: '1.5px solid hsl(230 20% 25%)',
        borderRadius: '2px',
      }}
    >
      <div
        className="h-full transition-all duration-500"
        style={{
          width: `${percent}%`,
          background: fillColor,
          borderRadius: '1px',
          marginLeft: isPlayer ? 0 : 'auto',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)',
        }}
      />
      <span
        className="absolute inset-0 flex items-center justify-center font-orbitron font-bold drop-shadow-md"
        style={{
          fontSize: thin ? '7px' : '8px',
          color: 'white',
          textShadow: '0 1px 2px rgba(0,0,0,0.8)',
        }}
      >
        {value}/{max}
      </span>
    </div>
  </div>
);
