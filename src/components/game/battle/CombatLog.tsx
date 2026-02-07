interface CombatLogProps {
  logs: string[];
}

export const CombatLog = ({ logs }: CombatLogProps) => {
  const lastLog = logs[logs.length - 1];

  return (
    <div
      className="rounded px-3 py-1 text-center"
      style={{
        background: 'hsl(var(--card) / 0.75)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <p className="text-xs sm:text-sm text-muted-foreground font-rajdhani animate-fade-in truncate">
        {lastLog}
      </p>
    </div>
  );
};
