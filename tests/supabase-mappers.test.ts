import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mapImportJobRowToJob,
  mapImportDocumentRowToJob,
  mapImportJobToDocumentInsert,
  mapImportJobToInsert,
  mapImportSourceRowToIntegration,
  mapIntegrationToImportSourceInsert,
  mapMarketPreferenceRowToSettings,
  mapMarketPreferencesToInsert,
  mapAnswersToProfile,
  mapAssetToPortfolioInsert,
  mapGoalRowToGoal,
  mapGoalToInsert,
  mapPortfolioRowToAsset,
  mapProfileToAnswers,
  mapRiskProfileHistoryRow,
  mapTransactionRowToTransaction,
  mapTransactionToInsert,
  type ProfileRow,
} from "../lib/supabase-mappers";
import {
  defaultSnapshot,
  type MarketPreferences,
  type PortfolioTransaction,
  type WealthGoal,
} from "../lib/local-storage";
import type { RiskAnswers } from "../lib/wealth-rules";

const answers: RiskAnswers = {
  age: 40,
  annualIncome: 150000,
  country: "US",
  debtLevel: "none",
  emergencyMonths: 9,
  experience: "confident",
  horizonYears: 12,
  marketDropResponse: "buy",
  monthlyInvestment: 2500,
  monthlySavings: 5000,
  primaryGoal: "retirement",
  taxAwareness: "high",
  timeAvailable: "high",
};

describe("profile mappers", () => {
  it("maps app risk answers to a Supabase profile row shape", () => {
    assert.deepEqual(mapAnswersToProfile(answers), {
      age: 40,
      annual_income: 150000,
      country: "US",
      debt_level: "none",
      emergency_months: 9,
      experience: "confident",
      horizon_years: 12,
      market_drop_response: "buy",
      monthly_investment: 2500,
      monthly_savings: 5000,
      primary_goal: "retirement",
      tax_awareness: "high",
      time_available: "high",
    });
  });

  it("maps nullable Supabase profile values back to app defaults", () => {
    const row: ProfileRow = {
      age: null,
      annual_income: 90000,
      country: null,
      debt_level: null,
      emergency_months: null,
      experience: "some",
      horizon_years: 6,
      market_drop_response: null,
      monthly_investment: null,
      monthly_savings: 2000,
      primary_goal: "home",
      tax_awareness: null,
      time_available: "low",
    };

    const mapped = mapProfileToAnswers(row);

    assert.equal(mapped.age, defaultSnapshot.answers.age);
    assert.equal(mapped.annualIncome, 90000);
    assert.equal(mapped.country, defaultSnapshot.answers.country);
    assert.equal(mapped.experience, "some");
    assert.equal(mapped.primaryGoal, "home");
    assert.equal(mapped.timeAvailable, "low");
  });
});

describe("portfolio mappers", () => {
  it("maps portfolio rows and insert payloads", () => {
    const asset = mapPortfolioRowToAsset({
      asset_type: "Index Fund",
      current_price: null,
      current_value: 150000,
      gain_percent: null,
      invested_value: null,
      name: "Index Core",
      quantity: null,
      source_label: null,
    });

    assert.deepEqual(asset, {
      gain: 0,
      investedValue: 0,
      name: "Index Core",
      price: 0,
      quantity: 0,
      source: "Imported",
      type: "Index Fund",
      value: 150000,
    });

    assert.deepEqual(mapAssetToPortfolioInsert(asset, "user-1"), {
      asset_type: "Index Fund",
      current_price: 0,
      current_value: 150000,
      gain_percent: 0,
      invested_value: 0,
      name: "Index Core",
      quantity: 0,
      source_label: "Imported",
      user_id: "user-1",
    });
  });
});

describe("goal mappers", () => {
  const goal: WealthGoal = {
    annualReturn: 7,
    currentAmount: 10000,
    id: "goal-1",
    name: "Education",
    priority: "essential",
    targetAmount: 500000,
    years: 8,
  };

  it("maps goal rows and insert payloads", () => {
    assert.deepEqual(
      mapGoalRowToGoal({
        current_amount: 10000,
        expected_return: 7,
        id: "goal-1",
        name: "Education",
        priority: null,
        target_amount: 500000,
        years: 8,
      }),
      {
        ...goal,
        priority: "important",
      },
    );

    assert.deepEqual(mapGoalToInsert(goal, "user-1"), {
      current_amount: 10000,
      expected_return: 7,
      name: "Education",
      priority: "essential",
      target_amount: 500000,
      user_id: "user-1",
      years: 8,
    });
  });
});

describe("transaction mappers", () => {
  const transaction: PortfolioTransaction = {
    action: "buy",
    amount: 25000,
    assetName: "Index Core",
    date: "2026-07-11",
    id: "txn-1",
    notes: "Starter lot",
    price: 125,
    quantity: 200,
    source: "Manual",
    type: "Index Fund",
  };

  it("maps transaction rows and insert payloads", () => {
    assert.deepEqual(
      mapTransactionRowToTransaction({
        action_type: null,
        amount: 25000,
        asset_name: "Index Core",
        asset_type: null,
        created_at: "2026-07-11T00:00:00.000Z",
        id: "txn-1",
        notes: null,
        price: 125,
        quantity: 200,
        source_label: null,
        transaction_date: null,
      }),
      {
        ...transaction,
        action: "buy",
        date: "2026-07-11",
        notes: "",
        source: "Imported",
        type: "Other",
      },
    );

    assert.deepEqual(mapTransactionToInsert(transaction, "user-1"), {
      action_type: "buy",
      amount: 25000,
      asset_name: "Index Core",
      asset_type: "Index Fund",
      notes: "Starter lot",
      price: 125,
      quantity: 200,
      source_label: "Manual",
      transaction_date: "2026-07-11",
      user_id: "user-1",
    });
  });
});

describe("risk history mappers", () => {
  it("maps nullable risk history fields to app defaults", () => {
    assert.deepEqual(
      mapRiskProfileHistoryRow({
        band: "Balanced",
        confidence: null,
        created_at: "2026-07-09T00:00:00.000Z",
        id: "risk-1",
        personality: "Steady Explorer",
        score: 58,
        summary: null,
      }),
      {
        band: "Balanced",
        confidence: "Getting ready",
        createdAt: "2026-07-09T00:00:00.000Z",
        id: "risk-1",
        personality: "Steady Explorer",
        score: 58,
        summary: "Saved risk profile snapshot.",
      },
    );
  });
});

describe("integration mappers", () => {
  it("maps import source rows and insert payloads", () => {
    const mapped = mapImportSourceRowToIntegration({
      channel: "broker",
      id: "integration-1",
      last_synced_at: null,
      metadata: {
        importStrategy: "statement-upload",
        lastDetectedProviderSummary: "Paytm Money guided import path is available for statement PDFs and exports.",
        lastImportedFileCount: 2,
        lastSchedulerCheckAt: "2026-07-11T09:00:00.000Z",
        lastSchedulerMessage: "Scheduler ran 1 due connector.",
        lastSchedulerStatus: "success",
        lastSyncOrigin: "scheduled",
        lastSyncMessage: "Latest statement review completed.",
        lastSyncStatus: "success",
        notes: "Track broker statements",
        sourceHint: "Upload monthly statement",
        syncHistory: [
          {
            detectedProviderSummary: "Paytm Money guided import path is available for statement PDFs and exports.",
            id: "sync-1",
            importedFileCount: 2,
            message: "Latest statement review completed.",
            status: "success",
            syncedAt: "2026-07-10T00:00:00.000Z",
          },
        ],
        syncCadenceMinutes: 120,
      },
      provider_id: "paytm-money",
      provider_name: "Paytm Money",
      status: "active",
    });

    assert.equal(mapped.providerName, "Paytm Money");
    assert.equal(mapped.lastImportedFileCount, 2);
    assert.equal(mapped.lastSchedulerStatus, "success");
    assert.equal(mapped.lastSyncOrigin, "scheduled");
    assert.equal(mapped.lastSyncStatus, "success");
    assert.equal(mapped.syncHistory[0].status, "success");
    assert.equal(mapped.syncCadenceMinutes, 120);

    assert.deepEqual(mapIntegrationToImportSourceInsert(mapped, "user-1"), {
      channel: "broker",
      last_synced_at: null,
      metadata: {
        importStrategy: "statement-upload",
        lastDetectedProviderSummary: "Paytm Money guided import path is available for statement PDFs and exports.",
        lastImportedFileCount: 2,
        lastSchedulerCheckAt: "2026-07-11T09:00:00.000Z",
        lastSchedulerMessage: "Scheduler ran 1 due connector.",
        lastSchedulerStatus: "success",
        lastSyncOrigin: "scheduled",
        lastSyncMessage: "Latest statement review completed.",
        lastSyncStatus: "success",
        notes: "Track broker statements",
        sourceHint: "Upload monthly statement",
        syncHistory: [
          {
            detectedProviderSummary: "Paytm Money guided import path is available for statement PDFs and exports.",
            id: "sync-1",
            importedFileCount: 2,
            message: "Latest statement review completed.",
            status: "success",
            syncedAt: "2026-07-10T00:00:00.000Z",
          },
        ],
        syncCadenceMinutes: 120,
      },
      provider_id: "paytm-money",
      provider_name: "Paytm Money",
      status: "active",
      user_id: "user-1",
    });
  });
});

describe("market preference mappers", () => {
  it("maps market preference rows and insert payloads", () => {
    const preferences: MarketPreferences = {
      autoRefresh: true,
      includeHoldingsWatch: true,
      pollingIntervalSeconds: 60,
      preferredSource: "alpha-vantage",
    };

    assert.deepEqual(
      mapMarketPreferenceRowToSettings({
        auto_refresh: null,
        include_holdings_watch: false,
        polling_interval_seconds: 300,
        preferred_source: null,
      }),
      {
        autoRefresh: defaultSnapshot.marketPreferences.autoRefresh,
        includeHoldingsWatch: false,
        pollingIntervalSeconds: 300,
        preferredSource: defaultSnapshot.marketPreferences.preferredSource,
      },
    );

    assert.deepEqual(mapMarketPreferencesToInsert(preferences, "user-1"), {
      auto_refresh: true,
      include_holdings_watch: true,
      polling_interval_seconds: 60,
      preferred_source: "alpha-vantage",
      user_id: "user-1",
    });
  });
});

describe("import job mappers", () => {
  it("maps import job rows and insert payloads", () => {
    const mapped = mapImportJobRowToJob({
      created_assets: 4,
      created_at: "2026-07-11T00:00:00.000Z",
      created_transactions: 0,
      error_message: null,
      id: "job-1",
      import_document_id: "document-1",
      job_payload: {
        attemptCount: 2,
        documentId: "document-1",
        documentKind: "pdf-statement",
        documentStoragePath: "import-documents/document-1/cams.pdf",
        duplicateCount: 1,
        fileName: "cams.pdf",
        lastActionAt: "2026-07-11T01:00:00.000Z",
        normalizationApplied: ["Removed common registrar footer and pagination text"],
        normalizedText: "Scheme Name\tCurrent Value",
        parserProfileId: "cams",
        providerConfidence: "high",
        providerId: "cams",
        providerName: "CAMS",
        rawText: "Page 1 of 2\nScheme Name\tCurrent Value",
        reviewedCorrections: ["Merged duplicate folio rows."],
        rowWarnings: ["Duplicate detected for Axis Bluechip Fund (Mutual Fund)."],
        summary: "CAMS pdf statement looks import-ready (88/100).",
        usedOcr: false,
      },
      status: "completed",
    });

    assert.equal(mapped.assetCount, 4);
    assert.equal(mapped.attemptCount, 2);
    assert.equal(mapped.documentId, "document-1");
    assert.equal(mapped.documentStoragePath, "import-documents/document-1/cams.pdf");
    assert.equal(mapped.fileName, "cams.pdf");
    assert.equal(mapped.parserProfileId, "cams");
    assert.equal(mapped.status, "completed");

    assert.deepEqual(mapImportJobToInsert(mapped, "user-1"), {
      created_assets: 4,
      created_transactions: 0,
      error_message: null,
      import_document_id: "document-1",
      job_payload: {
        attemptCount: 2,
        documentId: "document-1",
        documentKind: "pdf-statement",
        documentStoragePath: "import-documents/document-1/cams.pdf",
        duplicateCount: 1,
        fileName: "cams.pdf",
        lastActionAt: "2026-07-11T01:00:00.000Z",
        normalizationApplied: ["Removed common registrar footer and pagination text"],
        normalizedText: "Scheme Name\tCurrent Value",
        parserProfileId: "cams",
        providerConfidence: "high",
        providerId: "cams",
        providerName: "CAMS",
        rawText: "Page 1 of 2\nScheme Name\tCurrent Value",
        reviewedCorrections: ["Merged duplicate folio rows."],
        rowWarnings: ["Duplicate detected for Axis Bluechip Fund (Mutual Fund)."],
        summary: "CAMS pdf statement looks import-ready (88/100).",
        usedOcr: false,
      },
      status: "completed",
      user_id: "user-1",
    });

    assert.deepEqual(mapImportJobToDocumentInsert(mapped, "user-1"), {
      id: "document-1",
      detected_provider: "cams",
      extracted_text: "Page 1 of 2\nScheme Name\tCurrent Value",
      file_name: "cams.pdf",
      file_type: "pdf-statement",
      import_status: "parsed",
      storage_path: "import-documents/document-1/cams.pdf",
      parse_summary: {
        duplicateCount: 1,
        normalizedText: "Scheme Name\tCurrent Value",
        parserProfileId: "cams",
        providerConfidence: "high",
        providerId: "cams",
        providerName: "CAMS",
        reviewedCorrections: ["Merged duplicate folio rows."],
        rowWarnings: ["Duplicate detected for Axis Bluechip Fund (Mutual Fund)."],
        selectedAssetCount: 4,
        summary: "CAMS pdf statement looks import-ready (88/100).",
        usedOcr: false,
      },
      user_id: "user-1",
    });
  });

  it("maps persisted import documents back to review jobs", () => {
    const mapped = mapImportDocumentRowToJob({
      created_at: "2026-07-11T00:00:00.000Z",
      detected_provider: "paytm-money",
      extracted_text: "raw statement text",
      file_name: "paytm.pdf",
      file_type: "pdf-statement",
      id: "document-1",
      import_status: "needs_review",
      storage_path: "import-documents/document-1/paytm.pdf",
      parse_summary: {
        duplicateCount: 2,
        normalizedText: "normalized statement text",
        parserProfileId: "paytm-money",
        providerConfidence: "medium",
        providerId: "paytm-money",
        providerName: "Paytm Money",
        reviewedCorrections: ["Confirmed merged folios."],
        rowWarnings: ["Units or price missing."],
        selectedAssetCount: 3,
        summary: "Paytm statement needs review.",
        usedOcr: true,
      },
    });

    assert.equal(mapped.id, "document-1");
    assert.equal(mapped.documentId, "document-1");
    assert.equal(mapped.documentStoragePath, "import-documents/document-1/paytm.pdf");
    assert.equal(mapped.fileName, "paytm.pdf");
    assert.equal(mapped.status, "reviewed");
    assert.equal(mapped.assetCount, 3);
    assert.equal(mapped.duplicateCount, 2);
    assert.equal(mapped.rawText, "raw statement text");
    assert.equal(mapped.normalizedText, "normalized statement text");
    assert.equal(mapped.usedOcr, true);
  });
});
