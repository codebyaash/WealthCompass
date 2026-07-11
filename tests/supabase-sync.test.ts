import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createImportJob } from "../lib/local-storage";
import { persistCloudImportJob } from "../lib/supabase-sync";

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
        import_document_id: "document-1",
        job_payload: {
          attemptCount: 1,
          documentId: "document-1",
          documentKind: "pdf-statement",
          documentStoragePath: "import-documents/document-1/paytm-money.pdf",
          duplicateCount: 0,
          fileName: "paytm-money.pdf",
          lastActionAt: null,
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
        status: "reviewed",
        user_id: "user-1",
      },
      table: "import_jobs",
    });
  });
});
