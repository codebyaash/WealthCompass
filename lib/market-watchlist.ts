const marketWatchlistStorageKey = "wealthcompass:market-watchlist:v1";

export type MarketWatchlistEntry = {
  reviewedAt: string | null;
  sectorId: string;
};

function normalizeSectorId(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function normalizeWatchlistEntries(value: unknown): MarketWatchlistEntry[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const entries: MarketWatchlistEntry[] = [];

  for (const item of value) {
    if (typeof item === "string") {
      const sectorId = normalizeSectorId(item);
      if (!sectorId || seen.has(sectorId)) continue;
      seen.add(sectorId);
      entries.push({ reviewedAt: null, sectorId });
      continue;
    }

    if (!item || typeof item !== "object") continue;

    const sectorId = normalizeSectorId((item as { sectorId?: unknown }).sectorId);
    if (!sectorId || seen.has(sectorId)) continue;

    seen.add(sectorId);
    entries.push({
      reviewedAt:
        typeof (item as { reviewedAt?: unknown }).reviewedAt === "string"
          ? (item as { reviewedAt: string }).reviewedAt
          : null,
      sectorId,
    });
  }

  return entries;
}

export function loadMarketWatchlist(): MarketWatchlistEntry[] {
  if (typeof window === "undefined") return [];

  const raw = window.localStorage.getItem(marketWatchlistStorageKey);
  if (!raw) return [];

  try {
    return normalizeWatchlistEntries(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveMarketWatchlist(entries: MarketWatchlistEntry[]) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    marketWatchlistStorageKey,
    JSON.stringify(normalizeWatchlistEntries(entries)),
  );
}

export function toggleMarketWatchlistSector(
  sectorId: string,
  currentEntries: MarketWatchlistEntry[],
): MarketWatchlistEntry[] {
  const normalizedCurrent = normalizeWatchlistEntries(currentEntries);
  const next = normalizedCurrent.some((entry) => entry.sectorId === sectorId)
    ? normalizedCurrent.filter((entry) => entry.sectorId !== sectorId)
    : [...normalizedCurrent, { reviewedAt: null, sectorId }];

  saveMarketWatchlist(next);
  return next;
}

export function markMarketWatchlistSectorReviewed(
  sectorId: string,
  currentEntries: MarketWatchlistEntry[],
  reviewedAt: string = new Date().toISOString(),
): MarketWatchlistEntry[] {
  const normalizedCurrent = normalizeWatchlistEntries(currentEntries);
  const next = normalizedCurrent.map((entry) =>
    entry.sectorId === sectorId ? { ...entry, reviewedAt } : entry,
  );

  saveMarketWatchlist(next);
  return next;
}
