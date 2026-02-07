interface CombatLogProps {
  logs: string[];
}

export const CombatLog = ({ logs }: CombatLogProps) => {
  return (
    <div className="game-card rounded-lg p-3 max-h-20 overflow-hidden">
      <div className="space-y-0.5">
        {logs.map((log, i) => (
          <p key={i} className="text-sm text-muted-foreground font-rajdhani animate-fade-in">
            {log}
          </p>
        ))}
      </div>
    </div>
  );
};
