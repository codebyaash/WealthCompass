import { NextResponse } from "next/server";
import {
  buildProviderSyncPreview,
  executeProviderSync,
  type ProviderSyncInput,
} from "@/lib/provider-sync-adapters";
import {
  createIntegrationConnection,
  type IntegrationConnection,
} from "@/lib/local-storage";

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    connection?: Partial<IntegrationConnection>;
    input?: ProviderSyncInput;
  };

  const connection = createIntegrationConnection(payload.connection ?? {});

  return NextResponse.json({
    execution: executeProviderSync(connection, payload.input),
    preview: buildProviderSyncPreview(connection),
  });
}
