import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  appendInboxSyncEvent,
  buildInboxOperationsSummary,
  getInboxConnectionHealth,
  getInboxSyncHistory,
  inboxProviderDescriptors,
  type InboxConnection,
} from "../lib/inbox-connections";

const gmailProvider = inboxProviderDescriptors.find((provider) => provider.id === "gmail");

if (!gmailProvider) {
  throw new Error("Expected gmail provider descriptor to exist.");
}

describe("getInboxConnectionHealth", () => {
  it("treats missing providers as awaiting auth", () => {
    const health = getInboxConnectionHealth(gmailProvider, null);

    assert.equal(health.readiness, "awaiting-auth");
    assert.match(health.detail, /not connected yet/i);
  });

  it("treats connected inbox providers as ready", () => {
    const health = getInboxConnectionHealth(gmailProvider, {
      accessTokenExpiresAt: null,
      createdAt: "2026-07-17T06:00:00.000Z",
      errorMessage: "",
      externalAccountId: "gmail-1",
      lastMessageAt: "2026-07-17T07:00:00.000Z",
      lastSyncedAt: "2026-07-17T07:05:00.000Z",
      metadata: {},
      provider: "gmail",
      providerAccountEmail: "user@gmail.com",
      scopes: [],
      status: "connected",
      syncCursor: null,
      updatedAt: "2026-07-17T07:05:00.000Z",
    });

    assert.equal(health.readiness, "ready");
    assert.match(health.title, /ready/i);
  });

  it("surfaces paused and error states as attention", () => {
    const health = getInboxConnectionHealth(gmailProvider, {
      accessTokenExpiresAt: null,
      createdAt: "2026-07-17T06:00:00.000Z",
      errorMessage: "OAuth token expired.",
      externalAccountId: "gmail-1",
      lastMessageAt: null,
      lastSyncedAt: null,
      metadata: {},
      provider: "gmail",
      providerAccountEmail: "user@gmail.com",
      scopes: [],
      status: "paused",
      syncCursor: null,
      updatedAt: "2026-07-17T07:05:00.000Z",
    });

    assert.equal(health.readiness, "attention");
    assert.match(health.detail, /expired/i);
  });
});

describe("buildInboxOperationsSummary", () => {
  it("counts connected, needs-auth, and attention providers", () => {
    const connections: InboxConnection[] = [
      {
        accessTokenExpiresAt: null,
        createdAt: "2026-07-17T06:00:00.000Z",
        errorMessage: "",
        externalAccountId: "gmail-1",
        lastMessageAt: null,
        lastSyncedAt: null,
        metadata: {},
        provider: "gmail",
        providerAccountEmail: "user@gmail.com",
        scopes: [],
        status: "connected",
        syncCursor: null,
        updatedAt: "2026-07-17T07:05:00.000Z",
      },
      {
        accessTokenExpiresAt: null,
        createdAt: "2026-07-17T06:00:00.000Z",
        errorMessage: "Reconnect needed.",
        externalAccountId: "outlook-1",
        lastMessageAt: null,
        lastSyncedAt: null,
        metadata: {},
        provider: "outlook",
        providerAccountEmail: "user@outlook.com",
        scopes: [],
        status: "error",
        syncCursor: null,
        updatedAt: "2026-07-17T07:05:00.000Z",
      },
    ];

    const summary = buildInboxOperationsSummary(inboxProviderDescriptors, connections);

    assert.equal(summary.connectedCount, 1);
    assert.equal(summary.attentionCount, 1);
    assert.equal(summary.needsAuthCount, 0);
    assert.match(summary.nextActionLabel, /reconnect/i);
  });
});

describe("inbox sync history helpers", () => {
  it("appends and restores inbox sync events from metadata", () => {
    const metadata = appendInboxSyncEvent(
      {},
      {
        fetchedMessageCount: 3,
        id: "event-1",
        importedFileCount: 1,
        message: "Paytm Money email statement looks import-ready (85/100).",
        status: "success",
        syncedAt: "2026-07-17T08:30:00.000Z",
      },
    );

    const history = getInboxSyncHistory({
      accessTokenExpiresAt: null,
      createdAt: "2026-07-17T06:00:00.000Z",
      errorMessage: "",
      externalAccountId: "gmail-1",
      lastMessageAt: null,
      lastSyncedAt: "2026-07-17T08:30:00.000Z",
      metadata,
      provider: "gmail",
      providerAccountEmail: "user@gmail.com",
      scopes: [],
      status: "connected",
      syncCursor: null,
      updatedAt: "2026-07-17T08:30:00.000Z",
    });

    assert.equal(history.length, 1);
    assert.equal(history[0]?.fetchedMessageCount, 3);
    assert.match(history[0]?.message ?? "", /Paytm Money/i);
  });
});
