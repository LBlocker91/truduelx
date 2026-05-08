import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sword, Shield, Coins, ChevronUp, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { fetchInventory, equipItem, unequipItem, sellItem, upgradeItem, InventoryItem } from '@/lib/inventory';
import {
  RARITY_TEXT, RARITY_BORDER, RARITY_MAX_UPGRADE, upgradeCost, sellValue, type Rarity,
} from '@/lib/rarity';

interface InventoryPanelProps {
  characterId: string;
  onLoadoutChanged?: () => void;
}

export const InventoryPanel = ({ characterId, onLoadoutChanged }: InventoryPanelProps) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setItems(await fetchInventory(characterId)); }
    catch (e: any) { toast.error(`Inventory failed to load: ${e.message ?? e}`); }
    finally { setLoading(false); }
  }, [characterId]);

  useEffect(() => { refresh(); }, [refresh]);

  const toggle = async (it: InventoryItem) => {
    setBusyId(it.id);
    try {
      if (it.equipped) await unequipItem(characterId, it.id, it.item.slot);
      else await equipItem(characterId, it.id, it.item_id, it.item.slot);
      await refresh();
      onLoadoutChanged?.();
    } catch (e: any) { toast.error(`Action failed: ${e.message ?? e}`); }
    finally { setBusyId(null); }
  };

  const onSell = async (it: InventoryItem) => {
    if (it.equipped) { toast.error('Unequip before selling'); return; }
    const refund = sellValue(Number(it.item.base_value ?? 50), it.upgrade_level ?? 0, 1);
    if (!confirm(`Sell 1× ${it.item.name} for ${refund.toLocaleString()} credits?`)) return;
    setBusyId(it.id);
    try {
      const res = await sellItem(characterId, it.id, 1);
      toast.success(`Sold for ${res.refund.toLocaleString()} credits`);
      await refresh();
      onLoadoutChanged?.();
    } catch (e: any) { toast.error(`Sell failed: ${e.message ?? e}`); }
    finally { setBusyId(null); }
  };

  const onUpgrade = async (it: InventoryItem) => {
    const max = RARITY_MAX_UPGRADE[it.item.rarity as Rarity] ?? 3;
    if ((it.upgrade_level ?? 0) >= max) { toast.error('Already max upgrade'); return; }
    const cost = upgradeCost(it.item.rarity as Rarity, it.upgrade_level ?? 0);
    const dia = cost.diamonds > 0 ? ` + ${cost.diamonds} 💎` : '';
    if (!confirm(`Upgrade ${it.item.name} to +${(it.upgrade_level ?? 0) + 1} for ${cost.credits.toLocaleString()} credits${dia}?`)) return;
    setBusyId(it.id);
    try {
      const res = await upgradeItem(characterId, it.id);
      toast.success(`${it.item.name} → +${res.newLevel}`);
      await refresh();
      onLoadoutChanged?.();
    } catch (e: any) { toast.error(`Upgrade failed: ${e.message ?? e}`); }
    finally { setBusyId(null); }
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (items.length === 0) return <div className="text-center py-10 text-muted-foreground text-sm">Inventory is empty. Defeat enemies and visit vendors to acquire gear.</div>;

  const consumables = items.filter(i => i.item.consumable);
  const gear = items.filter(i => !i.item.consumable);
  const slots = ['weapon', 'gun', 'launcher', 'armor', 'wings', 'pet', 'helmet', 'gloves', 'boots', 'accessory'] as const;
  const grouped = slots.map((slot) => ({ slot, items: gear.filter((i) => i.item.slot === slot) })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4">
      {consumables.length > 0 && (
        <div>
          <h3 className="font-orbitron text-xs text-muted-foreground uppercase mb-2">Consumables</h3>
          <div className="space-y-2">
            {consumables.map((it) => {
              const rarity = it.item.rarity as Rarity;
              return (
                <div key={it.id} className={`game-card rounded-lg p-3 border ${RARITY_BORDER[rarity] ?? ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className={`font-orbitron text-sm truncate ${RARITY_TEXT[rarity] ?? ''}`}>{it.item.name}</h4>
                        <Badge variant="outline" className="text-[10px]">x{it.quantity}</Badge>
                      </div>
                      {it.item.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{it.item.description}</p>}
                      <p className="text-[10px] text-muted-foreground/80 mt-0.5">
                        {it.item.subtype === 'hp_potion' ? 'Restores 50% HP' : it.item.subtype === 'mp_potion' ? 'Restores 50% MP' : ''}
                        {' · usable in battle'}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" disabled={busyId === it.id} onClick={() => onSell(it)} title="Sell one">
                      <Coins className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {grouped.map(({ slot, items }) => (
        <div key={slot}>
          <h3 className="font-orbitron text-xs text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
            {slot === 'weapon' ? <Sword className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
            {slot}
          </h3>
          <div className="space-y-2">
            {items.map((it) => {
              const rarity = it.item.rarity as Rarity;
              const up = it.upgrade_level ?? 0;
              const max = RARITY_MAX_UPGRADE[rarity] ?? 3;
              const refund = sellValue(Number(it.item.base_value ?? 50), up, 1);
              const nextCost = up < max ? upgradeCost(rarity, up) : null;
              return (
                <div key={it.id} className={`game-card rounded-lg p-3 border ${RARITY_BORDER[rarity] ?? ''} ${it.equipped ? 'ring-1 ring-primary/60' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className={`font-orbitron text-sm truncate ${RARITY_TEXT[rarity] ?? ''}`}>
                          {it.item.name}{up > 0 ? ` +${up}` : ''}
                        </h4>
                        <Badge variant="outline" className={`text-[10px] capitalize ${RARITY_TEXT[rarity] ?? ''}`}>{rarity}</Badge>
                        {it.equipped && <Badge className="text-[10px] bg-primary/80">EQUIPPED</Badge>}
                        {it.item.is_premium && <Badge className="text-[10px] bg-neon-purple/80">PREMIUM</Badge>}
                      </div>
                      {it.item.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{it.item.description}</p>}
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span>Lv {it.item.level_req}</span>
                        {it.item.min_damage != null && <span>{Math.round((it.item.min_damage ?? 0) * Math.pow(1.08, up))}-{Math.round((it.item.max_damage ?? 0) * Math.pow(1.08, up))} dmg</span>}
                        {it.item.defense > 0 && <span>+{Math.round(it.item.defense * Math.pow(1.08, up))} def</span>}
                        <span className="text-shield">Sell: {refund.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button size="sm" variant={it.equipped ? 'outline' : 'default'} disabled={busyId === it.id} onClick={() => toggle(it)}>
                        {busyId === it.id ? <Loader2 className="w-3 h-3 animate-spin" /> : (it.equipped ? 'Unequip' : 'Equip')}
                      </Button>
                      {nextCost && (
                        <Button size="sm" variant="outline" disabled={busyId === it.id} onClick={() => onUpgrade(it)} title={`Upgrade to +${up + 1} (${nextCost.credits.toLocaleString()} cr${nextCost.diamonds ? ` + ${nextCost.diamonds}💎` : ''})`}>
                          <ChevronUp className="w-3 h-3 mr-1" /> +{up + 1}
                        </Button>
                      )}
                      {!it.equipped && (
                        <Button size="sm" variant="ghost" className="text-destructive" disabled={busyId === it.id} onClick={() => onSell(it)} title="Sell">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
