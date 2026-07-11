import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildProviderSyncPreview,
  executeProviderSync,
} from "../lib/provider-sync-adapters";
import type { IntegrationConnection } from "../lib/local-storage";

describe("buildProviderSyncPreview", () => {
  it("returns a guided statement pipeline for broker statement uploads", () => {
    const preview = buildProviderSyncPreview({
      channel: "broker",
      id: "integration-paytm-money",
      importStrategy: "statement-upload",
      lastDetectedProviderSummary: "",
      lastImportedFileCount: 0,
      lastSyncAt: null,
      lastSyncMessage: "No sync has run yet.",
      lastSyncStatus: "idle",
      notes: "",
      providerId: "paytm-money",
      providerName: "Paytm Money",
      sourceHint: "Upload account statements or CSV exports first.",
      status: "active",
      syncHistory: [],
      syncCadenceMinutes: 720,
    } satisfies IntegrationConnection);

    assert.equal(preview.providerId, "paytm-money");
    assert.equal(preview.connectorStatus, "manual");
    assert.equal(preview.steps[0].stage, "ingest");
    assert.match(preview.summary, /exports|statements/i);
  });

  it("returns a ready email flow for email-forward connectors", () => {
    const preview = buildProviderSyncPreview({
      channel: "email",
      id: "integration-email-forward",
      importStrategy: "email-forward",
      lastDetectedProviderSummary: "",
      lastImportedFileCount: 0,
      lastSyncAt: null,
      lastSyncMessage: "No sync has run yet.",
      lastSyncStatus: "idle",
      notes: "",
      providerId: "email-forward",
      providerName: "Email Forward",
      sourceHint: "Forward broker statements to yourself and paste or upload them here.",
      status: "active",
      syncHistory: [],
      syncCadenceMinutes: 1440,
    } satisfies IntegrationConnection);

    assert.equal(preview.connectorStatus, "ready");
    assert.equal(preview.recommendedFiles[0], "Forwarded email body");
    assert.equal(preview.steps[0].title, "Collect forwarded statements");
  });

  it("returns structured execution output for email-forward connectors", () => {
    const execution = executeProviderSync({
      channel: "email",
      id: "integration-email-forward",
      importStrategy: "email-forward",
      lastDetectedProviderSummary: "",
      lastImportedFileCount: 0,
      lastSyncAt: null,
      lastSyncMessage: "No sync has run yet.",
      lastSyncStatus: "idle",
      notes: "",
      providerId: "email-forward",
      providerName: "Email Forward",
      sourceHint: "Forward broker statements to yourself and paste or upload them here.",
      status: "active",
      syncHistory: [],
      syncCadenceMinutes: 1440,
    } satisfies IntegrationConnection);

    assert.equal(execution.connectorStatus, "ready");
    assert.equal(execution.importedFileCount, 2);
    assert.equal(execution.jobStatus, "reviewed");
    assert.equal(execution.steps[0].status, "completed");
    assert.equal(execution.artifacts[0].kind, "email");
    assert.equal(execution.sourceLineage[0], "Forwarded email body collected");
    assert.match(execution.message, /forwarded email content/i);
  });

  it("uses provided source text to produce live execution artifacts", () => {
    const execution = executeProviderSync(
      {
        channel: "email",
        id: "integration-email-forward",
        importStrategy: "email-forward",
        lastDetectedProviderSummary: "",
        lastImportedFileCount: 0,
        lastSyncAt: null,
        lastSyncMessage: "No sync has run yet.",
        lastSyncStatus: "idle",
        notes: "",
        providerId: "email-forward",
        providerName: "Email Forward",
        sourceHint: "Forward broker statements to yourself and paste or upload them here.",
        status: "active",
        syncHistory: [],
        syncCadenceMinutes: 1440,
      } satisfies IntegrationConnection,
      {
        fileName: "forwarded-statement.txt",
        sourceText:
          "Forwarded message\nSubject: Statement attached\nScheme Name\tCurrent Value\tInvested Value\tUnits\nIndex Core\t180000\t158000\t734.69",
      },
    );

    assert.equal(execution.artifacts[0].label, "forwarded-statement.txt");
    assert.equal(execution.artifacts[2].kind, "payload");
    assert.match(execution.message, /provided source text|forwarded-statement\.txt/i);
    assert.equal(execution.jobStatus, "reviewed");
  });

  it("returns deferred execution artifacts for sync-ready connectors", () => {
    const execution = executeProviderSync({
      channel: "broker",
      id: "integration-direct",
      importStrategy: "sync-ready",
      lastDetectedProviderSummary: "",
      lastImportedFileCount: 0,
      lastSyncAt: null,
      lastSyncMessage: "No sync has run yet.",
      lastSyncStatus: "idle",
      notes: "",
      providerId: "paytm-money",
      providerName: "Paytm Money Direct",
      sourceHint: "Reserve auth for direct account access.",
      status: "active",
      syncHistory: [],
      syncCadenceMinutes: 60,
    } satisfies IntegrationConnection);

    assert.equal(execution.connectorStatus, "planned");
    assert.equal(execution.importedFileCount, 0);
    assert.equal(execution.artifacts[0].kind, "payload");
    assert.equal(execution.steps[2].status, "pending");
  });
});
