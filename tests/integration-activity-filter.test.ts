import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterAndSortIntegrations,
  type IntegrationActivityFilter,
} from "../lib/integration-sync";
import type { IntegrationConnection } from "../lib/local-storage";

const now = new Date("2026-07-17T12:00:00.000Z");

function makeIntegration(
  overrides: Partial<IntegrationConnection> & Pick<IntegrationConnection, "id" | "providerId" | "providerName">,
): IntegrationConnection {
  return {
    channel: "broker",
    importStrategy: "statement-upload",
    lastDetectedProviderSummary: "",
    lastSchedulerCheckAt: null,
    lastSchedulerMessage: "",
    lastSchedulerStatus: "idle",
    lastImportedFileCount: 0,
    lastSyncAt: null,
    lastSyncMessage: "",
    lastSyncOrigin: "manual",
    lastSyncStatus: "idle",
    notes: "",
    sourceHint: "",
    status: "active",
    syncHistory: [],
    syncCadenceMinutes: 60,
    ...overrides,
  };
}

describe("filterAndSortIntegrations", () => {
  const integrations: IntegrationConnection[] = [
    makeIntegration({
      id: "error",
      providerId: "groww",
      providerName: "Groww",
      status: "error",
    }),
    makeIntegration({
      id: "due",
      providerId: "zerodha",
      providerName: "Zerodha",
      importStrategy: "sync-ready",
      lastSyncAt: "2026-07-17T10:00:00.000Z",
    }),
    makeIntegration({
      id: "manual",
      providerId: "paytm-money",
      providerName: "Paytm Money",
      notes: "Use monthly statement uploads.",
    }),
  ];

  it("sorts urgent connectors ahead of the rest", () => {
    const result = filterAndSortIntegrations(integrations, { now });

    assert.deepEqual(
      result.map((integration) => integration.id),
      ["error", "due", "manual"],
    );
  });

  it("returns only attention connectors when requested", () => {
    const result = filterAndSortIntegrations(integrations, {
      filter: "attention" satisfies IntegrationActivityFilter,
      now,
    });

    assert.deepEqual(
      result.map((integration) => integration.id),
      ["error", "due"],
    );
  });

  it("returns only manual active connectors when requested", () => {
    const result = filterAndSortIntegrations(integrations, {
      filter: "manual" satisfies IntegrationActivityFilter,
      now,
    });

    assert.deepEqual(
      result.map((integration) => integration.id),
      ["manual"],
    );
  });

  it("applies free-text matching across provider metadata", () => {
    const result = filterAndSortIntegrations(integrations, {
      now,
      query: "monthly statement",
    });

    assert.deepEqual(
      result.map((integration) => integration.id),
      ["manual"],
    );
  });
});
