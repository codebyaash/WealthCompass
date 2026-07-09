import type { SupabaseClient, User } from "@supabase/supabase-js";
import type {
  PortfolioAsset,
  RiskHistoryItem,
  WealthCompassSnapshot,
  WealthGoal,
} from "@/lib/local-storage";
import { defaultSnapshot } from "@/lib/local-storage";
import type { RiskAnswers, RiskProfile } from "@/lib/wealth-rules";

type ProfileRow = {
  age: number | null;
  annual_income: number | null;
  country: string | null;
  debt_level: RiskAnswers["debtLevel"] | null;
  emergency_months: number | null;
  experience: RiskAnswers["experience"] | null;
  horizon_years: number | null;
  market_drop_response: RiskAnswers["marketDropResponse"] | null;
  monthly_investment: number | null;
  monthly_savings: number | null;
  primary_goal: RiskAnswers["primaryGoal"] | null;
  tax_awareness: RiskAnswers["taxAwareness"] | null;
  time_available: RiskAnswers["timeAvailable"] | null;
};

type PortfolioRow = {
  asset_type: string;
  current_value: number;
  gain_percent: number | null;
  name: string;
};

type GoalRow = {
  current_amount: number;
  expected_return: number;
  id: string;
  name: string;
  priority: WealthGoal["priority"] | null;
  target_amount: number;
  years: number;
};

type RiskProfileHistoryRow = {
  band: RiskProfile["band"];
  confidence: RiskProfile["confidence"] | null;
  created_at: string;
  id: string;
  personality: string;
  score: number;
  summary: string | null;
};

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
      snapshot.assets.map((asset) => ({
        asset_type: asset.type,
        current_value: asset.value,
        gain_percent: asset.gain,
        name: asset.name,
        user_id: userId,
      })),
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
      snapshot.goals.map((goal) => ({
        current_amount: goal.currentAmount,
        expected_return: goal.annualReturn,
        name: goal.name,
        priority: goal.priority,
        target_amount: goal.targetAmount,
        user_id: userId,
        years: goal.years,
      })),
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

  return result.data.map((row) => ({
    band: row.band,
    confidence: row.confidence ?? "Getting ready",
    createdAt: row.created_at,
    id: row.id,
    personality: row.personality,
    score: row.score,
    summary: row.summary ?? "Saved risk profile snapshot.",
  }));
}

function mapAnswersToProfile(answers: RiskAnswers) {
  return {
    age: answers.age,
    annual_income: answers.annualIncome,
    country: answers.country,
    debt_level: answers.debtLevel,
    emergency_months: answers.emergencyMonths,
    experience: answers.experience,
    horizon_years: answers.horizonYears,
    market_drop_response: answers.marketDropResponse,
    monthly_investment: answers.monthlyInvestment,
    monthly_savings: answers.monthlySavings,
    primary_goal: answers.primaryGoal,
    tax_awareness: answers.taxAwareness,
    time_available: answers.timeAvailable,
  };
}

function mapProfileToAnswers(row: ProfileRow): RiskAnswers {
  return {
    ...defaultSnapshot.answers,
    age: row.age ?? defaultSnapshot.answers.age,
    annualIncome: row.annual_income ?? defaultSnapshot.answers.annualIncome,
    country: row.country ?? defaultSnapshot.answers.country,
    debtLevel: row.debt_level ?? defaultSnapshot.answers.debtLevel,
    emergencyMonths:
      row.emergency_months ?? defaultSnapshot.answers.emergencyMonths,
    experience: row.experience ?? defaultSnapshot.answers.experience,
    horizonYears: row.horizon_years ?? defaultSnapshot.answers.horizonYears,
    marketDropResponse:
      row.market_drop_response ?? defaultSnapshot.answers.marketDropResponse,
    monthlyInvestment:
      row.monthly_investment ?? defaultSnapshot.answers.monthlyInvestment,
    monthlySavings: row.monthly_savings ?? defaultSnapshot.answers.monthlySavings,
    primaryGoal: row.primary_goal ?? defaultSnapshot.answers.primaryGoal,
    taxAwareness: row.tax_awareness ?? defaultSnapshot.answers.taxAwareness,
    timeAvailable: row.time_available ?? defaultSnapshot.answers.timeAvailable,
  };
}

function mapPortfolioRowToAsset(row: PortfolioRow): PortfolioAsset {
  return {
    gain: row.gain_percent ?? 0,
    name: row.name,
    type: row.asset_type,
    value: row.current_value,
  };
}

function mapGoalRowToGoal(row: GoalRow): WealthGoal {
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
