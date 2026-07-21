import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  appendBrokerSyncEvent,
  getBrokerSyncHistory,
  type BrokerConnection,
} from "../lib/broker-connections";

describe("broker sync history helpers", () => {
  it("appends and restores broker sync events from metadata", () => {
    const metadata = appendBrokerSyncEvent(
      {},
      {
        id: "event-1",
        importedFileCount: 4,
        message: "Zerodha holdings sync completed with 4 live holdings.",
        status: "success",
        syncedAt: "2026-07-17T09:15:00.000Z",
      },
    );

    const history = getBrokerSyncHistory({
      accessTokenExpiresAt: null,
      accountLabel: "Ash Zerodha",
      createdAt: "2026-07-17T08:00:00.000Z",
      errorMessage: "",
      externalAccountId: "zerodha-1",
      lastSyncedAt: "2026-07-17T09:15:00.000Z",
      metadata,
      provider: "zerodha",
      scopes: [],
      status: "connected",
      updatedAt: "2026-07-17T09:15:00.000Z",
    } satisfies BrokerConnection);

    assert.equal(history.length, 1);
    assert.equal(history[0]?.importedFileCount, 4);
    assert.match(history[0]?.message ?? "", /Zerodha holdings sync/i);
  });
});
