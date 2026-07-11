import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { RiskHistoryItem, WealthCompassSnapshot } from "./local-storage";
import { defaultSnapshot } from "./local-storage";
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
      .select("id, file_name, file_type, detected_provider, import_status, extracted_text, parse_summary, created_at")
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

  return {
    answers: profileResult.data
      ? mapProfileToAnswers(profileResult.data)
      : defaultSnapshot.answers,
    assets: assetsResult.data.length
      ? assetsResult.data.map(mapPortfolioRowToAsset)
      : defaultSnapshot.assets,
    goals: goalsResult.data.length
      ? goalsResult.data.map(mapGoalRowToGoal)
      : defaultSnapshot.goals,
    integrations: integrationsResult.data.length
      ? integrationsResult.data.map(mapImportSourceRowToIntegration)
      : defaultSnapshot.integrations,
    importJobs: importJobsResult.data.length
      ? importJobsResult.data.map(mapImportJobRowToJob)
      : importDocumentsResult.data.length
        ? importDocumentsResult.data.map(mapImportDocumentRowToJob)
        : defaultSnapshot.importJobs,
    marketPreferences: marketPreferencesResult.data
      ? mapMarketPreferenceRowToSettings(marketPreferencesResult.data)
      : defaultSnapshot.marketPreferences,
    transactions: transactionsResult.data.length
      ? transactionsResult.data.map(mapTransactionRowToTransaction)
      : defaultSnapshot.transactions,
  };
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
    const importDocumentsResult = await supabase.from("import_documents").insert(
      snapshot.importJobs.map((job) => mapImportJobToDocumentInsert(job, userId)),
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
