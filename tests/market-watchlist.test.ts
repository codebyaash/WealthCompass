import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  loadMarketWatchlist,
  markMarketWatchlistSectorReviewed,
  saveMarketWatchlist,
  toggleMarketWatchlistSector,
} from "../lib/market-watchlist";

const previousWindow = globalThis.window;

describe("market watchlist storage", () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: {
          getItem(key: string) {
            return storage.get(key) ?? null;
          },
          setItem(key: string, value: string) {
            storage.set(key, value);
          },
        },
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: previousWindow,
    });
  });

  it("stores and restores unique sector ids", () => {
    saveMarketWatchlist([
      { reviewedAt: null, sectorId: "it" },
      { reviewedAt: "2026-07-22T09:00:00.000Z", sectorId: "healthcare" },
      { reviewedAt: null, sectorId: "it" },
    ]);

    assert.deepEqual(loadMarketWatchlist(), [
      { reviewedAt: null, sectorId: "it" },
      { reviewedAt: "2026-07-22T09:00:00.000Z", sectorId: "healthcare" },
    ]);
  });

  it("adds and removes sectors from the watchlist", () => {
    let next = toggleMarketWatchlistSector("it", []);
    assert.deepEqual(next, [{ reviewedAt: null, sectorId: "it" }]);
    assert.deepEqual(loadMarketWatchlist(), [{ reviewedAt: null, sectorId: "it" }]);

    next = toggleMarketWatchlistSector("healthcare", next);
    assert.deepEqual(next, [
      { reviewedAt: null, sectorId: "it" },
      { reviewedAt: null, sectorId: "healthcare" },
    ]);

    next = toggleMarketWatchlistSector("it", next);
    assert.deepEqual(next, [{ reviewedAt: null, sectorId: "healthcare" }]);
    assert.deepEqual(loadMarketWatchlist(), [{ reviewedAt: null, sectorId: "healthcare" }]);
  });

  it("migrates legacy string arrays and marks sectors as reviewed", () => {
    storage.set("wealthcompass:market-watchlist:v1", JSON.stringify(["it", "energy"]));

    const loaded = loadMarketWatchlist();
    assert.deepEqual(loaded, [
      { reviewedAt: null, sectorId: "it" },
      { reviewedAt: null, sectorId: "energy" },
    ]);

    const next = markMarketWatchlistSectorReviewed(
      "energy",
      loaded,
      "2026-07-22T10:30:00.000Z",
    );

    assert.deepEqual(next, [
      { reviewedAt: null, sectorId: "it" },
      { reviewedAt: "2026-07-22T10:30:00.000Z", sectorId: "energy" },
    ]);
  });

  it("returns an empty watchlist when storage is invalid", () => {
    storage.set("wealthcompass:market-watchlist:v1", "{");

    assert.deepEqual(loadMarketWatchlist(), []);
  });
});
