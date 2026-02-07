import { useCallback } from 'react';
import { Character, Ability, BattleState } from '@/types/game';
import {
  resolveAttack, calcRageGain, applyAbilityEffect,
  applyEnergyDrain, tickStatusEffects, isStunned,
} from '@/lib/combat';
import { AttackPhase } from '@/components/game/battle/BattleCharacter';

interface UseBattleActionsParams {
  battleState: BattleState;
  setBattleState: React.Dispatch<React.SetStateAction<BattleState>>;
  setPlayerAttackPhase: React.Dispatch<React.SetStateAction<AttackPhase>>;
  setEnemyAttackPhase: React.Dispatch<React.SetStateAction<AttackPhase>>;
  setPlayerHit: React.Dispatch<React.SetStateAction<boolean>>;
  setEnemyHit: React.Dispatch<React.SetStateAction<boolean>>;
  setPlayerDamage: React.Dispatch<React.SetStateAction<number | null>>;
  setEnemyDamage: React.Dispatch<React.SetStateAction<number | null>>;
  setHitLabel: React.Dispatch<React.SetStateAction<{ target: 'player' | 'enemy'; text: string } | null>>;
  TURN_TIME: number;
}

export const useBattleActions = ({
  battleState, setBattleState,
  setPlayerAttackPhase, setEnemyAttackPhase,
  setPlayerHit, setEnemyHit,
  setPlayerDamage, setEnemyDamage,
  setHitLabel, TURN_TIME,
}: UseBattleActionsParams) => {

  const addLog = useCallback((message: string) => {
    setBattleState(prev => ({
      ...prev,
      combatLog: [...prev.combatLog.slice(-4), message],
    }));
  }, [setBattleState]);

  const checkBattleEnd = useCallback((state: BattleState): BattleState => {
    if (state.player.stats.health <= 0) return { ...state, battleOver: true, winner: 'enemy' };
    if (state.enemy.stats.health <= 0) return { ...state, battleOver: true, winner: 'player' };
    return state;
  }, []);

  const performAttack = useCallback((
    attacker: 'player' | 'enemy',
    ability: Ability,
    onComplete: () => void
  ) => {
    const isPlayer = attacker === 'player';
    const setAttackPhase = isPlayer ? setPlayerAttackPhase : setEnemyAttackPhase;
    const setTargetHit = isPlayer ? setEnemyHit : setPlayerHit;
    const setTargetDamage = isPlayer ? setEnemyDamage : setPlayerDamage;

    setBattleState(prev => ({ ...prev, isAnimating: true }));
    setAttackPhase('lunging');

    setTimeout(() => {
      setAttackPhase('striking');

      setBattleState(prev => {
        const attackerChar = isPlayer ? prev.player : prev.enemy;
        const defenderChar = isPlayer ? prev.enemy : prev.player;
        const result = resolveAttack(attackerChar, defenderChar, ability);

        let label = '';
        if (result.critical) label = 'CRITICAL!';
        if (result.blocked) label = 'BLOCKED!';
        if (result.deflected) label = 'DEFLECTED!';
        if (label) setHitLabel({ target: isPlayer ? 'enemy' : 'player', text: label });
        setTimeout(() => setHitLabel(null), 1200);

        setTargetHit(true);
        setTargetDamage(result.damage);

        const emoji = isPlayer ? '🗡️' : '💀';
        let logMsg = `${emoji} ${attackerChar.name} uses ${ability.name} for ${result.damage} damage!`;
        if (result.critical) logMsg += ' 💥 CRITICAL!';
        if (result.blocked) logMsg += ' 🛡️ Blocked!';
        if (result.deflected) logMsg += ' ↩️ Deflected!';

        const targetKey = isPlayer ? 'enemy' : 'player';
        const attackerKey = isPlayer ? 'player' : 'enemy';

        const newDefender = {
          ...defenderChar,
          stats: { ...defenderChar.stats, health: Math.max(0, defenderChar.stats.health - result.damage) },
        };

        const drainAmount = applyEnergyDrain(ability, defenderChar);
        if (drainAmount > 0) {
          newDefender.stats.energy = Math.max(0, newDefender.stats.energy - drainAmount);
          logMsg += ` ⚡ Drained ${drainAmount} energy!`;
        }

        const effect = applyAbilityEffect(ability, defenderChar);
        if (effect) {
          newDefender.statusEffects = [...newDefender.statusEffects, effect];
          logMsg += ` [${effect.type}]`;
        }

        const rageGain = calcRageGain(result.damage);
        const newAttacker = {
          ...attackerChar,
          stats: { ...attackerChar.stats, energy: Math.max(0, attackerChar.stats.energy - ability.energyCost) },
          abilities: attackerChar.abilities.map(a => a.id === ability.id ? { ...a, currentCooldown: a.cooldown } : a),
          rage: Math.min(attackerChar.maxRage, attackerChar.rage + rageGain),
          isDefending: false,
        };

        const newDefenderWithRage = {
          ...newDefender,
          rage: Math.min(newDefender.maxRage, newDefender.rage + Math.floor(rageGain * 0.5)),
        };

        const newState: BattleState = {
          ...prev,
          [attackerKey]: newAttacker,
          [targetKey]: newDefenderWithRage,
          combatLog: [...prev.combatLog.slice(-4), logMsg],
          isAnimating: true,
        };

        return checkBattleEnd(newState);
      });

      setTimeout(() => {
        setTargetHit(false);
        setTargetDamage(null);
        setAttackPhase('returning');
        setTimeout(() => {
          setAttackPhase('idle');
          setBattleState(prev => ({ ...prev, isAnimating: false }));
          onComplete();
        }, 300);
      }, 250);
    }, 250);
  }, [checkBattleEnd, setBattleState, setPlayerAttackPhase, setEnemyAttackPhase, setPlayerHit, setEnemyHit, setPlayerDamage, setEnemyDamage, setHitLabel]);

  const switchTurn = useCallback(() => {
    setBattleState(prev => {
      if (prev.battleOver) return prev;
      const nextTurn = prev.turn === 'player' ? 'enemy' : 'player';
      const { char: tickedPlayer, dotDamage: playerDot } = tickStatusEffects(prev.player);
      const { char: tickedEnemy, dotDamage: enemyDot } = tickStatusEffects(prev.enemy);
      const logs = [...prev.combatLog];
      if (playerDot > 0) logs.push(`🔥 ${prev.player.name} takes ${playerDot} burn damage!`);
      if (enemyDot > 0) logs.push(`🔥 ${prev.enemy.name} takes ${enemyDot} burn damage!`);
      const regenAmount = 8;
      const nextChar = nextTurn === 'player' ? tickedPlayer : tickedEnemy;
      nextChar.stats.energy = Math.min(nextChar.stats.maxEnergy, nextChar.stats.energy + regenAmount);
      nextChar.abilities = nextChar.abilities.map(a => ({
        ...a,
        currentCooldown: Math.max(0, a.currentCooldown - 1),
      }));
      const newState: BattleState = {
        ...prev,
        player: nextTurn === 'player' ? nextChar : tickedPlayer,
        enemy: nextTurn === 'enemy' ? nextChar : tickedEnemy,
        turn: nextTurn,
        combatLog: logs.slice(-5),
        turnTimer: TURN_TIME,
        turnNumber: prev.turnNumber + 1,
      };
      return checkBattleEnd(newState);
    });
  }, [checkBattleEnd, setBattleState, TURN_TIME]);

  const useAbility = useCallback((ability: Ability) => {
    if (battleState.isAnimating || battleState.turn !== 'player' || battleState.battleOver) return;
    if (ability.currentCooldown > 0 || battleState.player.stats.energy < ability.energyCost) return;
    if (isStunned(battleState.player)) {
      addLog('💫 You are stunned and cannot act!');
      switchTurn();
      return;
    }
    performAttack('player', ability, switchTurn);
  }, [battleState, performAttack, switchTurn, addLog]);

  const handleDefend = useCallback(() => {
    if (battleState.isAnimating || battleState.turn !== 'player' || battleState.battleOver) return;
    setBattleState(prev => ({
      ...prev,
      player: { ...prev.player, isDefending: true },
      combatLog: [...prev.combatLog.slice(-4), '🛡️ You take a defensive stance! (-50% damage)'],
    }));
    setTimeout(() => switchTurn(), 500);
  }, [battleState, switchTurn, setBattleState]);

  const handleRageAttack = useCallback(() => {
    if (battleState.isAnimating || battleState.turn !== 'player' || battleState.battleOver) return;
    if (battleState.player.rage < 100) return;
    const rageAbility: Ability = {
      id: 'rage-attack', name: 'Rage Unleashed', description: 'Devastating rage attack',
      energyCost: 0, baseDamage: 50, type: 'physical', scaleStat: 'strength', cooldown: 0, currentCooldown: 0,
    };
    setBattleState(prev => ({ ...prev, player: { ...prev.player, rage: 0 } }));
    performAttack('player', rageAbility, switchTurn);
  }, [battleState, performAttack, switchTurn, setBattleState]);

  return {
    handleDefend, useAbility, handleRageAttack,
    performAttack, switchTurn, addLog, checkBattleEnd,
  };
};
