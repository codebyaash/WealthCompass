import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createImportJob,
  createIntegrationConnection,
  emptySignedInSnapshot,
} from "../lib/local-storage";
import {
  loadCloudSnapshot,
  persistCloudImportJob,
  saveCloudSnapshot,
} from "../lib/supabase-sync";
import { coerceSupabaseUuid } from "../lib/supabase-mappers";

describe("loadCloudSnapshot", () => {
  it("clears connector-only cloud residue into an empty signed-in workspace", async () => {
    const profileRow = {
      age: 29,
      annual_income: 1200000,
      country: "India",
      debt_level: "manageable",
      emergency_months: 4,
      experience: "new",
      horizon_years: 8,
      market_drop_response: "wait",
      monthly_investment: 12000,
      monthly_savings: 30000,
      primary_goal: "home",
      tax_awareness: "low",
      time_available: "medium",
    };

    const supabase = {
      from(table: string) {
        return {
          eq() {
            return this;
          },
          maybeSingle: async () => {
            if (table === "profiles") {
              return { data: profileRow, error: null };
            }

            if (table === "market_preferences") {
              return {
                data: {
                  auto_refresh: true,
                  include_holdings_watch: true,
                  polling_interval_seconds: 60,
                  preferred_source: "alpha-vantage",
                },
                error: null,
              };
            }

            return { data: null, error: null };
          },
          order() {
            return this;
          },
          returns: async () => {
            if (table === "import_sources") {
              return {
                data: [
                  {
                    channel: "broker",
                    id: "integration-groww",
                    last_synced_at: "2026-07-11T10:00:00.000Z",
                    metadata: {
                      lastSyncMessage: "Needs review.",
                      lastSyncStatus: "warning",
                    },
                    provider_id: "groww",
                    provider_name: "Groww",
                    status: "active",
                  },
                ],
                error: null,
              };
            }

            if (table === "import_jobs") {
              return {
                data: [
                  {
                    created_assets: 0,
                    created_at: "2026-07-11T10:00:00.000Z",
                    created_transactions: 0,
                    error_message: null,
                    id: "job-1",
                    import_document_id: "doc-1",
                    job_payload: {
                      documentId: "doc-1",
                      fileName: "groww.pdf",
                      localStatus: "reviewed",
                      providerId: "groww",
                      providerName: "Groww",
                      summary: "Needs review.",
                    },
                    status: "completed",
                  },
                ],
                error: null,
              };
            }

            return { data: [], error: null };
          },
          select() {
            return this;
          },
        };
      },
    } as const;

    const { snapshot, updatedAt } = await loadCloudSnapshot(supabase as never, "user-1");

    assert.equal(snapshot.assets.length, 0);
    assert.equal(snapshot.transactions.length, 0);
    assert.equal(snapshot.goals.length, 0);
    assert.equal(snapshot.integrations.length, 0);
    assert.equal(snapshot.importJobs.length, 0);
    assert.equal(snapshot.answers.country, "India");
    assert.equal(updatedAt, "2026-07-11T10:00:00.000Z");
  });

  it("keeps meaningful import history and merges job payload with document metadata", async () => {
    const supabase = {
      from(table: string) {
        return {
          eq() {
            return this;
          },
          maybeSingle: async () => ({ data: null, error: null }),
          order() {
            return this;
          },
          returns: async () => {
            if (table === "import_jobs") {
              return {
                data: [
                  {
                    created_assets: 0,
                    created_at: "2026-07-11T10:00:00.000Z",
                    created_transactions: 0,
                    error_message: null,
                    id: "job-1",
                    import_document_id: "doc-1",
                    job_payload: {
                      documentId: "doc-1",
                      fileName: "paytm.pdf",
                      localStatus: "reviewed",
                      providerId: "paytm-money",
                      providerName: "Paytm Money",
                      summary: "Needs review.",
                    },
                    status: "completed",
                  },
                ],
                error: null,
              };
            }

            if (table === "import_documents") {
              return {
                data: [
                  {
                    created_at: "2026-07-11T10:00:00.000Z",
                    detected_provider: "paytm-money",
                    extracted_text: "raw statement text",
                    file_name: "paytm.pdf",
                    file_type: "pdf-statement",
                    id: "doc-1",
                    import_status: "needs_review",
                    parse_summary: {
                      duplicateCount: 1,
                      normalizedText: "normalized statement text",
                      providerConfidence: "medium",
                      providerId: "paytm-money",
                      providerName: "Paytm Money",
                      rowWarnings: ["Units missing."],
                      selectedAssetCount: 2,
                      summary: "Paytm statement needs review.",
                      usedOcr: true,
                    },
                    storage_path: "import-documents/doc-1/paytm.pdf",
                  },
                ],
                error: null,
              };
            }

            return { data: [], error: null };
          },
          select() {
            return this;
          },
        };
      },
    } as const;

    const { snapshot, updatedAt } = await loadCloudSnapshot(supabase as never, "user-1");

    assert.equal(snapshot.importJobs.length, 1);
    assert.equal(snapshot.importJobs[0]?.documentStoragePath, "import-documents/doc-1/paytm.pdf");
    assert.equal(snapshot.importJobs[0]?.assetCount, 2);
    assert.equal(snapshot.importJobs[0]?.usedOcr, true);
    assert.equal(snapshot.importJobs[0]?.status, "reviewed");
    assert.equal(updatedAt, "2026-07-11T10:00:00.000Z");
  });

  it("loads a full signed-in workspace with tracked portfolio, goals, connectors, and transaction-aware import history", async () => {
    const profileRow = {
      age: 31,
      annual_income: 1800000,
      country: "India",
      debt_level: "manageable",
      emergency_months: 6,
      experience: "some",
      horizon_years: 12,
      market_drop_response: "buy",
      monthly_investment: 30000,
      monthly_savings: 50000,
      primary_goal: "wealth",
      tax_awareness: "medium",
      time_available: "medium",
      updated_at: "2026-07-17T08:00:00.000Z",
    };

    const supabase = {
      from(table: string) {
        return {
          eq() {
            return this;
          },
          maybeSingle: async () => {
            if (table === "profiles") {
              return { data: profileRow, error: null };
            }

            if (table === "market_preferences") {
              return {
                data: {
                  auto_refresh: false,
                  created_at: "2026-07-17T07:30:00.000Z",
                  include_holdings_watch: false,
                  polling_interval_seconds: 300,
                  preferred_source: "fallback",
                  updated_at: "2026-07-17T11:00:00.000Z",
                },
                error: null,
              };
            }

            return { data: null, error: null };
          },
          order() {
            return this;
          },
          returns: async () => {
            if (table === "portfolio_assets") {
              return {
                data: [
                  {
                    asset_type: "Mutual Fund",
                    created_at: "2026-07-17T08:30:00.000Z",
                    current_price: 1234.16,
                    current_value: 1000,
                    gain_percent: 2.5,
                    invested_value: 975,
                    name: "HDFC Large Cap Fund Direct Plan-Growth",
                    quantity: 0.81,
                    source_label: "Imported",
                    updated_at: "2026-07-17T08:35:00.000Z",
                  },
                ],
                error: null,
              };
            }

            if (table === "goals") {
              return {
                data: [
                  {
                    current_amount: 250000,
                    expected_return: 10,
                    id: "goal-home",
                    name: "Home down payment",
                    priority: "important",
                    target_amount: 2000000,
                    updated_at: "2026-07-17T09:00:00.000Z",
                    years: 6,
                  },
                ],
                error: null,
              };
            }

            if (table === "portfolio_transactions") {
              return {
                data: [
                  {
                    action_type: "buy",
                    amount: 1000,
                    asset_name: "HDFC Large Cap Fund Direct Plan-Growth",
                    asset_type: "Mutual Fund",
                    created_at: "2026-07-17T09:15:00.000Z",
                    id: "txn-1",
                    notes: "Imported from statement",
                    price: 1234.159,
                    quantity: 0.81,
                    source_label: "Imported",
                    transaction_date: "2026-07-03",
                  },
                ],
                error: null,
              };
            }

            if (table === "import_sources") {
              return {
                data: [
                  {
                    channel: "broker",
                    created_at: "2026-07-17T08:10:00.000Z",
                    id: "integration-paytm",
                    last_synced_at: "2026-07-17T10:00:00.000Z",
                    metadata: {
                      importStrategy: "statement-upload",
                      lastDetectedProviderSummary: "Paytm statement review is ready.",
                      lastImportedFileCount: 1,
                      lastSchedulerCheckAt: "2026-07-17T10:05:00.000Z",
                      lastSchedulerMessage: "Manual source reviewed recently.",
                      lastSchedulerStatus: "success",
                      lastSyncMessage: "Paytm Money sync plan reviewed and staged in import history using 1 parsed input.",
                      lastSyncOrigin: "manual",
                      lastSyncStatus: "success",
                      notes: "Primary statement lane",
                      sourceHint: "Upload account statements or CSV exports first.",
                      syncCadenceMinutes: 720,
                      syncHistory: [
                        {
                          detectedProviderSummary: "Paytm statement review is ready.",
                          id: "sync-1",
                          importedFileCount: 1,
                          message: "Paytm Money sync plan reviewed and staged in import history using 1 parsed input.",
                          status: "success",
                          syncedAt: "2026-07-17T10:00:00.000Z",
                        },
                      ],
                    },
                    provider_id: "paytm-money",
                    provider_name: "Paytm Money",
                    status: "active",
                    updated_at: "2026-07-17T10:00:00.000Z",
                  },
                ],
                error: null,
              };
            }

            if (table === "import_jobs") {
              return {
                data: [
                  {
                    created_assets: 1,
                    created_at: "2026-07-17T10:00:00.000Z",
                    created_transactions: 1,
                    error_message: null,
                    id: "job-1",
                    import_document_id: "doc-1",
                    job_payload: {
                      attemptCount: 1,
                      documentId: "doc-1",
                      documentKind: "pdf-statement",
                      documentStoragePath: "import-documents/doc-1/paytm.pdf",
                      duplicateCount: 0,
                      fileName: "paytm.pdf",
                      localStatus: "completed",
                      normalizedText: "normalized statement text",
                      providerConfidence: "medium",
                      providerId: "paytm-money",
                      providerName: "Paytm Money",
                      rawText: "statement text",
                      rowWarnings: [],
                      summary: "Paytm statement imported.",
                      usedOcr: true,
                    },
                    status: "completed",
                  },
                ],
                error: null,
              };
            }

            if (table === "import_documents") {
              return {
                data: [
                  {
                    created_at: "2026-07-17T10:00:00.000Z",
                    detected_provider: "paytm-money",
                    extracted_text: "statement text",
                    file_name: "paytm.pdf",
                    file_type: "pdf-statement",
                    id: "doc-1",
                    import_status: "parsed",
                    parse_summary: {
                      duplicateCount: 0,
                      normalizedText: "normalized statement text",
                      providerConfidence: "medium",
                      providerId: "paytm-money",
                      providerName: "Paytm Money",
                      rowWarnings: [],
                      selectedAssetCount: 1,
                      selectedTransactionCount: 1,
                      summary: "Paytm statement imported.",
                      usedOcr: true,
                    },
                    storage_path: "import-documents/doc-1/paytm.pdf",
                  },
                ],
                error: null,
              };
            }

            return { data: [], error: null };
          },
          select() {
            return this;
          },
        };
      },
    } as const;

    const { snapshot, updatedAt } = await loadCloudSnapshot(supabase as never, "user-1");

    assert.equal(snapshot.answers.country, "India");
    assert.equal(snapshot.assets.length, 1);
    assert.equal(snapshot.assets[0]?.name, "HDFC Large Cap Fund Direct Plan-Growth");
    assert.equal(snapshot.goals.length, 1);
    assert.equal(snapshot.goals[0]?.name, "Home down payment");
    assert.equal(snapshot.transactions.length, 1);
    assert.equal(snapshot.transactions[0]?.assetName, "HDFC Large Cap Fund Direct Plan-Growth");
    assert.equal(snapshot.integrations.length, 1);
    assert.equal(snapshot.integrations[0]?.providerId, "paytm-money");
    assert.equal(snapshot.importJobs.length, 1);
    assert.equal(snapshot.importJobs[0]?.assetCount, 1);
    assert.equal(snapshot.importJobs[0]?.transactionCount, 1);
    assert.equal(snapshot.importJobs[0]?.usedOcr, true);
    assert.equal(snapshot.marketPreferences.autoRefresh, false);
    assert.equal(snapshot.marketPreferences.preferredSource, "fallback");
    assert.equal(updatedAt, "2026-07-17T11:00:00.000Z");
  });
});

describe("persistCloudImportJob", () => {
  it("upserts the profile, import document, and import job for a signed-in user", async () => {
    const operations: Array<{
      action: string;
      payload?: unknown;
      table: string;
    }> = [];
    const filters = new Map<string, Record<string, unknown>>();

    const supabase = {
      from(table: string) {
        return {
          eq(field: string, value: unknown) {
            const current = filters.get(table) ?? {};
            filters.set(table, { ...current, [field]: value });
            return this;
          },
          maybeSingle: async () => ({
            data: table === "import_sources" ? { id: "source-1" } : null,
            error: null,
          }),
          select() {
            operations.push({ action: "select", table });
            return this;
          },
          upsert: async (payload: unknown) => {
            operations.push({ action: "upsert", payload, table });
            return { error: null };
          },
        };
      },
    } as const;

    const job = createImportJob({
      documentId: "document-1",
      documentKind: "pdf-statement",
      documentStoragePath: "import-documents/document-1/paytm-money.pdf",
      fileName: "paytm-money.pdf",
      providerId: "paytm-money",
      providerName: "Paytm Money",
      rawText: "statement text",
      status: "reviewed",
      summary: "Paytm statement needs review.",
    });

    await persistCloudImportJob({
      job,
      supabase: supabase as never,
      userId: "user-1",
    });

    assert.deepEqual(filters.get("import_sources"), {
      provider_id: "paytm-money",
      user_id: "user-1",
    });

    assert.equal(operations[0]?.table, "profiles");
    assert.equal(operations[0]?.action, "upsert");
    assert.equal(
      typeof (operations[0]?.payload as { updated_at?: string })?.updated_at,
      "string",
    );
    assert.equal(
      (operations[0]?.payload as { id?: string })?.id,
      "user-1",
    );

    assert.deepEqual(operations[2], {
      action: "upsert",
      payload: {
        detected_provider: "paytm-money",
        extracted_text: "statement text",
        file_name: "paytm-money.pdf",
        file_type: "pdf-statement",
        id: coerceSupabaseUuid("document-1"),
        import_source_id: "source-1",
        import_status: "needs_review",
        parse_summary: {
          duplicateCount: 0,
          normalizedText: "",
          parserProfileId: null,
          providerConfidence: "low",
          providerId: "paytm-money",
          providerName: "Paytm Money",
          reviewedCorrections: [],
          rowWarnings: [],
          selectedAssetCount: 0,
          selectedTransactionCount: 0,
          summary: "Paytm statement needs review.",
          usedOcr: false,
        },
        storage_path: "import-documents/document-1/paytm-money.pdf",
        user_id: "user-1",
      },
      table: "import_documents",
    });

    assert.deepEqual(operations[3], {
      action: "upsert",
      payload: {
        created_assets: 0,
        created_transactions: 0,
        error_message: null,
        id: coerceSupabaseUuid(job.id),
        import_document_id: coerceSupabaseUuid("document-1"),
        job_payload: {
          attemptCount: 1,
          documentId: coerceSupabaseUuid("document-1"),
          documentKind: "pdf-statement",
          documentStoragePath: "import-documents/document-1/paytm-money.pdf",
          duplicateCount: 0,
          fileName: "paytm-money.pdf",
          lastActionAt: null,
          localStatus: "reviewed",
          normalizationApplied: [],
          normalizedText: "",
          parserProfileId: null,
          providerConfidence: "low",
          providerId: "paytm-money",
          providerName: "Paytm Money",
          rawText: "statement text",
          reviewedCorrections: [],
          rowWarnings: [],
          summary: "Paytm statement needs review.",
          usedOcr: false,
        },
        status: "completed",
        user_id: "user-1",
      },
      table: "import_jobs",
    });
  });
});

describe("saveCloudSnapshot", () => {
  it("writes import sources before documents and jobs so linkages stay intact", async () => {
    const operations: Array<{
      action: string;
      payload?: unknown;
      table: string;
    }> = [];
    const filters = new Map<string, Record<string, unknown>>();

    const supabase = {
      from(table: string) {
        return {
          delete() {
            operations.push({ action: "delete", table });
            return this;
          },
          eq(field: string, value: unknown) {
            const current = filters.get(table) ?? {};
            filters.set(table, { ...current, [field]: value });
            return this;
          },
          insert: async (payload: unknown) => {
            operations.push({ action: "insert", payload, table });
            return { error: null };
          },
          upsert: async (payload: unknown) => {
            operations.push({ action: "upsert", payload, table });
            return { error: null };
          },
        };
      },
    } as const;

    const integration = createIntegrationConnection({
      channel: "broker",
      id: "source-paytm",
      importStrategy: "statement-upload",
      providerId: "paytm-money",
      providerName: "Paytm Money",
      status: "active",
    });
    const job = createImportJob({
      assetCount: 2,
      documentId: "document-paytm-1",
      documentKind: "pdf-statement",
      documentStoragePath: "import-documents/document-paytm-1/paytm.pdf",
      fileName: "paytm.pdf",
      providerId: "paytm-money",
      providerName: "Paytm Money",
      rawText: "statement text",
      status: "reviewed",
      summary: "Paytm statement needs review.",
      usedOcr: true,
    });

    await saveCloudSnapshot({
      snapshot: {
        ...emptySignedInSnapshot,
        importJobs: [job],
        integrations: [integration],
      },
      supabase: supabase as never,
      userId: "user-1",
    });

    assert.deepEqual(filters.get("import_sources"), { user_id: "user-1" });
    assert.deepEqual(filters.get("import_documents"), { user_id: "user-1" });
    assert.deepEqual(filters.get("import_jobs"), { user_id: "user-1" });

    const importSourcesInsertIndex = operations.findIndex(
      (entry) => entry.action === "insert" && entry.table === "import_sources",
    );
    const importDocumentsInsertIndex = operations.findIndex(
      (entry) => entry.action === "insert" && entry.table === "import_documents",
    );
    const importJobsInsertIndex = operations.findIndex(
      (entry) => entry.action === "insert" && entry.table === "import_jobs",
    );

    assert.ok(importSourcesInsertIndex >= 0);
    assert.ok(importDocumentsInsertIndex > importSourcesInsertIndex);
    assert.ok(importJobsInsertIndex > importDocumentsInsertIndex);

    assert.deepEqual(operations[importDocumentsInsertIndex], {
      action: "insert",
      payload: [
        {
          detected_provider: "paytm-money",
          extracted_text: "statement text",
          file_name: "paytm.pdf",
          file_type: "pdf-statement",
          id: coerceSupabaseUuid("document-paytm-1"),
          import_source_id: coerceSupabaseUuid("source-paytm"),
          import_status: "needs_review",
          parse_summary: {
            duplicateCount: 0,
            normalizedText: "",
            parserProfileId: null,
            providerConfidence: "low",
            providerId: "paytm-money",
            providerName: "Paytm Money",
            reviewedCorrections: [],
            rowWarnings: [],
            selectedAssetCount: 2,
            selectedTransactionCount: 0,
            summary: "Paytm statement needs review.",
            usedOcr: true,
          },
          storage_path: "import-documents/document-paytm-1/paytm.pdf",
          user_id: "user-1",
        },
      ],
      table: "import_documents",
    });

    assert.deepEqual(operations[importJobsInsertIndex], {
      action: "insert",
      payload: [
        {
          created_assets: 2,
          created_transactions: 0,
          error_message: null,
          id: coerceSupabaseUuid(job.id),
          import_document_id: coerceSupabaseUuid("document-paytm-1"),
          job_payload: {
            attemptCount: 1,
            documentId: coerceSupabaseUuid("document-paytm-1"),
            documentKind: "pdf-statement",
            documentStoragePath: "import-documents/document-paytm-1/paytm.pdf",
            duplicateCount: 0,
            fileName: "paytm.pdf",
            lastActionAt: null,
            localStatus: "reviewed",
            normalizationApplied: [],
            normalizedText: "",
            parserProfileId: null,
            providerConfidence: "low",
            providerId: "paytm-money",
            providerName: "Paytm Money",
            rawText: "statement text",
            reviewedCorrections: [],
            rowWarnings: [],
            summary: "Paytm statement needs review.",
            usedOcr: true,
          },
          status: "completed",
          user_id: "user-1",
        },
      ],
      table: "import_jobs",
    });
  });

  it("normalizes non-uuid local ids before saving goals, sources, and import linkages", async () => {
    const operations: Array<{
      action: string;
      payload?: unknown;
      table: string;
    }> = [];

    const supabase = {
      from(table: string) {
        return {
          delete() {
            operations.push({ action: "delete", table });
            return this;
          },
          eq() {
            return this;
          },
          insert: async (payload: unknown) => {
            operations.push({ action: "insert", payload, table });
            return { error: null };
          },
          upsert: async (payload: unknown) => {
            operations.push({ action: "upsert", payload, table });
            return { error: null };
          },
        };
      },
    } as const;

    const integration = createIntegrationConnection({
      channel: "broker",
      id: "integration-paytm-money",
      importStrategy: "statement-upload",
      providerId: "paytm-money",
      providerName: "Paytm Money",
      status: "active",
    });
    const job = createImportJob({
      documentId: "document-paytm-statement",
      documentKind: "pdf-statement",
      fileName: "paytm.pdf",
      id: "job-paytm-review",
      providerId: "paytm-money",
      providerName: "Paytm Money",
      rawText: "statement text",
      status: "reviewed",
      summary: "Paytm statement needs review.",
    });

    await saveCloudSnapshot({
      snapshot: {
        ...emptySignedInSnapshot,
        goals: [
          {
            annualReturn: 10,
            currentAmount: 100000,
            id: "goal-home-down-payment",
            name: "Home down payment",
            priority: "important",
            targetAmount: 1200000,
            years: 5,
          },
        ],
        importJobs: [job],
        integrations: [integration],
      },
      supabase: supabase as never,
      userId: "user-1",
    });

    const goalsInsert = operations.find(
      (entry) => entry.action === "insert" && entry.table === "goals",
    )?.payload as Array<{ id: string }> | undefined;
    const sourcesInsert = operations.find(
      (entry) => entry.action === "insert" && entry.table === "import_sources",
    )?.payload as Array<{ id: string }> | undefined;
    const documentsInsert = operations.find(
      (entry) => entry.action === "insert" && entry.table === "import_documents",
    )?.payload as Array<{ id: string; import_source_id: string | null }> | undefined;
    const jobsInsert = operations.find(
      (entry) => entry.action === "insert" && entry.table === "import_jobs",
    )?.payload as Array<{
      id: string;
      import_document_id: string;
      job_payload: { documentId: string };
    }> | undefined;

    assert.equal(goalsInsert?.[0]?.id, coerceSupabaseUuid("goal-home-down-payment"));
    assert.equal(
      sourcesInsert?.[0]?.id,
      coerceSupabaseUuid("integration-paytm-money"),
    );
    assert.equal(
      documentsInsert?.[0]?.id,
      coerceSupabaseUuid("document-paytm-statement"),
    );
    assert.equal(
      documentsInsert?.[0]?.import_source_id,
      coerceSupabaseUuid("integration-paytm-money"),
    );
    assert.equal(
      jobsInsert?.[0]?.id,
      coerceSupabaseUuid("job-paytm-review"),
    );
    assert.equal(
      jobsInsert?.[0]?.import_document_id,
      coerceSupabaseUuid("document-paytm-statement"),
    );
    assert.equal(
      jobsInsert?.[0]?.job_payload.documentId,
      coerceSupabaseUuid("document-paytm-statement"),
    );
  });

  it("writes a full mixed workspace payload with assets, goals, transactions, integrations, import jobs, and market preferences", async () => {
    const operations: Array<{
      action: string;
      payload?: unknown;
      table: string;
    }> = [];

    const supabase = {
      from(table: string) {
        return {
          delete() {
            operations.push({ action: "delete", table });
            return this;
          },
          eq() {
            return this;
          },
          insert: async (payload: unknown) => {
            operations.push({ action: "insert", payload, table });
            return { error: null };
          },
          upsert: async (payload: unknown) => {
            operations.push({ action: "upsert", payload, table });
            return { error: null };
          },
        };
      },
    } as const;

    const integration = createIntegrationConnection({
      channel: "broker",
      id: "integration-paytm-money",
      importStrategy: "statement-upload",
      lastDetectedProviderSummary: "Paytm statement review is ready.",
      lastImportedFileCount: 1,
      lastSchedulerCheckAt: "2026-07-17T10:05:00.000Z",
      lastSchedulerMessage: "Manual source reviewed recently.",
      lastSchedulerStatus: "success",
      lastSyncAt: "2026-07-17T10:00:00.000Z",
      lastSyncOrigin: "manual",
      lastSyncMessage:
        "Paytm Money sync plan reviewed and staged in import history using 1 parsed input.",
      lastSyncStatus: "success",
      notes: "Primary statement lane",
      providerId: "paytm-money",
      providerName: "Paytm Money",
      sourceHint: "Upload account statements or CSV exports first.",
      status: "active",
      syncCadenceMinutes: 720,
      syncHistory: [
        {
          detectedProviderSummary: "Paytm statement review is ready.",
          id: "sync-1",
          importedFileCount: 1,
          message:
            "Paytm Money sync plan reviewed and staged in import history using 1 parsed input.",
          status: "success",
          syncedAt: "2026-07-17T10:00:00.000Z",
        },
      ],
    });
    const job = createImportJob({
      assetCount: 1,
      createdAt: "2026-07-17T10:00:00.000Z",
      documentId: "document-paytm-1",
      documentKind: "pdf-statement",
      documentStoragePath: "import-documents/document-paytm-1/paytm.pdf",
      duplicateCount: 0,
      fileName: "paytm.pdf",
      id: "job-paytm-1",
      normalizedText: "normalized statement text",
      providerConfidence: "medium",
      providerId: "paytm-money",
      providerName: "Paytm Money",
      rawText: "statement text",
      rowWarnings: [],
      status: "completed",
      summary: "Paytm statement imported.",
      transactionCount: 1,
      usedOcr: true,
    });

    await saveCloudSnapshot({
      snapshot: {
        answers: {
          age: 31,
          annualIncome: 1800000,
          country: "India",
          decisionStyle: "guided",
          debtLevel: "manageable",
          dependents: 0,
          emergencyMonths: 6,
          experience: "some",
          horizonYears: 12,
          incomeStability: "steady",
          liquidityNeeds: "medium",
          marketDropResponse: "buy",
          postLearningDropResponse: "buy",
          monthlyInvestment: 30000,
          monthlySavings: 50000,
          primaryGoal: "wealth",
          taxAwareness: "medium",
          timeAvailable: "medium",
        },
        assets: [
          {
            gain: 2.5,
            investedValue: 975,
            name: "HDFC Large Cap Fund Direct Plan-Growth",
            price: 1234.159,
            quantity: 0.81,
            source: "Imported",
            type: "Mutual Fund",
            value: 1000,
          },
        ],
        goals: [
          {
            annualReturn: 10,
            currentAmount: 250000,
            id: "goal-home",
            name: "Home down payment",
            priority: "important",
            targetAmount: 2000000,
            years: 6,
          },
        ],
        importJobs: [job],
        integrations: [integration],
        marketPreferences: {
          autoRefresh: false,
          includeHoldingsWatch: false,
          pollingIntervalSeconds: 300,
          preferredSource: "fallback",
          watchlist: [],
        },
        transactions: [
          {
            action: "buy",
            amount: 1000,
            assetName: "HDFC Large Cap Fund Direct Plan-Growth",
            date: "2026-07-03",
            id: "txn-1",
            notes: "Imported from statement",
            price: 1234.159,
            quantity: 0.81,
            source: "Imported",
            type: "Mutual Fund",
          },
        ],
      },
      supabase: supabase as never,
      userId: "user-1",
    });

    const profileUpsert = operations.find(
      (entry) => entry.action === "upsert" && entry.table === "profiles",
    )?.payload as Record<string, unknown> | undefined;
    const assetsInsert = operations.find(
      (entry) => entry.action === "insert" && entry.table === "portfolio_assets",
    )?.payload as Array<Record<string, unknown>> | undefined;
    const goalsInsert = operations.find(
      (entry) => entry.action === "insert" && entry.table === "goals",
    )?.payload as Array<Record<string, unknown>> | undefined;
    const transactionsInsert = operations.find(
      (entry) => entry.action === "insert" && entry.table === "portfolio_transactions",
    )?.payload as Array<Record<string, unknown>> | undefined;
    const sourcesInsert = operations.find(
      (entry) => entry.action === "insert" && entry.table === "import_sources",
    )?.payload as Array<Record<string, unknown>> | undefined;
    const documentsInsert = operations.find(
      (entry) => entry.action === "insert" && entry.table === "import_documents",
    )?.payload as Array<Record<string, unknown>> | undefined;
    const jobsInsert = operations.find(
      (entry) => entry.action === "insert" && entry.table === "import_jobs",
    )?.payload as Array<Record<string, unknown>> | undefined;
    const marketPreferencesUpsert = operations.find(
      (entry) => entry.action === "upsert" && entry.table === "market_preferences",
    )?.payload as Record<string, unknown> | undefined;

    assert.equal(profileUpsert?.country, "India");
    assert.equal(profileUpsert?.monthly_investment, 30000);

    assert.deepEqual(assetsInsert, [
      {
        asset_type: "Mutual Fund",
        current_price: 1234.159,
        current_value: 1000,
        gain_percent: 2.5,
        invested_value: 975,
        name: "HDFC Large Cap Fund Direct Plan-Growth",
        quantity: 0.81,
        source_label: "Imported",
        user_id: "user-1",
      },
    ]);

    assert.deepEqual(goalsInsert, [
      {
        current_amount: 250000,
        expected_return: 10,
        id: coerceSupabaseUuid("goal-home"),
        name: "Home down payment",
        priority: "important",
        target_amount: 2000000,
        user_id: "user-1",
        years: 6,
      },
    ]);

    assert.deepEqual(transactionsInsert, [
      {
        action_type: "buy",
        amount: 1000,
        asset_name: "HDFC Large Cap Fund Direct Plan-Growth",
        asset_type: "Mutual Fund",
        notes: "Imported from statement",
        price: 1234.159,
        quantity: 0.81,
        source_label: "Imported",
        transaction_date: "2026-07-03",
        user_id: "user-1",
      },
    ]);

    assert.deepEqual(sourcesInsert, [
      {
        channel: "broker",
        id: coerceSupabaseUuid("integration-paytm-money"),
        last_synced_at: "2026-07-17T10:00:00.000Z",
        metadata: {
          importStrategy: "statement-upload",
          lastDetectedProviderSummary: "Paytm statement review is ready.",
          lastImportedFileCount: 1,
          lastSchedulerCheckAt: "2026-07-17T10:05:00.000Z",
          lastSchedulerMessage: "Manual source reviewed recently.",
          lastSchedulerStatus: "success",
          lastSyncOrigin: "manual",
          lastSyncMessage:
            "Paytm Money sync plan reviewed and staged in import history using 1 parsed input.",
          lastSyncStatus: "success",
          notes: "Primary statement lane",
          sourceHint: "Upload account statements or CSV exports first.",
          syncCadenceMinutes: 720,
          syncHistory: [
            {
              detectedProviderSummary: "Paytm statement review is ready.",
              id: "sync-1",
              importedFileCount: 1,
              message:
                "Paytm Money sync plan reviewed and staged in import history using 1 parsed input.",
              status: "success",
              syncedAt: "2026-07-17T10:00:00.000Z",
            },
          ],
        },
        provider_id: "paytm-money",
        provider_name: "Paytm Money",
        status: "active",
        user_id: "user-1",
      },
    ]);

    assert.deepEqual(documentsInsert, [
      {
        detected_provider: "paytm-money",
        extracted_text: "statement text",
        file_name: "paytm.pdf",
        file_type: "pdf-statement",
        id: coerceSupabaseUuid("document-paytm-1"),
        import_source_id: coerceSupabaseUuid("integration-paytm-money"),
        import_status: "parsed",
        parse_summary: {
          duplicateCount: 0,
          normalizedText: "normalized statement text",
          parserProfileId: null,
          providerConfidence: "medium",
          providerId: "paytm-money",
          providerName: "Paytm Money",
          reviewedCorrections: [],
          rowWarnings: [],
          selectedAssetCount: 1,
          selectedTransactionCount: 1,
          summary: "Paytm statement imported.",
          usedOcr: true,
        },
        storage_path: "import-documents/document-paytm-1/paytm.pdf",
        user_id: "user-1",
      },
    ]);

    assert.deepEqual(jobsInsert, [
      {
        created_assets: 1,
        created_transactions: 1,
        error_message: null,
        id: coerceSupabaseUuid("job-paytm-1"),
        import_document_id: coerceSupabaseUuid("document-paytm-1"),
        job_payload: {
          attemptCount: 1,
          documentId: coerceSupabaseUuid("document-paytm-1"),
          documentKind: "pdf-statement",
          documentStoragePath: "import-documents/document-paytm-1/paytm.pdf",
          duplicateCount: 0,
          fileName: "paytm.pdf",
          lastActionAt: null,
          localStatus: "completed",
          normalizationApplied: [],
          normalizedText: "normalized statement text",
          parserProfileId: null,
          providerConfidence: "medium",
          providerId: "paytm-money",
          providerName: "Paytm Money",
          rawText: "statement text",
          reviewedCorrections: [],
          rowWarnings: [],
          summary: "Paytm statement imported.",
          usedOcr: true,
        },
        status: "completed",
        user_id: "user-1",
      },
    ]);

    assert.equal(marketPreferencesUpsert?.auto_refresh, false);
    assert.equal(marketPreferencesUpsert?.include_holdings_watch, false);
    assert.equal(marketPreferencesUpsert?.polling_interval_seconds, 300);
    assert.equal(marketPreferencesUpsert?.preferred_source, "fallback");
    assert.equal(marketPreferencesUpsert?.user_id, "user-1");
    assert.equal(typeof marketPreferencesUpsert?.updated_at, "string");
  });
});
