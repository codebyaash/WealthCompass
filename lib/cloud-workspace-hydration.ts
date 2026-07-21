import type {
  RiskHistoryItem,
  WealthCompassSnapshot,
} from "./local-storage";
import { workspaceHasMeaningfulUserData } from "./local-storage";

export function getCloudHydrationLoadingMessage(
  cachedWorkspace:
    | {
        riskHistory: RiskHistoryItem[];
        snapshot: WealthCompassSnapshot;
      }
    | null,
) {
  return cachedWorkspace &&
    workspaceHasMeaningfulUserData(cachedWorkspace.snapshot, cachedWorkspace.riskHistory)
    ? "Showing your last saved browser copy while cloud data loads."
    : "Loading your Supabase workspace.";
}

export function resolveHydratedCloudWorkspace({
  cachedWorkspace,
  cloudHistory,
  cloudSnapshot,
  cloudUpdatedAt,
}: {
  cachedWorkspace:
    | {
        riskHistory: RiskHistoryItem[];
        snapshot: WealthCompassSnapshot;
        updatedAt?: string;
      }
    | null;
  cloudHistory: RiskHistoryItem[];
  cloudSnapshot: WealthCompassSnapshot;
  cloudUpdatedAt: string | null;
}) {
  const hasMeaningfulCachedSnapshot =
    cachedWorkspace !== null &&
    workspaceHasMeaningfulUserData(cachedWorkspace.snapshot, []);
  const hasMeaningfulCachedHistory = Boolean(cachedWorkspace?.riskHistory.length);
  const hasMeaningfulCachedWorkspace =
    cachedWorkspace !== null &&
    workspaceHasMeaningfulUserData(cachedWorkspace.snapshot, cachedWorkspace.riskHistory);
  const hasMeaningfulCloudSnapshot = workspaceHasMeaningfulUserData(cloudSnapshot, []);
  const hasMeaningfulCloudHistory = cloudHistory.length > 0;
  const hasMeaningfulCloudWorkspace = workspaceHasMeaningfulUserData(cloudSnapshot, cloudHistory);

  const cachedSnapshotUpdatedAt = getLatestSnapshotFreshnessAt(
    cachedWorkspace?.updatedAt ?? null,
  );
  const cloudSnapshotUpdatedAt = getLatestSnapshotFreshnessAt(cloudUpdatedAt);
  const cachedHistoryUpdatedAt = getLatestHistoryFreshnessAt(
    cachedWorkspace?.riskHistory ?? [],
  );
  const cloudHistoryUpdatedAt = getLatestHistoryFreshnessAt(cloudHistory);

  const shouldUseCachedSnapshot =
    hasMeaningfulCachedSnapshot &&
    (!hasMeaningfulCloudSnapshot ||
      (Number.isFinite(cachedSnapshotUpdatedAt) &&
        (!Number.isFinite(cloudSnapshotUpdatedAt) ||
          cachedSnapshotUpdatedAt > cloudSnapshotUpdatedAt)));
  const shouldUseCachedHistory =
    hasMeaningfulCachedHistory &&
    (!hasMeaningfulCloudHistory ||
      (Number.isFinite(cachedHistoryUpdatedAt) &&
        (!Number.isFinite(cloudHistoryUpdatedAt) ||
          cachedHistoryUpdatedAt > cloudHistoryUpdatedAt)));

  const isCachedWorkspaceNewer = shouldUseCachedSnapshot;
  const shouldUseCachedWorkspace = shouldUseCachedSnapshot && shouldUseCachedHistory;

  const resolvedSnapshot =
    shouldUseCachedSnapshot && cachedWorkspace ? cachedWorkspace.snapshot : cloudSnapshot;
  const resolvedHistory =
    shouldUseCachedHistory && cachedWorkspace ? cachedWorkspace.riskHistory : cloudHistory;
  const successMessage =
    shouldUseCachedWorkspace
      ? "Loaded your last saved browser copy while cloud data catches up."
      : shouldUseCachedSnapshot || shouldUseCachedHistory
        ? "Loaded the freshest mix of your browser and Supabase data."
        : hasMeaningfulCloudWorkspace
          ? "Loaded your saved Supabase data."
          : "Signed in with a clean workspace. Add your own portfolio to begin tracking.";

  return {
    hasMeaningfulCachedWorkspace,
    isCachedWorkspaceNewer,
    resolvedHistory,
    resolvedSnapshot,
    shouldUseCachedWorkspace,
    successMessage,
  };
}

export function shouldRestoreCachedWorkspaceAfterCloudError(
  cachedWorkspace:
    | {
        riskHistory: RiskHistoryItem[];
        snapshot: WealthCompassSnapshot;
      }
    | null,
) {
  return Boolean(
    cachedWorkspace &&
      workspaceHasMeaningfulUserData(cachedWorkspace.snapshot, cachedWorkspace.riskHistory),
  );
}

function getLatestWorkspaceFreshnessAt(
  riskHistory: RiskHistoryItem[],
) {
  const timestamps = riskHistory
    .map((item) => Date.parse(item.createdAt))
    .filter((value) => Number.isFinite(value));

  if (!timestamps.length) {
    return Number.NaN;
  }

  return Math.max(...timestamps);
}

function getLatestSnapshotFreshnessAt(updatedAt: string | null) {
  if (!updatedAt) return Number.NaN;

  const parsed = Date.parse(updatedAt);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function getLatestHistoryFreshnessAt(riskHistory: RiskHistoryItem[]) {
  return getLatestWorkspaceFreshnessAt(riskHistory);
}
