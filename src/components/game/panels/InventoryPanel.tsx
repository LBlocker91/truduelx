import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sword, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { fetchInventory, equipItem, unequipItem, InventoryItem } from '@/lib/inventory';

interface InventoryPanelProps {
  characterId: string;
  /** Called after equip/unequip so the overworld can re-fetch loadout. */
  onLoadoutChanged?: () => void;
}

const RARITY_COLOR: Record<string, string> = {
  common: 'text-muted-foreground border-muted',
  uncommon: 'text-neon-green border-neon-green/40',
  rare: 'text-primary border-primary/40',
  epic: 'text-neon-purple border-neon-purple/40',
  legendary: 'text-shield border-shield/40',
};

export const InventoryPanel = ({ characterId, onLoadoutChanged }: InventoryPanelProps) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await fetchInventory(characterId));
    } catch (e: any) {
      toast.error(`Inventory failed to load: ${e.message ?? e}`);
    } finally {
      setLoading(false);
    }
  }, [characterId]);

  useEffect(() => { refresh(); }, [refresh]);

  const toggle = async (it: InventoryItem) => {
    setBusyId(it.id);
    try {
      if (it.equipped) {
        await unequipItem(characterId, it.id, it.item.slot);
      } else {
        await equipItem(characterId, it.id, it.item_id, it.item.slot);
      }
      await refresh();
      onLoadoutChanged?.();
    } catch (e: any) {
      toast.error(`Action failed: ${e.message ?? e}`);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground text-sm">
        Inventory is empty. Defeat enemies and visit vendors to acquire gear.
      </div>
    );
  }

  // Group consumables separately from gear
  const consumables = items.filter(i => i.item.consumable);
  const gear = items.filter(i => !i.item.consumable);
  const slots = ['weapon', 'gun', 'launcher', 'staff', 'armor', 'wings', 'pet', 'helmet', 'gloves', 'boots', 'accessory'] as const;
  const grouped = slots.map((slot) => ({
    slot,
    items: gear.filter((i) => i.item.slot === slot),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4">
      {consumables.length > 0 && (
        <div>
          <h3 className="font-orbitron text-xs text-muted-foreground uppercase mb-2">Consumables</h3>
          <div className="space-y-2">
            {consumables.map((it) => (
              <div key={it.id} className={`game-card rounded-lg p-3 border ${RARITY_COLOR[it.item.rarity] ?? ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-orbitron text-sm truncate">{it.item.name}</h4>
                      <Badge variant="outline" className="text-[10px]">x{it.quantity}</Badge>
                    </div>
                    {it.item.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{it.item.description}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground/80 mt-0.5">
                      {it.item.subtype === 'hp_potion' ? 'Restores 50% HP' : it.item.subtype === 'mp_potion' ? 'Restores 50% MP' : ''}
                      {' · usable in battle'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
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
            {items.map((it) => (
              <div key={it.id} className={`game-card rounded-lg p-3 border ${RARITY_COLOR[it.item.rarity] ?? ''} ${it.equipped ? 'ring-1 ring-primary/60' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-orbitron text-sm truncate">{it.item.name}</h4>
                      <Badge variant="outline" className={`text-[10px] capitalize ${RARITY_COLOR[it.item.rarity] ?? ''}`}>
                        {it.item.rarity}
                      </Badge>
                      {it.equipped && <Badge className="text-[10px] bg-primary/80">EQUIPPED</Badge>}
                    </div>
                    {it.item.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{it.item.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>Lv {it.item.level_req}</span>
                      {it.item.min_damage != null && <span>{it.item.min_damage}-{it.item.max_damage} dmg</span>}
                      {it.item.defense > 0 && <span>+{it.item.defense} def</span>}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={it.equipped ? 'outline' : 'default'}
                    disabled={busyId === it.id}
                    onClick={() => toggle(it)}
                  >
                    {busyId === it.id ? <Loader2 className="w-3 h-3 animate-spin" /> : (it.equipped ? 'Unequip' : 'Equip')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
