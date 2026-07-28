import type {
  IntegrationConnection,
  IntegrationSyncEvent,
  ImportJob,
  MarketPreferences,
  PortfolioAsset,
  PortfolioTransaction,
  WealthGoal,
} from "./local-storage";
import { defaultSnapshot } from "./local-storage";
import type { RiskAnswers, RiskProfile } from "./wealth-rules";

export type ProfileRow = {
  age: number | null;
  annual_income: number | null;
  country: string | null;
  decision_style: RiskAnswers["decisionStyle"] | null;
  debt_level: RiskAnswers["debtLevel"] | null;
  dependents: number | null;
  emergency_months: number | null;
  experience: RiskAnswers["experience"] | null;
  horizon_years: number | null;
  income_stability: RiskAnswers["incomeStability"] | null;
  liquidity_needs: RiskAnswers["liquidityNeeds"] | null;
  market_drop_response: RiskAnswers["marketDropResponse"] | null;
  post_learning_drop_response: RiskAnswers["postLearningDropResponse"] | null;
  monthly_investment: number | null;
  monthly_savings: number | null;
  primary_goal: RiskAnswers["primaryGoal"] | null;
  tax_awareness: RiskAnswers["taxAwareness"] | null;
  time_available: RiskAnswers["timeAvailable"] | null;
  updated_at?: string | null;
};

export type PortfolioRow = {
  asset_type: string;
  created_at?: string | null;
  current_value: number;
  current_price: number | null;
  gain_percent: number | null;
  invested_value: number | null;
  name: string;
  quantity: number | null;
  source_label: string | null;
  updated_at?: string | null;
};

export type GoalRow = {
  current_amount: number;
  expected_return: number;
  id: string;
  name: string;
  priority: WealthGoal["priority"] | null;
  target_amount: number;
  updated_at?: string | null;
  years: number;
};

export type PortfolioTransactionRow = {
  action_type: PortfolioTransaction["action"] | null;
  amount: number | null;
  asset_name: string;
  created_at: string;
  id: string;
  notes: string | null;
  price: number | null;
  quantity: number | null;
  source_label: string | null;
  transaction_date: string | null;
  asset_type: string | null;
};

export type RiskProfileHistoryRow = {
  band: RiskProfile["band"];
  confidence: RiskProfile["confidence"] | null;
  created_at: string;
  id: string;
  personality: string;
  score: number;
  summary: string | null;
};

export type ImportSourceRow = {
  channel: IntegrationConnection["channel"] | null;
  created_at?: string | null;
  id: string;
  last_synced_at: string | null;
  metadata: {
    importStrategy?: IntegrationConnection["importStrategy"];
    lastDetectedProviderSummary?: string;
    lastImportedFileCount?: number;
    lastSchedulerCheckAt?: string | null;
    lastSchedulerMessage?: string;
    lastSchedulerStatus?: IntegrationConnection["lastSchedulerStatus"];
    lastSyncOrigin?: IntegrationConnection["lastSyncOrigin"];
    lastSyncMessage?: string;
    lastSyncStatus?: IntegrationConnection["lastSyncStatus"];
    notes?: string;
    sourceHint?: string;
    syncHistory?: IntegrationSyncEvent[];
    syncCadenceMinutes?: number;
  } | null;
  provider_id: string;
  provider_name: string;
  status: IntegrationConnection["status"] | null;
  updated_at?: string | null;
};

export type MarketPreferenceRow = {
  auto_refresh: boolean | null;
  created_at?: string | null;
  include_holdings_watch: boolean | null;
  polling_interval_seconds: number | null;
  preferred_source: MarketPreferences["preferredSource"] | null;
  updated_at?: string | null;
};

export type ImportJobRow = {
  created_assets: number | null;
  created_transactions: number | null;
  error_message: string | null;
  id: string;
  import_document_id: string | null;
  job_payload: {
    documentId?: string;
    documentStoragePath?: string | null;
    fileName?: string;
    normalizationApplied?: string[];
    normalizedText?: string;
    parserProfileId?: string | null;
    providerConfidence?: ImportJob["providerConfidence"];
    providerId?: string | null;
    providerName?: string;
    rawText?: string;
    reviewedCorrections?: string[];
    rowWarnings?: string[];
    summary?: string;
    usedOcr?: boolean;
    attemptCount?: number;
    duplicateCount?: number;
    documentKind?: string;
    lastActionAt?: string | null;
    localStatus?: ImportJob["status"];
  } | null;
  completed_at?: string | null;
  started_at?: string | null;
  status: "completed" | "failed" | "processing" | "queued" | null;
};

export type ImportDocumentRow = {
  created_at: string;
  detected_provider: string | null;
  extracted_text: string | null;
  file_name: string;
  file_type: string;
  id: string;
  import_status: "failed" | "needs_review" | "parsed" | "received" | null;
  storage_path: string | null;
  parse_summary: {
    duplicateCount?: number;
    normalizedText?: string;
    parserProfileId?: string | null;
    providerConfidence?: ImportJob["providerConfidence"];
    providerId?: string | null;
    providerName?: string;
    reviewedCorrections?: string[];
    rowWarnings?: string[];
    selectedAssetCount?: number;
    selectedTransactionCount?: number;
    summary?: string;
    usedOcr?: boolean;
  } | null;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function coerceSupabaseUuid(value: string) {
  if (uuidPattern.test(value)) return value;

  const normalized = value.trim().toLowerCase() || "wealthcompass";
  const hashes = [0x811c9dc5, 0x9e3779b1, 0xc2b2ae35, 0x27d4eb2f];

  for (let index = 0; index < normalized.length; index += 1) {
    const code = normalized.charCodeAt(index);
    for (let hashIndex = 0; hashIndex < hashes.length; hashIndex += 1) {
      hashes[hashIndex] ^= code + hashIndex * 17;
      hashes[hashIndex] = Math.imul(hashes[hashIndex], 16777619);
      hashes[hashIndex] >>>= 0;
    }
  }

  const hex = hashes.map((hash) => hash.toString(16).padStart(8, "0")).join("");
  const versioned = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${
    ["8", "9", "a", "b"][Number.parseInt(hex.slice(16, 17), 16) % 4]
  }${hex.slice(17, 20)}-${hex.slice(20, 32)}`;

  return versioned;
}

export function mapAnswersToProfile(answers: RiskAnswers) {
  return {
    age: answers.age,
    annual_income: answers.annualIncome,
    country: answers.country,
    decision_style: answers.decisionStyle,
    debt_level: answers.debtLevel,
    dependents: answers.dependents,
    emergency_months: answers.emergencyMonths,
    experience: answers.experience,
    horizon_years: answers.horizonYears,
    income_stability: answers.incomeStability,
    liquidity_needs: answers.liquidityNeeds,
    market_drop_response: answers.marketDropResponse,
    post_learning_drop_response: answers.postLearningDropResponse,
    monthly_investment: answers.monthlyInvestment,
    monthly_savings: answers.monthlySavings,
    primary_goal: answers.primaryGoal,
    tax_awareness: answers.taxAwareness,
    time_available: answers.timeAvailable,
  };
}

export function mapProfileToAnswers(row: ProfileRow): RiskAnswers {
  return {
    ...defaultSnapshot.answers,
    age: row.age ?? defaultSnapshot.answers.age,
    annualIncome: row.annual_income ?? defaultSnapshot.answers.annualIncome,
    country: row.country ?? defaultSnapshot.answers.country,
    decisionStyle: row.decision_style ?? defaultSnapshot.answers.decisionStyle,
    debtLevel: row.debt_level ?? defaultSnapshot.answers.debtLevel,
    dependents: row.dependents ?? defaultSnapshot.answers.dependents,
    emergencyMonths:
      row.emergency_months ?? defaultSnapshot.answers.emergencyMonths,
    experience: row.experience ?? defaultSnapshot.answers.experience,
    horizonYears: row.horizon_years ?? defaultSnapshot.answers.horizonYears,
    incomeStability:
      row.income_stability ?? defaultSnapshot.answers.incomeStability,
    liquidityNeeds:
      row.liquidity_needs ?? defaultSnapshot.answers.liquidityNeeds,
    marketDropResponse:
      row.market_drop_response ?? defaultSnapshot.answers.marketDropResponse,
    postLearningDropResponse:
      row.post_learning_drop_response ??
      defaultSnapshot.answers.postLearningDropResponse,
    monthlyInvestment:
      row.monthly_investment ?? defaultSnapshot.answers.monthlyInvestment,
    monthlySavings: row.monthly_savings ?? defaultSnapshot.answers.monthlySavings,
    primaryGoal: row.primary_goal ?? defaultSnapshot.answers.primaryGoal,
    taxAwareness: row.tax_awareness ?? defaultSnapshot.answers.taxAwareness,
    timeAvailable: row.time_available ?? defaultSnapshot.answers.timeAvailable,
  };
}

export function mapPortfolioRowToAsset(row: PortfolioRow): PortfolioAsset {
  return {
    gain: numberOrDefault(row.gain_percent, 0),
    investedValue: numberOrDefault(row.invested_value, 0),
    name: stringOrDefault(row.name, "Unnamed holding"),
    price: numberOrDefault(row.current_price, 0),
    quantity: numberOrDefault(row.quantity, 0),
    source: row.source_label ?? "Imported",
    type: stringOrDefault(row.asset_type, "Other"),
    value: numberOrDefault(row.current_value, 0),
  };
}

export function mapAssetToPortfolioInsert(asset: PortfolioAsset, userId: string) {
  return {
    asset_type: asset.type,
    current_price: asset.price,
    current_value: asset.value,
    gain_percent: asset.gain,
    invested_value: asset.investedValue,
    name: asset.name,
    quantity: asset.quantity,
    source_label: asset.source,
    user_id: userId,
  };
}

export function mapGoalRowToGoal(row: GoalRow): WealthGoal {
  return {
    annualReturn: row.expected_return,
    currentAmount: row.current_amount,
    id: row.id,
    name: row.name,
    priority: row.priority ?? "important",
    targetAmount: row.target_amount,
    years: row.years,
  };
}

export function mapGoalToInsert(goal: WealthGoal, userId: string) {
  return {
    current_amount: goal.currentAmount,
    expected_return: goal.annualReturn,
    id: coerceSupabaseUuid(goal.id),
    name: goal.name,
    priority: goal.priority,
    target_amount: goal.targetAmount,
    user_id: userId,
    years: goal.years,
  };
}

export function mapTransactionRowToTransaction(
  row: PortfolioTransactionRow,
): PortfolioTransaction {
  return {
    action: row.action_type ?? "buy",
    amount: numberOrDefault(row.amount, 0),
    assetName: stringOrDefault(row.asset_name, "Unnamed transaction"),
    date: row.transaction_date ?? row.created_at?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    id: stringOrDefault(row.id, crypto.randomUUID()),
    notes: row.notes ?? "",
    price: numberOrDefault(row.price, 0),
    quantity: numberOrDefault(row.quantity, 0),
    source: row.source_label ?? "Imported",
    type: row.asset_type ?? "Other",
  };
}

export function mapTransactionToInsert(
  transaction: PortfolioTransaction,
  userId: string,
) {
  return {
    action_type: transaction.action,
    amount: transaction.amount,
    asset_name: transaction.assetName,
    asset_type: transaction.type,
    notes: transaction.notes,
    price: transaction.price,
    quantity: transaction.quantity,
    source_label: transaction.source,
    transaction_date: transaction.date,
    user_id: userId,
  };
}

export function mapRiskProfileHistoryRow(row: RiskProfileHistoryRow) {
  return {
    band: row.band,
    confidence: row.confidence ?? "Getting ready",
    createdAt: row.created_at,
    id: row.id,
    personality: row.personality,
    score: row.score,
    summary: row.summary ?? "Saved risk profile snapshot.",
  };
}

export function mapImportSourceRowToIntegration(
  row: ImportSourceRow,
): IntegrationConnection {
  return {
    channel: row.channel ?? "broker",
    id: stringOrDefault(row.id, crypto.randomUUID()),
    importStrategy: row.metadata?.importStrategy ?? "statement-upload",
    lastDetectedProviderSummary: row.metadata?.lastDetectedProviderSummary ?? "",
    lastImportedFileCount: numberOrDefault(row.metadata?.lastImportedFileCount, 0),
    lastSchedulerCheckAt: row.metadata?.lastSchedulerCheckAt ?? null,
    lastSchedulerMessage:
      row.metadata?.lastSchedulerMessage ?? "Scheduler has not checked this source yet.",
    lastSchedulerStatus: row.metadata?.lastSchedulerStatus ?? "idle",
    lastSyncAt: row.last_synced_at,
    lastSyncOrigin: row.metadata?.lastSyncOrigin ?? null,
    lastSyncMessage: row.metadata?.lastSyncMessage ?? "No sync has run yet.",
    lastSyncStatus: row.metadata?.lastSyncStatus ?? "idle",
    notes: row.metadata?.notes ?? "",
    providerId: stringOrDefault(row.provider_id, "custom-connection"),
    providerName: stringOrDefault(row.provider_name, "Custom connection"),
    sourceHint: row.metadata?.sourceHint ?? "Imported source",
    status: row.status ?? "paused",
    syncHistory: Array.isArray(row.metadata?.syncHistory) ? row.metadata.syncHistory : [],
    syncCadenceMinutes: numberOrDefault(row.metadata?.syncCadenceMinutes, 720),
  };
}

function numberOrDefault(value: unknown, fallback: number) {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function stringOrDefault(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

export function mapIntegrationToImportSourceInsert(
  integration: IntegrationConnection,
  userId: string,
) {
  return {
    channel: integration.channel,
    id: coerceSupabaseUuid(integration.id),
    last_synced_at: integration.lastSyncAt,
    metadata: {
      importStrategy: integration.importStrategy,
      lastDetectedProviderSummary: integration.lastDetectedProviderSummary,
      lastImportedFileCount: integration.lastImportedFileCount,
      lastSchedulerCheckAt: integration.lastSchedulerCheckAt,
      lastSchedulerMessage: integration.lastSchedulerMessage,
      lastSchedulerStatus: integration.lastSchedulerStatus,
      lastSyncOrigin: integration.lastSyncOrigin,
      lastSyncMessage: integration.lastSyncMessage,
      lastSyncStatus: integration.lastSyncStatus,
      notes: integration.notes,
      sourceHint: integration.sourceHint,
      syncHistory: integration.syncHistory,
      syncCadenceMinutes: integration.syncCadenceMinutes,
    },
    provider_id: integration.providerId,
    provider_name: integration.providerName,
    status: integration.status,
    user_id: userId,
  };
}

export function mapMarketPreferenceRowToSettings(
  row: MarketPreferenceRow,
): MarketPreferences {
  return {
    autoRefresh: row.auto_refresh ?? defaultSnapshot.marketPreferences.autoRefresh,
    includeHoldingsWatch:
      row.include_holdings_watch ??
      defaultSnapshot.marketPreferences.includeHoldingsWatch,
    pollingIntervalSeconds:
      row.polling_interval_seconds ??
      defaultSnapshot.marketPreferences.pollingIntervalSeconds,
    preferredSource:
      row.preferred_source ?? defaultSnapshot.marketPreferences.preferredSource,
    watchlist: defaultSnapshot.marketPreferences.watchlist,
  };
}

export function mapMarketPreferencesToInsert(
  preferences: MarketPreferences,
  userId: string,
) {
  return {
    auto_refresh: preferences.autoRefresh,
    include_holdings_watch: preferences.includeHoldingsWatch,
    polling_interval_seconds: preferences.pollingIntervalSeconds,
    preferred_source: preferences.preferredSource,
    user_id: userId,
  };
}

export function mapImportJobRowToJob(row: ImportJobRow): ImportJob {
  const createdAt = row.started_at ?? row.completed_at ?? new Date().toISOString();

  return {
    assetCount: row.created_assets ?? 0,
    attemptCount: row.job_payload?.attemptCount ?? 1,
    createdAt,
    transactionCount: row.created_transactions ?? 0,
    documentId: row.job_payload?.documentId ?? row.import_document_id ?? crypto.randomUUID(),
    documentKind:
      row.job_payload?.documentKind ??
      (row.import_document_id ? "document-import" : "unclassified"),
    documentStoragePath: row.job_payload?.documentStoragePath ?? null,
    duplicateCount: row.job_payload?.duplicateCount ?? 0,
    fileName: row.job_payload?.fileName ?? row.import_document_id ?? "import-job",
    id: row.id,
    lastActionAt: row.job_payload?.lastActionAt ?? null,
    notes: row.error_message ?? "",
    normalizationApplied: row.job_payload?.normalizationApplied ?? [],
    normalizedText: row.job_payload?.normalizedText ?? "",
    parserProfileId: row.job_payload?.parserProfileId ?? null,
    providerId: row.job_payload?.providerId ?? null,
    providerName: row.job_payload?.providerName ?? "Imported source",
    providerConfidence: row.job_payload?.providerConfidence ?? "low",
    rawText: row.job_payload?.rawText ?? "",
    reviewedCorrections: row.job_payload?.reviewedCorrections ?? [],
    rowWarnings: row.job_payload?.rowWarnings ?? [],
    status: mapImportJobDatabaseStatusToLocalStatus(
      row.job_payload?.localStatus ?? null,
      row.status,
    ),
    summary: row.job_payload?.summary ?? (
      row.status === "failed"
        ? row.error_message ?? "Import failed."
        : "Import job synced from cloud."
    ),
    usedOcr: row.job_payload?.usedOcr ?? false,
  };
}

export function mapImportJobToInsert(
  job: ImportJob,
  userId: string,
) {
  const documentId = coerceSupabaseUuid(job.documentId);

  return {
    created_assets: job.assetCount,
    created_transactions: job.transactionCount,
    error_message: job.status === "failed" ? job.notes || job.summary : null,
    id: coerceSupabaseUuid(job.id),
    import_document_id: documentId,
    job_payload: {
      attemptCount: job.attemptCount,
      documentId,
      documentKind: job.documentKind,
      documentStoragePath: job.documentStoragePath,
      duplicateCount: job.duplicateCount,
      fileName: job.fileName,
      lastActionAt: job.lastActionAt,
      localStatus: job.status,
      normalizationApplied: job.normalizationApplied,
      normalizedText: job.normalizedText,
      parserProfileId: job.parserProfileId,
      providerConfidence: job.providerConfidence,
      providerId: job.providerId,
      providerName: job.providerName,
      rawText: job.rawText,
      reviewedCorrections: job.reviewedCorrections,
      rowWarnings: job.rowWarnings,
      summary: job.summary,
      usedOcr: job.usedOcr,
    },
    status: mapImportJobLocalStatusToDatabaseStatus(job.status),
    user_id: userId,
  };
}

export function mapImportDocumentRowToJob(row: ImportDocumentRow): ImportJob {
  return {
    assetCount: numberOrDefault(row.parse_summary?.selectedAssetCount, 0),
    attemptCount: 1,
    createdAt: row.created_at,
    transactionCount: numberOrDefault(row.parse_summary?.selectedTransactionCount, 0),
    documentId: row.id,
    documentKind: row.file_type,
    documentStoragePath: row.storage_path,
    duplicateCount: numberOrDefault(row.parse_summary?.duplicateCount, 0),
    fileName: row.file_name,
    id: row.id,
    lastActionAt: row.created_at,
    notes: "",
    normalizationApplied: [],
    normalizedText: row.parse_summary?.normalizedText ?? "",
    parserProfileId: row.parse_summary?.parserProfileId ?? null,
    providerId: row.parse_summary?.providerId ?? row.detected_provider,
    providerName: row.parse_summary?.providerName ?? "Imported source",
    providerConfidence: row.parse_summary?.providerConfidence ?? "low",
    rawText: row.extracted_text ?? "",
    reviewedCorrections: row.parse_summary?.reviewedCorrections ?? [],
    rowWarnings: row.parse_summary?.rowWarnings ?? [],
    status: row.import_status === "failed" ? "failed" : "reviewed",
    summary: row.parse_summary?.summary ?? "Import document synced from cloud.",
    usedOcr: row.parse_summary?.usedOcr ?? false,
  };
}

export function mapImportJobToDocumentInsert(job: ImportJob, userId: string) {
  return {
    id: coerceSupabaseUuid(job.documentId),
    detected_provider: job.providerId,
    extracted_text: job.rawText,
    file_name: job.fileName,
    file_type: job.documentKind,
    import_status: mapImportJobStatusToDocumentStatus(job.status),
    storage_path: job.documentStoragePath,
    parse_summary: {
      duplicateCount: job.duplicateCount,
      normalizedText: job.normalizedText,
      parserProfileId: job.parserProfileId,
      providerConfidence: job.providerConfidence,
      providerId: job.providerId,
      providerName: job.providerName,
      reviewedCorrections: job.reviewedCorrections,
      rowWarnings: job.rowWarnings,
      selectedAssetCount: job.assetCount,
      selectedTransactionCount: job.transactionCount,
      summary: job.summary,
      usedOcr: job.usedOcr,
    },
    user_id: userId,
  };
}

function mapImportJobStatusToDocumentStatus(
  status: ImportJob["status"],
): NonNullable<ImportDocumentRow["import_status"]> {
  if (status === "failed") return "failed";
  if (status === "completed") return "parsed";
  if (status === "reviewed") return "needs_review";
  return "received";
}

function mapImportJobLocalStatusToDatabaseStatus(
  status: ImportJob["status"],
): NonNullable<ImportJobRow["status"]> {
  if (status === "failed") return "failed";
  if (status === "completed") return "completed";
  if (status === "reviewed") return "completed";
  return "queued";
}

function mapImportJobDatabaseStatusToLocalStatus(
  localStatus: ImportJob["status"] | null,
  databaseStatus: ImportJobRow["status"],
): ImportJob["status"] {
  if (
    localStatus === "received" ||
    localStatus === "reviewed" ||
    localStatus === "completed" ||
    localStatus === "failed"
  ) {
    return localStatus;
  }

  if (databaseStatus === "failed") return "failed";
  if (databaseStatus === "completed") return "completed";
  return "received";
}
