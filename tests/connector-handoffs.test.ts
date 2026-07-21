import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSyncPlanSeedFromEmailResult,
  buildSyncPlanSeedFromImportJob,
} from "../lib/connector-handoffs";
import { createImportJob } from "../lib/local-storage";
import type { EmailIngestionResult } from "../lib/email-ingestion";
import type { IntegrationConnection } from "../lib/local-storage";

const emailForwardConnection: IntegrationConnection = {
  channel: "email",
  id: "integration-email-forward",
  importStrategy: "email-forward",
  lastDetectedProviderSummary: "",
  lastImportedFileCount: 0,
  lastSchedulerCheckAt: null,
  lastSchedulerMessage: "Scheduler has not checked this source yet.",
  lastSchedulerStatus: "idle",
  lastSyncAt: null,
  lastSyncMessage: "No sync has run yet.",
  lastSyncOrigin: null,
  lastSyncStatus: "idle",
  notes: "",
  providerId: "email-forward",
  providerName: "Email Forward",
  sourceHint: "Forward statements into the intake pipeline.",
  status: "active",
  syncCadenceMinutes: 1440,
  syncHistory: [],
};

const paytmEmailResult: EmailIngestionResult = {
  chosenInputLabel: "paytm-money-june-statement.txt",
  detectedProviderId: "paytm-money",
  diagnostics: {
    afterSnippet: "Scheme Name\tCurrent Value\tInvested Value\tUnits\nIndex Core\t1000\t950\t10",
    beforeSnippet: "Forwarded message\nScheme Name\tCurrent Value\tInvested Value\tUnits\nIndex Core\t1000\t950\t10",
    normalizedText: "Scheme Name\tCurrent Value\tInvested Value\tUnits\nIndex Core\t1000\t950\t10",
    parsedRows: [
      {
        currentValue: 1000,
        gain: 50,
        investedValue: 950,
        name: "Index Core",
        notes: [],
        price: 100,
        quantity: 10,
        source: "Imported",
        status: "new",
        type: "Other",
      },
    ],
    rawText: "Forwarded message\nScheme Name\tCurrent Value\tInvested Value\tUnits\nIndex Core\t1000\t950\t10",
    rowWarnings: [],
    summary: {
      duplicateCount: 0,
      newCount: 1,
      parsedCount: 1,
      reviewCount: 0,
      totalCurrentValue: 1000,
      totalInvestedValue: 950,
      warningCount: 0,
    },
  },
  job: {
    assetCount: 1,
    attemptCount: 1,
    createdAt: "2026-07-17T09:00:00.000Z",
    transactionCount: 0,
    documentId: "doc-paytm",
    documentKind: "email-statement",
    documentStoragePath: "import-documents/user/doc-paytm/paytm-money-june-statement.txt",
    duplicateCount: 0,
    fileName: "paytm-money-june-statement.txt",
    id: "job-paytm",
    lastActionAt: "2026-07-17T09:00:00.000Z",
    notes: "Email intake",
    normalizationApplied: [],
    normalizedText: "Scheme Name\tCurrent Value\tInvested Value\tUnits\nIndex Core\t1000\t950\t10",
    parserProfileId: "paytm-money",
    providerConfidence: "high",
    providerId: "paytm-money",
    providerName: "Paytm Money",
    rawText: "Forwarded message\nScheme Name\tCurrent Value\tInvested Value\tUnits\nIndex Core\t1000\t950\t10",
    reviewedCorrections: [],
    rowWarnings: [],
    status: "reviewed",
    summary: "Paytm Money email statement looks import-ready.",
    usedOcr: false,
  },
  normalizedText: "Scheme Name\tCurrent Value\tInvested Value\tUnits\nIndex Core\t1000\t950\t10",
  review: {
    cues: [],
    detectedSource: {
      category: "broker",
      hints: ["paytm money", "paytmmoney", "paytm", "bse star mf"],
      id: "paytm-money",
      name: "Paytm Money",
      readiness: "guided-import",
      supports: ["csv", "email", "pdf", "text"],
      summary: "Works through exports, statements, and pasted email content.",
    },
    documentKind: "email-statement",
    guidance: [],
    normalizationApplied: [],
    parseReadiness: "high",
    parserProfile: null,
    providerConfidence: "high",
    qualityScore: 90,
    summary: "Paytm Money email statement looks import-ready.",
    textLength: 90,
    transactionCount: 0,
    usedOcr: false,
  },
  sourceType: "attachment",
};

describe("connector handoffs", () => {
  it("reuses a matching integration when provider detection succeeds", () => {
    const integration: IntegrationConnection = {
      ...emailForwardConnection,
      channel: "broker",
      id: "integration-paytm",
      importStrategy: "statement-upload",
      providerId: "paytm-money",
      providerName: "Paytm Money",
    };

    const seed = buildSyncPlanSeedFromEmailResult({
      integrations: [emailForwardConnection, integration],
      result: paytmEmailResult,
    });

    assert.equal(seed.connection.id, "integration-paytm");
    assert.equal(seed.templateId, "paytm-money");
    assert.equal(seed.fileName, "paytm-money-june-statement.txt");
    assert.match(seed.sourceText, /Forwarded message/);
  });

  it("falls back to a template connection when no matching integration exists", () => {
    const seed = buildSyncPlanSeedFromEmailResult({
      integrations: [emailForwardConnection],
      result: paytmEmailResult,
    });

    assert.equal(seed.connection.providerId, "paytm-money");
    assert.equal(seed.connection.providerName, "Paytm Money");
    assert.equal(seed.templateId, "paytm-money");
  });

  it("defaults unknown email providers to the email-forward connector", () => {
    const seed = buildSyncPlanSeedFromEmailResult({
      integrations: [emailForwardConnection],
      result: {
        ...paytmEmailResult,
        detectedProviderId: null,
        sourceType: "body",
      },
    });

    assert.equal(seed.connection.providerId, "email-forward");
    assert.equal(seed.templateId, "email-forward");
  });

  it("reopens an import job in the sync plan using the matching provider connection", () => {
    const integration: IntegrationConnection = {
      ...emailForwardConnection,
      channel: "broker",
      id: "integration-paytm",
      importStrategy: "statement-upload",
      providerId: "paytm-money",
      providerName: "Paytm Money",
    };
    const job = createImportJob({
      assetCount: 2,
      documentId: "document-1",
      documentKind: "statement-pdf",
      fileName: "paytm-money-july.txt",
      normalizedText: "Scheme Name\tCurrent Value\nIndex Core\t180000",
      providerId: "paytm-money",
      providerName: "Paytm Money",
      rawText: "Scheme Name\tCurrent Value\nIndex Core\t180000",
      status: "reviewed",
      summary: "Paytm statement parsed.",
    });

    const seed = buildSyncPlanSeedFromImportJob({
      integrations: [emailForwardConnection, integration],
      job,
    });

    assert.ok(seed);
    assert.equal(seed.connection.providerId, "paytm-money");
    assert.equal(seed.fileName, "paytm-money-july.txt");
    assert.match(seed.sourceText, /Index Core/);
  });

  it("returns null when an import job has no saved payload to reopen", () => {
    const job = createImportJob({
      assetCount: 0,
      documentId: "document-2",
      documentKind: "table-export",
      fileName: "empty.txt",
      normalizedText: "",
      providerId: "groww",
      providerName: "Groww",
      rawText: "",
      status: "received",
      summary: "No source saved yet.",
    });

    const seed = buildSyncPlanSeedFromImportJob({
      integrations: [emailForwardConnection],
      job,
    });

    assert.equal(seed, null);
  });
});
