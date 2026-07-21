import type { ImportJob } from "./local-storage";

export type ImportJobFlowMeta = {
  badgeVariant: "outline" | "secondary";
  detail: string;
  label: string;
};

export type ImportJobPrimaryAction = {
  actionId: "apply-portfolio" | "none" | "open-sync-plan";
  detail: string;
  label: string;
};

export type ImportJobHistoryActions = {
  applyAction: {
    disabled: boolean;
    label: string;
  };
  correctionAction: {
    label: string;
  };
  reprocessAction: {
    disabled: boolean;
    label: string;
  };
  retryAction: {
    label: string;
  };
  syncPlanAction: {
    disabled: boolean;
    label: string;
  };
};

export type ImportJobOutcomeStats = {
  duplicatesLabel: string;
  fileLabel: string;
  holdingsLabel: string;
  ocrLabel: string;
  transactionsLabel: string;
};

export type DashboardImportOutcome = {
  badgeVariant: ImportJobFlowMeta["badgeVariant"];
  createdAt: string;
  detail: string;
  duplicatesLabel: string;
  fileLabel: string;
  holdingsLabel: string;
  id: string;
  label: string;
  ocrLabel: string;
  primaryActionDetail: string;
  primaryActionId: ImportJobPrimaryAction["actionId"];
  primaryActionLabel: string;
  providerName: string;
  status: ImportJob["status"];
  transactionsLabel: string;
};

export function getImportJobFlowMeta(job: ImportJob): ImportJobFlowMeta {
  const notes = job.notes.toLowerCase();
  const summary = job.summary.toLowerCase();
  const hasAssets = job.assetCount > 0;
  const hasTransactions = job.transactionCount > 0;
  const isTransactionOnly = hasTransactions && !hasAssets;
  const isHoldingsOnly = hasAssets && !hasTransactions;
  const isMixedImport = hasAssets && hasTransactions;

  if (notes.includes("reapplied from history") || summary.includes("reapplied")) {
    const detail = isMixedImport
      ? "This saved import was replayed from history and merged both holdings and transactions back into the tracked portfolio."
      : isTransactionOnly
        ? "This saved import was replayed from history and appended transactions back into the tracked portfolio."
        : "This saved import was replayed from history and merged holdings back into the tracked portfolio.";

    return {
      badgeVariant: "secondary",
      detail,
      label: isTransactionOnly ? "Transactions replayed" : "Reapplied",
    };
  }

  if (notes.includes("sync plan reviewed and applied") || summary.includes("applied")) {
    const detail = isMixedImport
      ? "This connector review was applied into the tracked portfolio with both holdings and transactions."
      : isTransactionOnly
        ? "This connector review was applied as a transaction-only update."
        : isHoldingsOnly
          ? "This connector review was applied into the tracked portfolio as holdings."
          : "This connector review was applied into the tracked portfolio.";

    return {
      badgeVariant: "secondary",
      detail,
      label: isTransactionOnly ? "Transactions applied" : "Applied",
    };
  }

  if (notes.includes("sync plan staged for review") || summary.includes("staged")) {
    const detail = isMixedImport
      ? "This connector review was staged in import history with both holdings and transactions ready for a final decision."
      : isTransactionOnly
        ? "This connector review was staged in import history as a transaction-only update."
        : hasAssets
          ? "This connector review was staged in import history with holdings ready for a final decision."
          : "This connector review was saved to import history but not applied yet.";

    return {
      badgeVariant: "outline",
      detail,
      label: isTransactionOnly ? "Transactions staged" : "Staged",
    };
  }

  if (job.status === "completed") {
    const detail = isMixedImport
      ? "This import completed and its holdings and transactions are part of the current workspace state."
      : isTransactionOnly
        ? "This import completed as a transaction-only update and is part of the current workspace state."
        : isHoldingsOnly
          ? "This import completed and its holdings are part of the current workspace state."
          : "This import completed and its results are part of the current workspace state.";

    return {
      badgeVariant: "secondary",
      detail,
      label: isTransactionOnly ? "Transactions imported" : "Completed",
    };
  }

  if (job.status === "failed") {
    const detail = job.usedOcr
      ? "This OCR-backed import still needs review before numbers and scheme names can be trusted."
      : "This import still needs cleanup before it can be trusted.";

    return {
      badgeVariant: "outline",
      detail,
      label: job.usedOcr ? "OCR review" : "Needs review",
    };
  }

  return {
    badgeVariant: "outline",
    detail:
      isTransactionOnly
        ? "This import is still in review as a transaction-only update and has not been applied yet."
        : "This import is still in review and has not been applied yet.",
    label: isTransactionOnly ? "Transactions in review" : "In review",
  };
}

export function getImportJobOutcomeStats(job: ImportJob): ImportJobOutcomeStats {
  return {
    duplicatesLabel:
      job.duplicateCount === 1
        ? "1 duplicate"
        : `${job.duplicateCount} duplicates`,
    fileLabel: `${job.fileName} · ${job.documentKind}`,
    holdingsLabel:
      job.assetCount === 0 && job.transactionCount > 0
        ? "No holdings parsed"
        : job.assetCount === 1
          ? "1 holding"
          : `${job.assetCount} holdings`,
    ocrLabel: job.usedOcr ? "OCR-backed PDF" : "Direct text parse",
    transactionsLabel:
      job.transactionCount === 0
        ? "No transactions"
        : job.transactionCount === 1
          ? "1 transaction"
          : `${job.transactionCount} transactions`,
  };
}

export function getImportJobPrimaryAction(job: ImportJob): ImportJobPrimaryAction {
  const hasPayload = Boolean(job.rawText.trim() || job.normalizedText.trim());
  const hasImportableRows = job.assetCount > 0 || job.transactionCount > 0;

  if (!hasPayload) {
    return {
      actionId: "none",
      detail:
        "This review does not have reusable source text yet, so a cleaner statement export is the next step.",
      label: "Re-import source",
    };
  }

  if (job.status === "completed") {
    return {
      actionId: "open-sync-plan",
      detail:
        "This import is already applied, so the best next move is reopening the sync plan if you want to inspect or replay it.",
      label: "Reopen in sync plan",
    };
  }

  if (hasImportableRows) {
    return {
      actionId: "apply-portfolio",
      detail:
        "This review already has importable holdings or transactions, so it is ready for a final apply into the workspace.",
      label: "Apply staged review",
    };
  }

  return {
    actionId: "open-sync-plan",
    detail:
      job.status === "failed"
        ? "This review still needs cleanup, so reopening it in the sync plan is the fastest recovery path."
        : "This review needs another pass before it can be applied, so reopening it in the sync plan is the next move.",
    label: "Open in sync plan",
  };
}

export function getImportJobHistoryActions(job: ImportJob): ImportJobHistoryActions {
  const hasPayload = Boolean(job.rawText.trim() || job.normalizedText.trim());
  const hasImportableRows = job.assetCount > 0 || job.transactionCount > 0;

  return {
    applyAction: {
      disabled: !hasPayload || !hasImportableRows,
      label:
        job.status === "completed"
          ? "Replay to portfolio"
          : job.transactionCount > 0 && job.assetCount === 0
            ? "Apply transactions"
            : job.assetCount > 0 && job.transactionCount === 0
              ? "Apply holdings"
              : "Apply to portfolio",
    },
    correctionAction: {
      label: "Save correction",
    },
    reprocessAction: {
      disabled: !hasPayload,
      label: hasPayload ? "Reprocess saved source" : "Reprocess unavailable",
    },
    retryAction: {
      label:
        job.status === "failed"
          ? "Queue another review"
          : job.status === "completed"
            ? "Stage another review"
            : "Retry review",
    },
    syncPlanAction: {
      disabled: !hasPayload,
      label:
        !hasPayload
          ? "Needs saved source"
          : job.status === "completed"
            ? "Reopen in sync plan"
            : job.status === "failed"
              ? "Repair in sync plan"
              : job.status === "received"
                ? "Start in sync plan"
                : "Open in sync plan",
    },
  };
}

export function buildDashboardImportOutcomes(
  importJobs: ImportJob[],
  limit = 3,
): DashboardImportOutcome[] {
  return importJobs
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit)
    .map((job) => {
      const meta = getImportJobFlowMeta(job);
      const stats = getImportJobOutcomeStats(job);
      const primaryAction = getImportJobPrimaryAction(job);

      return {
        badgeVariant: meta.badgeVariant,
        createdAt: job.createdAt,
        detail: meta.detail,
        duplicatesLabel: stats.duplicatesLabel,
        fileLabel: stats.fileLabel,
        holdingsLabel: stats.holdingsLabel,
        id: job.id,
        label: meta.label,
        ocrLabel: stats.ocrLabel,
        primaryActionDetail: primaryAction.detail,
        primaryActionId: primaryAction.actionId,
        primaryActionLabel: primaryAction.label,
        providerName: job.providerName,
        status: job.status,
        transactionsLabel: stats.transactionsLabel,
      };
    });
}
