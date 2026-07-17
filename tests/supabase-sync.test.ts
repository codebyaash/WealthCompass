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

    const snapshot = await loadCloudSnapshot(supabase as never, "user-1");

    assert.equal(snapshot.assets.length, 0);
    assert.equal(snapshot.transactions.length, 0);
    assert.equal(snapshot.goals.length, 0);
    assert.equal(snapshot.integrations.length, 0);
    assert.equal(snapshot.importJobs.length, 0);
    assert.equal(snapshot.answers.country, "India");
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

    const snapshot = await loadCloudSnapshot(supabase as never, "user-1");

    assert.equal(snapshot.importJobs.length, 1);
    assert.equal(snapshot.importJobs[0]?.documentStoragePath, "import-documents/doc-1/paytm.pdf");
    assert.equal(snapshot.importJobs[0]?.assetCount, 2);
    assert.equal(snapshot.importJobs[0]?.usedOcr, true);
    assert.equal(snapshot.importJobs[0]?.status, "reviewed");
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
        id: "document-1",
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
        id: job.id,
        import_document_id: "document-1",
        job_payload: {
          attemptCount: 1,
          documentId: "document-1",
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
          id: "document-paytm-1",
          import_source_id: "source-paytm",
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
          id: job.id,
          import_document_id: "document-paytm-1",
          job_payload: {
            attemptCount: 1,
            documentId: "document-paytm-1",
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
});
