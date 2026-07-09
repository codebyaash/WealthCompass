import type { SupabaseClient, User } from "@supabase/supabase-js";
import type {
  RiskHistoryItem,
  WealthCompassSnapshot,
} from "./local-storage";
import { defaultSnapshot } from "./local-storage";
import {
  mapAnswersToProfile,
  mapAssetToPortfolioInsert,
  mapGoalRowToGoal,
  mapGoalToInsert,
  mapPortfolioRowToAsset,
  mapProfileToAnswers,
  mapRiskProfileHistoryRow,
  type GoalRow,
  type PortfolioRow,
  type ProfileRow,
  type RiskProfileHistoryRow,
} from "./supabase-mappers";
import type { RiskAnswers, RiskProfile } from "@/lib/wealth-rules";

export async function loadCloudSnapshot(
  supabase: SupabaseClient,
  userId: User["id"],
): Promise<WealthCompassSnapshot> {
  const [profileResult, assetsResult, goalsResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle<ProfileRow>(),
    supabase
      .from("portfolio_assets")
      .select("name, asset_type, current_value, gain_percent")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .returns<PortfolioRow[]>(),
    supabase
      .from("goals")
      .select("id, name, target_amount, current_amount, years, expected_return, priority")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .returns<GoalRow[]>(),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (assetsResult.error) throw assetsResult.error;
  if (goalsResult.error) throw goalsResult.error;

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
