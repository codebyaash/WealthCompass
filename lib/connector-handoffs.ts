import type { EmailIngestionResult } from "./email-ingestion";
import { createConnectionFromTemplate } from "./connector-templates";
import type { ImportJob, IntegrationConnection } from "./local-storage";

export type SyncPlanSeed = {
  connection: IntegrationConnection;
  fileName: string;
  sourceText: string;
  templateId: string;
};

export function getConnectorTemplateIdForProvider(providerId: string | null) {
  switch (providerId) {
    case "paytm-money":
    case "groww":
    case "cams":
    case "kfintech":
    case "jupiter":
    case "zerodha":
    case "email-forward":
      return providerId;
    default:
      return "email-forward";
  }
}

export function buildSyncPlanSeedFromEmailResult({
  integrations,
  result,
}: {
  integrations: IntegrationConnection[];
  result: EmailIngestionResult;
}): SyncPlanSeed {
  const templateId = getConnectorTemplateIdForProvider(result.detectedProviderId);
  const preferredProviderIds = [
    result.detectedProviderId,
    templateId,
    result.sourceType === "body" ? "email-forward" : null,
  ].filter((value): value is string => Boolean(value));

  const matchedConnection =
    integrations.find((integration) => preferredProviderIds.includes(integration.providerId)) ??
    createConnectionFromTemplate(templateId);

  return {
    connection: matchedConnection,
    fileName: result.chosenInputLabel,
    sourceText: result.job.rawText || result.normalizedText,
    templateId,
  };
}

export function buildSyncPlanSeedFromImportJob({
  integrations,
  job,
}: {
  integrations: IntegrationConnection[];
  job: ImportJob;
}): SyncPlanSeed | null {
  const sourceText = job.rawText || job.normalizedText;

  if (!sourceText.trim()) return null;

  const templateId = getConnectorTemplateIdForProvider(job.providerId);
  const preferredProviderIds = [
    job.providerId,
    templateId,
    job.documentKind === "email-statement" ? "email-forward" : null,
  ].filter((value): value is string => Boolean(value));

  const matchedConnection =
    integrations.find((integration) => preferredProviderIds.includes(integration.providerId)) ??
    createConnectionFromTemplate(templateId);

  return {
    connection: matchedConnection,
    fileName: job.fileName,
    sourceText,
    templateId,
  };
}
