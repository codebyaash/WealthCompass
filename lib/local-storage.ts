import {
  defaultIntegrations,
  defaultImportJobs,
  defaultMarketPreferences,
  defaultRiskAnswers,
  portfolioAssets,
  portfolioTransactions,
} from "./sample-data";
import type { RiskAnswers, RiskProfile } from "./wealth-rules";

export type PortfolioAsset = {
  investedValue: number;
  price: number;
  quantity: number;
  source: string;
  name: string;
  type: string;
  value: number;
  gain: number;
};

export type GoalPriority = "essential" | "important" | "aspirational";

export type PortfolioTransaction = {
  action: "buy" | "sell" | "dividend" | "transfer";
  amount: number;
  assetName: string;
  date: string;
  id: string;
  notes: string;
  price: number;
  quantity: number;
  source: string;
  type: string;
};

export type WealthGoal = {
  id: string;
  name: string;
  currentAmount: number;
  targetAmount: number;
  years: number;
  annualReturn: number;
  priority: GoalPriority;
};

export type IntegrationChannel = "broker" | "email" | "file" | "registrar";

export type IntegrationStatus = "active" | "paused" | "error";

export type IntegrationSyncOrigin = "manual" | "scheduled";

export type IntegrationSchedulerStatus = "error" | "idle" | "success";

export type IntegrationImportStrategy =
  | "csv-upload"
  | "email-forward"
  | "statement-upload"
  | "sync-ready";

export type IntegrationSyncEvent = {
  detectedProviderSummary: string;
  id: string;
  importedFileCount: number;
  message: string;
  status: "error" | "idle" | "success" | "warning";
  syncedAt: string;
};

export type IntegrationConnection = {
  channel: IntegrationChannel;
  id: string;
  importStrategy: IntegrationImportStrategy;
  lastDetectedProviderSummary: string;
  lastImportedFileCount: number;
  lastSchedulerCheckAt: string | null;
  lastSchedulerMessage: string;
  lastSchedulerStatus: IntegrationSchedulerStatus;
  lastSyncAt: string | null;
  lastSyncOrigin: IntegrationSyncOrigin | null;
  lastSyncMessage: string;
  lastSyncStatus: "error" | "idle" | "success" | "warning";
  notes: string;
  providerId: string;
  providerName: string;
  sourceHint: string;
  status: IntegrationStatus;
  syncHistory: IntegrationSyncEvent[];
  syncCadenceMinutes: number;
};

export type MarketPreferences = {
  autoRefresh: boolean;
  includeHoldingsWatch: boolean;
  pollingIntervalSeconds: number;
  preferredSource: "alpha-vantage" | "fallback";
};

export type ImportJobStatus = "received" | "reviewed" | "completed" | "failed";

export type ImportJob = {
  assetCount: number;
  attemptCount: number;
  createdAt: string;
  documentId: string;
  documentKind: string;
  documentStoragePath: string | null;
  duplicateCount: number;
  fileName: string;
  id: string;
  lastActionAt: string | null;
  notes: string;
  normalizationApplied: string[];
  normalizedText: string;
  parserProfileId: string | null;
  providerId: string | null;
  providerName: string;
  providerConfidence: "high" | "low" | "medium";
  rawText: string;
  reviewedCorrections: string[];
  rowWarnings: string[];
  status: ImportJobStatus;
  summary: string;
  usedOcr: boolean;
};

export type WealthCompassSnapshot = {
  answers: RiskAnswers;
  assets: PortfolioAsset[];
  goals: WealthGoal[];
  integrations: IntegrationConnection[];
  importJobs: ImportJob[];
  marketPreferences: MarketPreferences;
  transactions: PortfolioTransaction[];
};

export type WealthCompassImport = WealthCompassSnapshot & {
  riskHistory: RiskHistoryItem[];
};

export type RiskHistoryItem = Pick<
  RiskProfile,
  "band" | "confidence" | "personality" | "score" | "summary"
> & {
  createdAt: string;
  id: string;
};

export const defaultGoal: WealthGoal = {
  id: "goal-home-down-payment",
  name: "Home down payment",
  currentAmount: 150000,
  targetAmount: 1200000,
  years: 5,
  annualReturn: 10,
  priority: "important",
};

export const defaultGoals: WealthGoal[] = [
  defaultGoal,
  {
    id: "goal-emergency-fund",
    name: "Emergency fund",
    currentAmount: 80000,
    targetAmount: 300000,
    years: 2,
    annualReturn: 5,
    priority: "essential",
  },
];

export const defaultSnapshot: WealthCompassSnapshot = {
  answers: defaultRiskAnswers,
  assets: portfolioAssets,
  goals: defaultGoals,
  integrations: defaultIntegrations,
  importJobs: defaultImportJobs,
  marketPreferences: defaultMarketPreferences,
  transactions: portfolioTransactions,
};

const storageKey = "wealthcompass:snapshot:v1";
const riskHistoryKey = "wealthcompass:risk-history:v1";

export function loadSnapshot() {
  if (typeof window === "undefined") return defaultSnapshot;

  const rawSnapshot = window.localStorage.getItem(storageKey);
  if (!rawSnapshot) return defaultSnapshot;

  try {
    const parsedSnapshot = JSON.parse(rawSnapshot) as Partial<WealthCompassSnapshot> & {
      goal?: Partial<WealthGoal>;
    };

    return {
      answers: {
        ...defaultSnapshot.answers,
        ...parsedSnapshot.answers,
      },
      assets: parsedSnapshot.assets ?? defaultSnapshot.assets,
      goals: normalizeGoals(parsedSnapshot.goals ?? parsedSnapshot.goal) ?? defaultSnapshot.goals,
      integrations:
        normalizeIntegrations(parsedSnapshot.integrations) ?? defaultSnapshot.integrations,
      importJobs:
        normalizeImportJobs(parsedSnapshot.importJobs) ?? defaultSnapshot.importJobs,
      marketPreferences:
        normalizeMarketPreferences(parsedSnapshot.marketPreferences) ??
        defaultSnapshot.marketPreferences,
      transactions: normalizeTransactions(parsedSnapshot.transactions) ?? defaultSnapshot.transactions,
    };
  } catch {
    return defaultSnapshot;
  }
}

export function saveSnapshot(snapshot: WealthCompassSnapshot) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
}

export function loadRiskHistory() {
  if (typeof window === "undefined") return [];

  const rawHistory = window.localStorage.getItem(riskHistoryKey);
  if (!rawHistory) return [];

  try {
    return JSON.parse(rawHistory) as RiskHistoryItem[];
  } catch {
    return [];
  }
}

export function saveRiskHistory(history: RiskHistoryItem[]) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(riskHistoryKey, JSON.stringify(history));
}

export function coercePortfolioAssets(
  value: unknown,
  fallback: PortfolioAsset[] = defaultSnapshot.assets,
) {
  return normalizePortfolioAssets(value) ?? fallback;
}

export function coerceIntegrations(
  value: unknown,
  fallback: IntegrationConnection[] = defaultSnapshot.integrations,
) {
  return normalizeIntegrations(value) ?? fallback;
}

export function parseWorkspaceImport(rawJson: string): {
  data?: WealthCompassImport;
  errors: string[];
} {
  const errors: string[] = [];
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { errors: ["JSON is not valid."] };
  }

  if (!isRecord(parsed)) {
    return { errors: ["Workspace import must be a JSON object."] };
  }

  const answers = normalizeRiskAnswers(parsed.answers);
  const assets = normalizePortfolioAssets(parsed.assets);
  const goals = normalizeGoals(parsed.goals ?? parsed.goal);
  const integrations = normalizeIntegrations(parsed.integrations);
  const importJobs = normalizeImportJobs(parsed.importJobs);
  const marketPreferences = normalizeMarketPreferences(parsed.marketPreferences);
  const transactions = normalizeTransactions(parsed.transactions);
  const riskHistory = normalizeRiskHistory(parsed.riskHistory);

  if (!answers) errors.push("Missing or invalid onboarding answers.");
  if (!assets) errors.push("Missing or invalid portfolio assets.");
  if (!goals) errors.push("Missing or invalid goals.");
  if (!integrations) errors.push("Integrations must be an array when provided.");
  if (!importJobs) errors.push("Import jobs must be an array when provided.");
  if (!marketPreferences) errors.push("Market preferences must be an object when provided.");
  if (!transactions) errors.push("Portfolio transactions must be an array when provided.");
  if (!riskHistory) errors.push("Risk history must be an array when provided.");

  if (
    errors.length ||
    !answers ||
    !assets ||
    !goals ||
    !integrations ||
    !importJobs ||
    !marketPreferences ||
    !transactions ||
    !riskHistory
  ) {
    return { errors };
  }

  return {
    data: {
      answers,
      assets,
      goals,
      integrations,
      importJobs,
      marketPreferences,
      transactions,
      riskHistory,
    },
    errors: [],
  };
}

export function createWealthGoal(overrides: Partial<WealthGoal> = {}): WealthGoal {
  return {
    annualReturn: defaultGoal.annualReturn,
    currentAmount: 0,
    id: createGoalId(),
    name: "New goal",
    priority: "important",
    targetAmount: 500000,
    years: 5,
    ...overrides,
  };
}

export function createRiskHistoryItem(profile: RiskProfile): RiskHistoryItem {
  return {
    band: profile.band,
    confidence: profile.confidence,
    createdAt: new Date().toISOString(),
    id: crypto.randomUUID(),
    personality: profile.personality,
    score: profile.score,
    summary: profile.summary,
  };
}

export function createPortfolioTransaction(
  overrides: Partial<PortfolioTransaction> = {},
): PortfolioTransaction {
  return {
    action: "buy",
    amount: 25000,
    assetName: "New index fund",
    date: new Date().toISOString().slice(0, 10),
    id: crypto.randomUUID(),
    notes: "",
    price: 100,
    quantity: 250,
    source: "Manual",
    type: "Index Fund",
    ...overrides,
  };
}

export function createIntegrationConnection(
  overrides: Partial<IntegrationConnection> = {},
): IntegrationConnection {
  return {
    channel: "broker",
    id: crypto.randomUUID(),
    importStrategy: "statement-upload",
    lastDetectedProviderSummary: "",
    lastImportedFileCount: 0,
    lastSchedulerCheckAt: null,
    lastSchedulerMessage: "Scheduler has not checked this source yet.",
    lastSchedulerStatus: "idle",
    lastSyncAt: null,
    lastSyncOrigin: null,
    lastSyncMessage: "No sync has run yet.",
    lastSyncStatus: "idle",
    notes: "",
    providerId: "custom-connection",
    providerName: "Custom connection",
    sourceHint: "Document how this source should be imported.",
    status: "paused",
    syncHistory: [],
    syncCadenceMinutes: 720,
    ...overrides,
  };
}

export function createImportJob(
  overrides: Partial<ImportJob> = {},
): ImportJob {
  return {
    assetCount: 0,
    attemptCount: 1,
    createdAt: new Date().toISOString(),
    documentId: crypto.randomUUID(),
    documentKind: "unclassified",
    documentStoragePath: null,
    duplicateCount: 0,
    fileName: "manual-import.txt",
    id: crypto.randomUUID(),
    lastActionAt: null,
    notes: "",
    normalizationApplied: [],
    normalizedText: "",
    parserProfileId: null,
    providerId: null,
    providerName: "Unknown provider",
    providerConfidence: "low",
    rawText: "",
    reviewedCorrections: [],
    rowWarnings: [],
    status: "received",
    summary: "Import job created.",
    usedOcr: false,
    ...overrides,
  };
}

function normalizeRiskAnswers(value: unknown): RiskAnswers | null {
  if (!isRecord(value)) return null;

  return {
    age: numberOrDefault(value.age, defaultSnapshot.answers.age),
    annualIncome: numberOrDefault(value.annualIncome, defaultSnapshot.answers.annualIncome),
    country: stringOrDefault(value.country, defaultSnapshot.answers.country),
    debtLevel: enumOrDefault(value.debtLevel, ["none", "manageable", "heavy"], defaultSnapshot.answers.debtLevel),
    emergencyMonths: numberOrDefault(value.emergencyMonths, defaultSnapshot.answers.emergencyMonths),
    experience: enumOrDefault(value.experience, ["new", "some", "confident"], defaultSnapshot.answers.experience),
    horizonYears: numberOrDefault(value.horizonYears, defaultSnapshot.answers.horizonYears),
    marketDropResponse: enumOrDefault(value.marketDropResponse, ["sell", "wait", "buy"], defaultSnapshot.answers.marketDropResponse),
    monthlyInvestment: numberOrDefault(value.monthlyInvestment, defaultSnapshot.answers.monthlyInvestment),
    monthlySavings: numberOrDefault(value.monthlySavings, defaultSnapshot.answers.monthlySavings),
    primaryGoal: enumOrDefault(
      value.primaryGoal,
      ["emergency", "home", "retirement", "wealth", "education", "travel"],
      defaultSnapshot.answers.primaryGoal,
    ),
    taxAwareness: enumOrDefault(value.taxAwareness, ["low", "medium", "high"], defaultSnapshot.answers.taxAwareness),
    timeAvailable: enumOrDefault(value.timeAvailable, ["low", "medium", "high"], defaultSnapshot.answers.timeAvailable),
  };
}

function normalizePortfolioAssets(value: unknown): PortfolioAsset[] | null {
  if (!Array.isArray(value)) return null;

  return value
    .filter(isRecord)
    .map((asset) => ({
      gain: numberOrDefault(asset.gain, 0),
      investedValue: numberOrDefault(asset.investedValue, 0),
      name: stringOrDefault(asset.name, "Unnamed holding"),
      price: numberOrDefault(asset.price, 0),
      quantity: numberOrDefault(asset.quantity, 0),
      source: stringOrDefault(asset.source, "Imported"),
      type: stringOrDefault(asset.type, "Other"),
      value: numberOrDefault(asset.value, 0),
    }))
    .filter((asset) => asset.name.trim() && asset.value >= 0);
}

function normalizeTransactions(value: unknown): PortfolioTransaction[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;

  return value
    .filter(isRecord)
    .map((transaction) => ({
      action: enumOrDefault(
        transaction.action,
        ["buy", "sell", "dividend", "transfer"],
        "buy",
      ) as PortfolioTransaction["action"],
      amount: numberOrDefault(transaction.amount, 0),
      assetName: stringOrDefault(transaction.assetName, "Unnamed transaction"),
      date: stringOrDefault(
        transaction.date,
        new Date().toISOString().slice(0, 10),
      ),
      id: stringOrDefault(transaction.id, crypto.randomUUID()),
      notes: stringOrDefault(transaction.notes, ""),
      price: numberOrDefault(transaction.price, 0),
      quantity: numberOrDefault(transaction.quantity, 0),
      source: stringOrDefault(transaction.source, "Imported"),
      type: stringOrDefault(transaction.type, "Other"),
    }))
    .filter((transaction) => transaction.assetName.trim());
}

function normalizeIntegrations(value: unknown): IntegrationConnection[] | null {
  if (value === undefined) return defaultSnapshot.integrations;
  if (!Array.isArray(value)) return null;

  return value
    .filter(isRecord)
    .map((integration) => ({
      channel: enumOrDefault(
        integration.channel,
        ["broker", "email", "file", "registrar"],
        "broker",
      ) as IntegrationChannel,
      id: stringOrDefault(integration.id, crypto.randomUUID()),
      importStrategy: enumOrDefault(
        integration.importStrategy,
        ["csv-upload", "email-forward", "statement-upload", "sync-ready"],
        "statement-upload",
      ) as IntegrationImportStrategy,
      lastDetectedProviderSummary: stringOrDefault(integration.lastDetectedProviderSummary, ""),
      lastImportedFileCount: numberOrDefault(integration.lastImportedFileCount, 0),
      lastSchedulerCheckAt:
        typeof integration.lastSchedulerCheckAt === "string" &&
        integration.lastSchedulerCheckAt.trim()
          ? integration.lastSchedulerCheckAt
          : null,
      lastSchedulerMessage: stringOrDefault(
        integration.lastSchedulerMessage,
        "Scheduler has not checked this source yet.",
      ),
      lastSchedulerStatus: enumOrDefault(
        integration.lastSchedulerStatus,
        ["idle", "success", "error"],
        "idle",
      ) as IntegrationSchedulerStatus,
      lastSyncAt:
        typeof integration.lastSyncAt === "string" && integration.lastSyncAt.trim()
          ? integration.lastSyncAt
          : null,
      lastSyncOrigin:
        integration.lastSyncOrigin === "manual" || integration.lastSyncOrigin === "scheduled"
          ? integration.lastSyncOrigin
          : null,
      lastSyncMessage: stringOrDefault(integration.lastSyncMessage, "No sync has run yet."),
      lastSyncStatus: enumOrDefault(
        integration.lastSyncStatus,
        ["idle", "success", "warning", "error"],
        "idle",
      ) as IntegrationConnection["lastSyncStatus"],
      notes: stringOrDefault(integration.notes, ""),
      providerId: stringOrDefault(integration.providerId, "custom-connection"),
      providerName: stringOrDefault(integration.providerName, "Custom connection"),
      sourceHint: stringOrDefault(
        integration.sourceHint,
        "Document how this source should be imported.",
      ),
      status: enumOrDefault(integration.status, ["active", "paused", "error"], "paused") as IntegrationStatus,
      syncHistory: Array.isArray(integration.syncHistory)
        ? integration.syncHistory
            .filter(isRecord)
            .map((event) => ({
              detectedProviderSummary: stringOrDefault(event.detectedProviderSummary, ""),
              id: stringOrDefault(event.id, crypto.randomUUID()),
              importedFileCount: numberOrDefault(event.importedFileCount, 0),
              message: stringOrDefault(event.message, "Sync event recorded."),
              status: enumOrDefault(
                event.status,
                ["idle", "success", "warning", "error"],
                "idle",
              ) as IntegrationSyncEvent["status"],
              syncedAt: stringOrDefault(event.syncedAt, new Date().toISOString()),
            }))
            .slice(0, 12)
        : [],
      syncCadenceMinutes: numberOrDefault(integration.syncCadenceMinutes, 720),
    }));
}

function normalizeImportJobs(value: unknown): ImportJob[] | null {
  if (value === undefined) return defaultSnapshot.importJobs;
  if (!Array.isArray(value)) return null;

  return value
    .filter(isRecord)
    .map((job) => ({
      assetCount: numberOrDefault(job.assetCount, 0),
      attemptCount: numberOrDefault(job.attemptCount, 1),
      createdAt: stringOrDefault(job.createdAt, new Date().toISOString()),
      documentId: stringOrDefault(job.documentId, crypto.randomUUID()),
      documentKind: stringOrDefault(job.documentKind, "unclassified"),
      documentStoragePath:
        typeof job.documentStoragePath === "string" && job.documentStoragePath.trim()
          ? job.documentStoragePath
          : null,
      duplicateCount: numberOrDefault(job.duplicateCount, 0),
      fileName: stringOrDefault(job.fileName, "manual-import.txt"),
      id: stringOrDefault(job.id, crypto.randomUUID()),
      lastActionAt:
        typeof job.lastActionAt === "string" && job.lastActionAt.trim()
          ? job.lastActionAt
          : null,
      notes: stringOrDefault(job.notes, ""),
      normalizationApplied: Array.isArray(job.normalizationApplied)
        ? job.normalizationApplied.filter(
            (item): item is string => typeof item === "string" && Boolean(item.trim()),
          )
        : [],
      normalizedText: stringOrDefault(job.normalizedText, ""),
      parserProfileId:
        typeof job.parserProfileId === "string" && job.parserProfileId.trim()
          ? job.parserProfileId
          : null,
      providerId:
        typeof job.providerId === "string" && job.providerId.trim()
          ? job.providerId
          : null,
      providerName: stringOrDefault(job.providerName, "Unknown provider"),
      providerConfidence: enumOrDefault(job.providerConfidence, ["low", "medium", "high"], "low") as ImportJob["providerConfidence"],
      rawText: stringOrDefault(job.rawText, ""),
      reviewedCorrections: Array.isArray(job.reviewedCorrections)
        ? job.reviewedCorrections.filter(
            (item): item is string => typeof item === "string" && Boolean(item.trim()),
          )
        : [],
      rowWarnings: Array.isArray(job.rowWarnings)
        ? job.rowWarnings.filter(
            (item): item is string => typeof item === "string" && Boolean(item.trim()),
          )
        : [],
      status: enumOrDefault(
        job.status,
        ["received", "reviewed", "completed", "failed"],
        "received",
      ) as ImportJobStatus,
      summary: stringOrDefault(job.summary, "Imported job."),
      usedOcr: typeof job.usedOcr === "boolean" ? job.usedOcr : false,
    }));
}

function normalizeMarketPreferences(value: unknown): MarketPreferences | null {
  if (value === undefined) return defaultSnapshot.marketPreferences;
  if (!isRecord(value)) return null;

  return {
    autoRefresh:
      typeof value.autoRefresh === "boolean"
        ? value.autoRefresh
        : defaultSnapshot.marketPreferences.autoRefresh,
    includeHoldingsWatch:
      typeof value.includeHoldingsWatch === "boolean"
        ? value.includeHoldingsWatch
        : defaultSnapshot.marketPreferences.includeHoldingsWatch,
    pollingIntervalSeconds: numberOrDefault(
      value.pollingIntervalSeconds,
      defaultSnapshot.marketPreferences.pollingIntervalSeconds,
    ),
    preferredSource: enumOrDefault(
      value.preferredSource,
      ["alpha-vantage", "fallback"],
      defaultSnapshot.marketPreferences.preferredSource,
    ) as MarketPreferences["preferredSource"],
  };
}

function normalizeGoals(value: unknown): WealthGoal[] | null {
  if (Array.isArray(value)) {
    const goals = value.map(normalizeGoal).filter((goal): goal is WealthGoal => Boolean(goal));
    return goals.length ? goals : [];
  }

  const goal = normalizeGoal(value);
  return goal ? [goal] : null;
}

function normalizeGoal(value: unknown): WealthGoal | null {
  if (!isRecord(value)) return null;

  return {
    annualReturn: numberOrDefault(value.annualReturn, defaultGoal.annualReturn),
    currentAmount: numberOrDefault(value.currentAmount, defaultGoal.currentAmount),
    id: stringOrDefault(value.id, createGoalId()),
    name: stringOrDefault(value.name, defaultGoal.name),
    priority: enumOrDefault(value.priority, ["essential", "important", "aspirational"], defaultGoal.priority),
    targetAmount: numberOrDefault(value.targetAmount, defaultGoal.targetAmount),
    years: numberOrDefault(value.years, defaultGoal.years),
  };
}

function normalizeRiskHistory(value: unknown): RiskHistoryItem[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;

  return value.filter(isRecord).map((item) => ({
    band: enumOrDefault(item.band, ["Conservative", "Balanced", "Growth"], "Balanced"),
    confidence: enumOrDefault(
      item.confidence,
      ["Needs foundation", "Getting ready", "Ready to act"],
      "Getting ready",
    ),
    createdAt: stringOrDefault(item.createdAt, new Date().toISOString()),
    id: stringOrDefault(item.id, crypto.randomUUID()),
    personality: stringOrDefault(item.personality, "Steady Explorer"),
    score: numberOrDefault(item.score, 50),
    summary: stringOrDefault(item.summary, "Imported risk profile snapshot."),
  }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberOrDefault(value: unknown, fallback: number) {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function stringOrDefault(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function enumOrDefault<T extends string>(
  value: unknown,
  options: readonly T[],
  fallback: T,
) {
  return typeof value === "string" && options.includes(value as T) ? (value as T) : fallback;
}

function createGoalId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `goal-${Date.now()}`;
}
