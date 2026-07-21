import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createImportJob, createIntegrationConnection } from "../lib/local-storage";
import {
  applyRuntimeBrokerSyncResult,
  getRuntimeSyncEndpoint,
} from "../lib/runtime-connector-sync";

describe("runtime connector sync helpers", () => {
  it("returns the live sync endpoint for Zerodha connections", () => {
    assert.equal(
      getRuntimeSyncEndpoint(
        createIntegrationConnection({
          importStrategy: "sync-ready",
          providerId: "zerodha",
        }),
      ),
      "/api/broker/sync/zerodha",
    );

    assert.equal(
      getRuntimeSyncEndpoint(
        createIntegrationConnection({
          importStrategy: "statement-upload",
          providerId: "paytm-money",
        }),
      ),
      null,
    );
  });

  it("applies live broker sync results into holdings, jobs, and connector telemetry", () => {
    const connection = createIntegrationConnection({
      id: "integration-zerodha",
      importStrategy: "sync-ready",
      providerId: "zerodha",
      providerName: "Zerodha",
      status: "active",
    });
    const existingJob = createImportJob({
      id: "job-existing",
      providerId: "paytm-money",
      providerName: "Paytm Money",
      summary: "Older job.",
    });
    const syncedJob = createImportJob({
      id: "job-zerodha",
      providerId: "zerodha",
      providerName: "Zerodha",
      status: "completed",
      summary: "Zerodha holdings synced.",
    });

    const result = applyRuntimeBrokerSyncResult({
      connection,
      currentImportJobs: [existingJob],
      payload: {
        assets: [
          {
            gain: 4.2,
            investedValue: 145000,
            name: "Nifty Index Fund",
            price: 215,
            quantity: 750,
            source: "Zerodha Kite",
            type: "Index Fund",
            value: 161250,
          },
        ],
        job: syncedJob,
        providerAccountLabel: "Zerodha primary",
      },
      syncedAt: "2026-07-18T10:30:00.000Z",
    });

    assert.equal(result.nextAssets.length, 1);
    assert.equal(result.nextAssets[0]?.name, "Nifty Index Fund");
    assert.equal(result.nextImportJobs[0]?.id, "job-zerodha");
    assert.equal(result.nextImportJobs[1]?.id, "job-existing");
    assert.equal(result.nextConnection.lastSyncAt, "2026-07-18T10:30:00.000Z");
    assert.equal(result.nextConnection.lastSyncStatus, "success");
    assert.equal(result.nextConnection.lastSyncMessage, "Zerodha holdings synced.");
    assert.equal(result.nextConnection.syncHistory[0]?.importedFileCount, 1);
    assert.match(result.statusMessage, /Synced 1 holding/i);
  });

  it("records scheduled runtime sync telemetry when the scheduler runs a live connector", () => {
    const connection = createIntegrationConnection({
      id: "integration-zerodha-scheduled",
      importStrategy: "sync-ready",
      providerId: "zerodha",
      providerName: "Zerodha",
      status: "active",
    });
    const syncedJob = createImportJob({
      id: "job-zerodha-scheduled",
      providerId: "zerodha",
      providerName: "Zerodha",
      status: "completed",
      summary: "Scheduled Zerodha holdings sync completed.",
    });

    const result = applyRuntimeBrokerSyncResult({
      connection,
      currentImportJobs: [],
      origin: "scheduled",
      payload: {
        assets: [],
        job: syncedJob,
        providerAccountLabel: "Zerodha primary",
      },
      schedulerMessage: "Scheduler ran 1 live connector sync.",
      syncedAt: "2026-07-18T11:00:00.000Z",
    });

    assert.equal(result.nextConnection.lastSyncOrigin, "scheduled");
    assert.equal(result.nextConnection.lastSchedulerCheckAt, "2026-07-18T11:00:00.000Z");
    assert.equal(result.nextConnection.lastSchedulerMessage, "Scheduler ran 1 live connector sync.");
    assert.equal(result.nextConnection.lastSchedulerStatus, "success");
    assert.equal(result.nextConnection.lastSyncStatus, "warning");
    assert.match(result.statusMessage, /no holdings were returned/i);
  });
});
