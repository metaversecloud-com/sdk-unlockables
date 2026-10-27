export interface ResolveInventoryItemInput {
  id?: string;
  name?: string;
  /** When set, only items whose `type` matches are considered. Prevents a badge named "Pumpkin Hat" from being resolved as an accessory, and vice versa. */
  type?: string;
}

export interface ResolveInventoryItemResult {
  item: any;
  /**
   * True when the id lookup missed and the item was resolved via the name
   * fallback. The caller should write the resolved item's `id` back onto
   * the stored record so the next lookup takes the fast path (self-heal).
   */
  resolvedByName: boolean;
}

/**
 * Resolve a stored inventory-item reference against a fresh inventory list.
 *
 * Why this exists: Unlockables ships to multiple Topia ecosystems. Each
 * ecosystem has its own inventory with its own item ids, and matching
 * items are maintained by hand (export/import can't help when the item
 * is ecosystem-specific). When a drop's data-object is copied from one
 * ecosystem to another, the ids stored on it don't resolve — the drop
 * then grants nothing. This helper tries the id first and, on miss,
 * falls back to an exact trimmed name match of the correct `type`.
 *
 * Ambiguous name matches (two items in the ecosystem sharing a name,
 * same type) log a warning and pick deterministically — lowest
 * `metadata.sortOrder`, then lowest `id`. Admins can rename to
 * disambiguate; a loud warning + a deterministic pick beats a silent
 * nothing-granted.
 *
 * Not a replacement for storing the correct id — it's the safety net
 * that lets a cross-ecosystem transfer self-heal on first successful
 * grant (see the backfill in `grantDropReward`).
 */
export const resolveInventoryItem = (
  inventoryItems: any[],
  { id, name, type }: ResolveInventoryItemInput,
): ResolveInventoryItemResult | undefined => {
  const matchesType = (item: any): boolean => !type || item?.type === type;

  if (id) {
    const byId = inventoryItems.find((i) => i?.id === id && matchesType(i));
    if (byId) return { item: byId, resolvedByName: false };
  }

  const trimmed = name?.trim();
  if (!trimmed) return undefined;

  const matches = inventoryItems.filter((i) => i?.name?.trim() === trimmed && matchesType(i));
  if (matches.length === 0) return undefined;
  if (matches.length === 1) return { item: matches[0], resolvedByName: true };

  console.warn(
    `resolveInventoryItem: ambiguous name match "${trimmed}"${type ? ` (type=${type})` : ""}: ${matches.length} candidates; picking by lowest sortOrder then id`,
  );
  const sorted = matches.slice().sort((a, b) => {
    const aOrder = a?.metadata?.sortOrder ?? 0;
    const bOrder = b?.metadata?.sortOrder ?? 0;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return String(a?.id).localeCompare(String(b?.id));
  });
  return { item: sorted[0], resolvedByName: true };
};
