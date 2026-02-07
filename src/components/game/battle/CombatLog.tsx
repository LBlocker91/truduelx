interface CombatLogProps {
  logs: string[];
}

export const CombatLog = ({ logs }: CombatLogProps) => {
  // Show last 3 log lines, EpicDuel style
  const recentLogs = logs.slice(-3);

  return (
    <div
      className="w-full overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, hsl(230 30% 6% / 0.9) 0%, hsl(230 25% 10% / 0.95) 100%)',
        border: '1px solid hsl(230 20% 20%)',
        borderRadius: '3px',
        padding: '4px 8px',
        maxHeight: '44px',
      }}
    >
      {recentLogs.map((log, i) => (
        <p
          key={i}
          className="font-rajdhani truncate leading-tight"
          style={{
            fontSize: '11px',
            color: i === recentLogs.length - 1 ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
            opacity: i === recentLogs.length - 1 ? 1 : 0.6,
          }}
        >
          {log}
        </p>
      ))}
    </div>
  );
};
