import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { ImportJob, RiskHistoryItem, WealthCompassSnapshot } from "./local-storage";
import { emptySignedInSnapshot } from "./local-storage";
import {
  mapAnswersToProfile,
  mapAssetToPortfolioInsert,
  mapGoalRowToGoal,
  mapGoalToInsert,
  mapImportJobRowToJob,
  mapImportDocumentRowToJob,
  mapImportJobToDocumentInsert,
  mapImportJobToInsert,
  mapImportSourceRowToIntegration,
  mapIntegrationToImportSourceInsert,
  mapMarketPreferenceRowToSettings,
  mapMarketPreferencesToInsert,
  mapPortfolioRowToAsset,
  mapProfileToAnswers,
  mapRiskProfileHistoryRow,
  mapTransactionRowToTransaction,
  mapTransactionToInsert,
  type GoalRow,
  type ImportJobRow,
  type ImportDocumentRow,
  type ImportSourceRow,
  type MarketPreferenceRow,
  type PortfolioRow,
  type PortfolioTransactionRow,
  type ProfileRow,
  type RiskProfileHistoryRow,
} from "./supabase-mappers";
import type { RiskAnswers, RiskProfile } from "@/lib/wealth-rules";

export async function loadCloudSnapshot(
  supabase: SupabaseClient,
  userId: User["id"],
): Promise<WealthCompassSnapshot> {
  const [profileResult, assetsResult, goalsResult, transactionsResult, integrationsResult, importJobsResult, importDocumentsResult, marketPreferencesResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle<ProfileRow>(),
    supabase
      .from("portfolio_assets")
      .select(
        "name, asset_type, current_value, current_price, invested_value, quantity, gain_percent, source_label",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .returns<PortfolioRow[]>(),
    supabase
      .from("goals")
      .select("id, name, target_amount, current_amount, years, expected_return, priority")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .returns<GoalRow[]>(),
    supabase
      .from("portfolio_transactions")
      .select(
        "id, asset_name, asset_type, action_type, quantity, price, amount, source_label, notes, transaction_date, created_at",
      )
      .eq("user_id", userId)
      .order("transaction_date", { ascending: false })
      .returns<PortfolioTransactionRow[]>(),
    supabase
      .from("import_sources")
      .select("id, provider_id, provider_name, channel, status, last_synced_at, metadata")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .returns<ImportSourceRow[]>(),
    supabase
      .from("import_jobs")
      .select("id, status, error_message, created_assets, created_transactions, import_document_id, created_at, job_payload")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .returns<ImportJobRow[]>(),
    supabase
      .from("import_documents")
      .select("id, file_name, file_type, storage_path, detected_provider, import_status, extracted_text, parse_summary, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .returns<ImportDocumentRow[]>(),
    supabase
      .from("market_preferences")
      .select("auto_refresh, include_holdings_watch, polling_interval_seconds, preferred_source")
      .eq("user_id", userId)
      .maybeSingle<MarketPreferenceRow>(),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (assetsResult.error) throw assetsResult.error;
  if (goalsResult.error) throw goalsResult.error;
  if (transactionsResult.error) throw transactionsResult.error;
  if (integrationsResult.error) throw integrationsResult.error;
  if (importJobsResult.error) throw importJobsResult.error;
  if (importDocumentsResult.error) throw importDocumentsResult.error;
  if (marketPreferencesResult.error) throw marketPreferencesResult.error;

  const hasStoredWorkspace =
    Boolean(profileResult.data) ||
    assetsResult.data.length > 0 ||
    goalsResult.data.length > 0 ||
    transactionsResult.data.length > 0 ||
    integrationsResult.data.length > 0 ||
    importJobsResult.data.length > 0 ||
    importDocumentsResult.data.length > 0 ||
    Boolean(marketPreferencesResult.data);

  if (!hasStoredWorkspace) {
    return emptySignedInSnapshot;
  }

  const snapshot = {
    answers: profileResult.data
      ? mapProfileToAnswers(profileResult.data)
      : emptySignedInSnapshot.answers,
    assets: assetsResult.data.length
      ? assetsResult.data.map(mapPortfolioRowToAsset)
      : emptySignedInSnapshot.assets,
    goals: goalsResult.data.length
      ? goalsResult.data.map(mapGoalRowToGoal)
      : emptySignedInSnapshot.goals,
    integrations: integrationsResult.data.length
      ? integrationsResult.data.map(mapImportSourceRowToIntegration)
      : emptySignedInSnapshot.integrations,
    importJobs:
      importJobsResult.data.length || importDocumentsResult.data.length
        ? mergeCloudImportJobs(importJobsResult.data, importDocumentsResult.data)
        : emptySignedInSnapshot.importJobs,
    marketPreferences: marketPreferencesResult.data
      ? mapMarketPreferenceRowToSettings(marketPreferencesResult.data)
      : emptySignedInSnapshot.marketPreferences,
    transactions: transactionsResult.data.length
      ? transactionsResult.data.map(mapTransactionRowToTransaction)
      : emptySignedInSnapshot.transactions,
  };

  if (shouldTreatCloudSnapshotAsEmpty(snapshot)) {
    return {
      ...emptySignedInSnapshot,
      answers: snapshot.answers,
      marketPreferences: snapshot.marketPreferences,
    };
  }

  return snapshot;
}

export async function saveCloudSnapshot({
  snapshot,
  supabase,
  userId,
}: {
  snapshot: WealthCompassSnapshot;
  supabase: SupabaseClient;
  userId: User["id"];
}) {
  const profileResult = await supabase.from("profiles").upsert({
    id: userId,
    ...mapAnswersToProfile(snapshot.answers),
    updated_at: new Date().toISOString(),
  });

  if (profileResult.error) throw profileResult.error;

  const deleteAssetsResult = await supabase
    .from("portfolio_assets")
    .delete()
    .eq("user_id", userId);

  if (deleteAssetsResult.error) throw deleteAssetsResult.error;

  if (snapshot.assets.length) {
    const assetsResult = await supabase.from("portfolio_assets").insert(
      snapshot.assets.map((asset) => mapAssetToPortfolioInsert(asset, userId)),
    );

    if (assetsResult.error) throw assetsResult.error;
  }

  const deleteGoalsResult = await supabase
    .from("goals")
    .delete()
    .eq("user_id", userId);

  if (deleteGoalsResult.error) throw deleteGoalsResult.error;

  if (snapshot.goals.length) {
    const goalResult = await supabase.from("goals").insert(
      snapshot.goals.map((goal) => mapGoalToInsert(goal, userId)),
    );

    if (goalResult.error) throw goalResult.error;
  }

  const deleteTransactionsResult = await supabase
    .from("portfolio_transactions")
    .delete()
    .eq("user_id", userId);

  if (deleteTransactionsResult.error) throw deleteTransactionsResult.error;

  if (snapshot.transactions.length) {
    const transactionResult = await supabase.from("portfolio_transactions").insert(
      snapshot.transactions.map((transaction) =>
        mapTransactionToInsert(transaction, userId),
      ),
    );

    if (transactionResult.error) throw transactionResult.error;
  }

  const deleteImportSourcesResult = await supabase
    .from("import_sources")
    .delete()
    .eq("user_id", userId);

  if (deleteImportSourcesResult.error) throw deleteImportSourcesResult.error;

  if (snapshot.integrations.length) {
    const importSourceResult = await supabase.from("import_sources").insert(
      snapshot.integrations.map((integration) =>
        mapIntegrationToImportSourceInsert(integration, userId),
      ),
    );

    if (importSourceResult.error) throw importSourceResult.error;
  }

  const deleteImportJobsResult = await supabase
    .from("import_jobs")
    .delete()
    .eq("user_id", userId);

  if (deleteImportJobsResult.error) throw deleteImportJobsResult.error;

  const deleteImportDocumentsResult = await supabase
    .from("import_documents")
    .delete()
    .eq("user_id", userId);

  if (deleteImportDocumentsResult.error) throw deleteImportDocumentsResult.error;

  if (snapshot.importJobs.length) {
    const integrationSourceIdByProvider = new Map(
      snapshot.integrations.map((integration) => [integration.providerId, integration.id]),
    );
    const importDocumentsResult = await supabase.from("import_documents").insert(
      snapshot.importJobs.map((job) => ({
        ...mapImportJobToDocumentInsert(job, userId),
        import_source_id:
          (job.providerId ? integrationSourceIdByProvider.get(job.providerId) : null) ?? null,
      })),
    );

    if (importDocumentsResult.error) throw importDocumentsResult.error;
  }

  if (snapshot.importJobs.length) {
    const importJobsResult = await supabase.from("import_jobs").insert(
      snapshot.importJobs.map((job) => mapImportJobToInsert(job, userId)),
    );

    if (importJobsResult.error) throw importJobsResult.error;
  }

  const marketPreferencesResult = await supabase
    .from("market_preferences")
    .upsert({
      ...mapMarketPreferencesToInsert(snapshot.marketPreferences, userId),
      updated_at: new Date().toISOString(),
    });

  if (marketPreferencesResult.error) throw marketPreferencesResult.error;
}

function shouldTreatCloudSnapshotAsEmpty(snapshot: WealthCompassSnapshot) {
  const hasTrackedPortfolio = snapshot.assets.length > 0 || snapshot.transactions.length > 0;
  const hasGoals = snapshot.goals.length > 0;
  const hasMeaningfulImportHistory = snapshot.importJobs.some(
    (job) => job.rawText.trim() || job.normalizedText.trim() || job.assetCount > 0,
  );

  if (hasTrackedPortfolio || hasGoals) {
    return false;
  }

  const hasImportResidue =
    snapshot.integrations.length > 0 || snapshot.importJobs.length > 0;

  return hasImportResidue && !hasMeaningfulImportHistory;
}

function mergeCloudImportJobs(
  importJobRows: ImportJobRow[],
  importDocumentRows: ImportDocumentRow[],
) {
  const mergedByDocumentId = new Map<string, ImportJob>();

  for (const documentRow of importDocumentRows) {
    const mappedDocument = mapImportDocumentRowToJob(documentRow);
    mergedByDocumentId.set(mappedDocument.documentId, mappedDocument);
  }

  for (const jobRow of importJobRows) {
    const mappedJob = mapImportJobRowToJob(jobRow);
    const existing = mergedByDocumentId.get(mappedJob.documentId);

    mergedByDocumentId.set(mappedJob.documentId, {
      ...existing,
      ...mappedJob,
      assetCount: mappedJob.assetCount || existing?.assetCount || 0,
      documentStoragePath:
        mappedJob.documentStoragePath ?? existing?.documentStoragePath ?? null,
      duplicateCount: mappedJob.duplicateCount || existing?.duplicateCount || 0,
      normalizedText: mappedJob.normalizedText || existing?.normalizedText || "",
      providerId: mappedJob.providerId ?? existing?.providerId ?? null,
      providerName:
        mappedJob.providerName !== "Imported source"
          ? mappedJob.providerName
          : existing?.providerName ?? mappedJob.providerName,
      rawText: mappedJob.rawText || existing?.rawText || "",
      reviewedCorrections:
        mappedJob.reviewedCorrections.length > 0
          ? mappedJob.reviewedCorrections
          : existing?.reviewedCorrections ?? [],
      rowWarnings:
        mappedJob.rowWarnings.length > 0
          ? mappedJob.rowWarnings
          : existing?.rowWarnings ?? [],
      summary:
        mappedJob.summary !== "Import job synced from cloud."
          ? mappedJob.summary
          : existing?.summary ?? mappedJob.summary,
      usedOcr: mappedJob.usedOcr || existing?.usedOcr || false,
    });
  }

  return [...mergedByDocumentId.values()].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
}

export async function saveRiskProfileHistory({
  answers,
  profile,
  supabase,
  userId,
}: {
  answers: RiskAnswers;
  profile: RiskProfile;
  supabase: SupabaseClient;
  userId: User["id"];
}) {
  const profileResult = await supabase.from("profiles").upsert({
    id: userId,
    ...mapAnswersToProfile(answers),
    updated_at: new Date().toISOString(),
  });

  if (profileResult.error) throw profileResult.error;

  const result = await supabase.from("risk_profiles").insert({
    allocation: profile.allocation,
    answers,
    band: profile.band,
    confidence: profile.confidence,
    next_actions: profile.nextActions,
    personality: profile.personality,
    recommendations: profile.recommendations,
    roadmap: profile.roadmap,
    score: profile.score,
    summary: profile.summary,
    user_id: userId,
  });

  if (result.error) throw result.error;
}

export async function loadRiskProfileHistory(
  supabase: SupabaseClient,
  userId: User["id"],
): Promise<RiskHistoryItem[]> {
  const result = await supabase
    .from("risk_profiles")
    .select("id, score, band, personality, confidence, summary, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(12)
    .returns<RiskProfileHistoryRow[]>();

  if (result.error) throw result.error;

  return result.data.map(mapRiskProfileHistoryRow);
}

export async function persistCloudImportJob({
  job,
  supabase,
  userId,
}: {
  job: ImportJob;
  supabase: SupabaseClient;
  userId: User["id"];
}) {
  const profileResult = await supabase.from("profiles").upsert({
    id: userId,
    updated_at: new Date().toISOString(),
  });

  if (profileResult.error) throw profileResult.error;

  let importSourceId: string | null = null;

  if (job.providerId) {
    const importSourceResult = await supabase
      .from("import_sources")
      .select("id")
      .eq("user_id", userId)
      .eq("provider_id", job.providerId)
      .maybeSingle<{ id: string }>();

    if (importSourceResult.error) throw importSourceResult.error;
    importSourceId = importSourceResult.data?.id ?? null;
  }

  const importDocumentPayload = {
    ...mapImportJobToDocumentInsert(job, userId),
    import_source_id: importSourceId,
  };
  const importDocumentResult = await supabase
    .from("import_documents")
    .upsert(importDocumentPayload);

  if (importDocumentResult.error) throw importDocumentResult.error;

  const importJobResult = await supabase
    .from("import_jobs")
    .upsert(mapImportJobToInsert(job, userId));

  if (importJobResult.error) throw importJobResult.error;
}
