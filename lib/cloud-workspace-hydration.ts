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
}: {
  cachedWorkspace:
    | {
        riskHistory: RiskHistoryItem[];
        snapshot: WealthCompassSnapshot;
      }
    | null;
  cloudHistory: RiskHistoryItem[];
  cloudSnapshot: WealthCompassSnapshot;
}) {
  const hasMeaningfulCachedWorkspace =
    cachedWorkspace !== null &&
    workspaceHasMeaningfulUserData(cachedWorkspace.snapshot, cachedWorkspace.riskHistory);
  const shouldUseCachedWorkspace =
    hasMeaningfulCachedWorkspace &&
    !workspaceHasMeaningfulUserData(cloudSnapshot, cloudHistory);

  const resolvedSnapshot = shouldUseCachedWorkspace
    ? cachedWorkspace.snapshot
    : cloudSnapshot;
  const resolvedHistory = shouldUseCachedWorkspace
    ? cachedWorkspace.riskHistory
    : cloudHistory;
  const successMessage = shouldUseCachedWorkspace
    ? "Loaded your last saved browser copy while cloud data catches up."
    : cloudSnapshot.assets.length || cloudSnapshot.transactions.length || cloudSnapshot.goals.length
      ? "Loaded your saved Supabase data."
      : "Signed in with a clean workspace. Add your own portfolio to begin tracking.";

  return {
    hasMeaningfulCachedWorkspace,
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
