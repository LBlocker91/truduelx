// Per-NPC art resolution. Maps seeded NPC names to distinct sprites so the
// world feels populated by individuals instead of three repeated stand-ins.
import vendorImg from '@/assets/npc/npc-vendor.png';
import questImg from '@/assets/npc/npc-quest.png';
import enemyImg from '@/assets/npc/npc-enemy.png';
import medicImg from '@/assets/npc/npc-medic.png';
import scoutImg from '@/assets/npc/npc-scout.png';
import engineerImg from '@/assets/npc/npc-engineer.png';
import gangsterImg from '@/assets/npc/npc-gangster.png';
import fixerImg from '@/assets/npc/npc-fixer.png';
import marauderImg from '@/assets/npc/npc-marauder.png';
import bossImg from '@/assets/enemies/boss-warmech.png';

export type NpcKind = 'vendor' | 'quest' | 'enemy';

const BY_NAME: Record<string, string> = {
  // Hub
  'Scout Junko': scoutImg,
  'Quartermaster Vex': vendorImg,
  'Commander Hale': scoutImg,
  'Doc Circuits': medicImg,
  'Tinker Mira': engineerImg,
  'Training Drone': enemyImg,
  // Neon District
  'Whisper': fixerImg,
  'Cyber-Doc Riku': medicImg,
  'Neon Gangster': gangsterImg,
  'Syndicate Enforcer': gangsterImg,
  'The Fixer': fixerImg,
  // Wasteland
  'Scrapper Drone': enemyImg,
  'Stranded Survivor': questImg,
  'Wasteland Marauder': marauderImg,
  'Rogue War-Mech': bossImg,
  'Wasteland Overlord': bossImg,
};

const FALLBACK: Record<NpcKind, string> = {
  vendor: vendorImg,
  quest: questImg,
  enemy: enemyImg,
};

export function isBossName(name: string): boolean {
  return /boss|warmech|overseer|tyrant|overlord|enforcer.?prime/i.test(name);
}

export function npcArtFor(name: string, kind: NpcKind): string {
  if (BY_NAME[name]) return BY_NAME[name];
  if (isBossName(name)) return bossImg;
  return FALLBACK[kind];
}
