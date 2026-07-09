import { calculateRiskProfile, type RiskAnswers } from "@/lib/wealth-rules";

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<RiskAnswers>;

  const answers: RiskAnswers = {
    age: Number(body.age ?? 30),
    country: body.country ?? "",
    annualIncome: Number(body.annualIncome ?? 0),
    emergencyMonths: Number(body.emergencyMonths ?? 3),
    debtLevel: body.debtLevel ?? "manageable",
    horizonYears: Number(body.horizonYears ?? 5),
    marketDropResponse: body.marketDropResponse ?? "wait",
    experience: body.experience ?? "new",
    primaryGoal: body.primaryGoal ?? "wealth",
    timeAvailable: body.timeAvailable ?? "medium",
    taxAwareness: body.taxAwareness ?? "low",
    monthlyInvestment: Number(body.monthlyInvestment ?? 0),
    monthlySavings: Number(body.monthlySavings ?? 1),
  };

  return Response.json(calculateRiskProfile(answers));
}
