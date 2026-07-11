import { NextResponse } from "next/server";
import {
  type ProviderSyncInput,
  buildProviderSyncPreview,
  executeProviderSync,
} from "@/lib/provider-sync-adapters";
import {
  executeIntegrationSyncBatch,
  type IntegrationSyncBatchMode,
} from "@/lib/integration-sync";
import {
  createIntegrationConnection,
  type IntegrationConnection,
  type ImportJob,
} from "@/lib/local-storage";

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    connection?: Partial<IntegrationConnection>;
    connectionId?: string;
    input?: ProviderSyncInput;
    importJobs?: ImportJob[];
    integrations?: Array<Partial<IntegrationConnection>>;
    mode?: IntegrationSyncBatchMode;
  };

  if (payload.integrations) {
    const integrations = payload.integrations.map((integration) =>
      createIntegrationConnection(integration),
    );
    const result = executeIntegrationSyncBatch(integrations, {
      connectionId: payload.connectionId,
      importJobs: payload.importJobs,
      mode: payload.mode,
    });

    return NextResponse.json(result);
  }

  const connection = createIntegrationConnection(payload.connection ?? {});

  return NextResponse.json({
    execution: executeProviderSync(connection, payload.input),
    preview: buildProviderSyncPreview(connection),
  });
}
