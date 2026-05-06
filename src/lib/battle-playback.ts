export interface PlaybackParticipant {
  slot: number;
  user_id: string | null;
  hp: number;
  max_hp: number;
  energy: number;
  max_energy: number;
  rage: number;
  status_effects: any[];
  cooldowns: Record<string, number>;
  snapshot: any;
}

export interface PlaybackAction {
  actor_slot: number;
  turn_number: number;
  result: any;
}

function mergeParticipant<T extends PlaybackParticipant>(base: T, patch?: Partial<T> | null): T {
  if (!patch) return base;

  return {
    ...base,
    ...patch,
    status_effects: patch.status_effects ?? base.status_effects,
    cooldowns: patch.cooldowns ?? base.cooldowns,
    snapshot: patch.snapshot ?? base.snapshot,
  } as T;
}

export function resolvePlaybackState<T extends PlaybackParticipant>(
  action: PlaybackAction,
  meSlot: number,
  displayedMe: T,
  displayedEnemy: T,
) {
  const actorState = action.result?.actor_state as Partial<T> | undefined;
  const targetState = action.result?.target_state as Partial<T> | undefined;

  let nextMe = displayedMe;
  let nextEnemy = displayedEnemy;

  if (actorState?.slot === meSlot) nextMe = mergeParticipant(nextMe, actorState);
  else if (actorState) nextEnemy = mergeParticipant(nextEnemy, actorState);

  if (targetState?.slot === meSlot) nextMe = mergeParticipant(nextMe, targetState);
  else if (targetState) nextEnemy = mergeParticipant(nextEnemy, targetState);

  return {
    me: nextMe,
    enemy: nextEnemy,
    nextTurnNumber: typeof action.result?.next_turn_number === 'number'
      ? action.result.next_turn_number
      : action.turn_number + (action.result?.battle_finished ? 0 : 1),
    nextCurrentTurn: Object.prototype.hasOwnProperty.call(action.result ?? {}, 'next_turn_user_id')
      ? action.result.next_turn_user_id ?? null
      : null,
  };
}