"use client";

import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { CheckCircle2 } from "lucide-react";
import { NumberField, SegmentedControl, TextField } from "@/components/wealth/form-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { goalLabels, type RiskAnswers, type RiskProfile } from "@/lib/wealth-rules";

const colors = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

export function Onboarding({
  answers,
  onChange,
  profile,
}: {
  answers: RiskAnswers;
  onChange: Dispatch<SetStateAction<RiskAnswers>>;
  profile: RiskProfile;
}) {
  const [step, setStep] = useState(0);
  const update = <K extends keyof RiskAnswers>(key: K, value: RiskAnswers[K]) => {
    onChange((current) => ({ ...current, [key]: value }));
  };
  const steps = ["Profile", "Risk", "Plan"];

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
      <Card>
        <CardHeader>
          <CardTitle>Tell WealthCompass about yourself</CardTitle>
          <CardDescription>Answers turn into risk, personality, roadmap, and next actions.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid grid-cols-3 gap-2">
            {steps.map((label, index) => (
              <Button
                key={label}
                type="button"
                variant={step === index ? "default" : "outline"}
                onClick={() => setStep(index)}
              >
                {label}
              </Button>
            ))}
          </div>

          {step === 0 && (
            <div className="grid gap-5">
              <div className="grid gap-4 md:grid-cols-2">
                <TextField
                  label="Country"
                  value={answers.country}
                  onChange={(value) => update("country", value)}
                />
                <NumberField
                  label="Age"
                  value={answers.age}
                  onChange={(value) => update("age", value)}
                />
                <NumberField
                  label="Annual income"
                  value={answers.annualIncome}
                  onChange={(value) => update("annualIncome", value)}
                />
                <NumberField
                  label="Monthly savings"
                  value={answers.monthlySavings}
                  onChange={(value) => update("monthlySavings", value)}
                />
                <NumberField
                  label="Monthly investment"
                  value={answers.monthlyInvestment}
                  onChange={(value) => update("monthlyInvestment", value)}
                />
                <NumberField
                  label="Emergency fund months"
                  value={answers.emergencyMonths}
                  onChange={(value) => update("emergencyMonths", value)}
                />
              </div>
              <SegmentedControl
                label="Primary goal"
                value={answers.primaryGoal}
                options={Object.entries(goalLabels)}
                onChange={(value) => update("primaryGoal", value as RiskAnswers["primaryGoal"])}
              />
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-5">
              <SegmentedControl
                label="Debt level"
                value={answers.debtLevel}
                options={[
                  ["none", "None"],
                  ["manageable", "Manageable"],
                  ["heavy", "Heavy"],
                ]}
                onChange={(value) => update("debtLevel", value as RiskAnswers["debtLevel"])}
              />
              <SegmentedControl
                label="If investments dropped 25%"
                value={answers.marketDropResponse}
                options={[
                  ["sell", "Sell"],
                  ["wait", "Wait"],
                  ["buy", "Buy more"],
                ]}
                onChange={(value) =>
                  update("marketDropResponse", value as RiskAnswers["marketDropResponse"])
                }
              />
              <SegmentedControl
                label="Experience"
                value={answers.experience}
                options={[
                  ["new", "New"],
                  ["some", "Some"],
                  ["confident", "Confident"],
                ]}
                onChange={(value) => update("experience", value as RiskAnswers["experience"])}
              />
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-5">
              <NumberField
                label="Goal horizon years"
                value={answers.horizonYears}
                onChange={(value) => update("horizonYears", value)}
              />
              <SegmentedControl
                label="Weekly learning time"
                value={answers.timeAvailable}
                options={[
                  ["low", "Low"],
                  ["medium", "Medium"],
                  ["high", "High"],
                ]}
                onChange={(value) => update("timeAvailable", value as RiskAnswers["timeAvailable"])}
              />
              <SegmentedControl
                label="Tax awareness"
                value={answers.taxAwareness}
                options={[
                  ["low", "Low"],
                  ["medium", "Medium"],
                  ["high", "High"],
                ]}
                onChange={(value) => update("taxAwareness", value as RiskAnswers["taxAwareness"])}
              />
            </div>
          )}

          <div className="flex justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={step === 0}
              onClick={() => setStep((current) => Math.max(0, current - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              disabled={step === steps.length - 1}
              onClick={() => setStep((current) => Math.min(steps.length - 1, current + 1))}
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{profile.confidence}</Badge>
            <Badge variant="outline">{profile.band}</Badge>
          </div>
          <CardTitle>{profile.personality}</CardTitle>
          <CardDescription>{profile.summary}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div>
            <div className="mb-2 flex justify-between text-sm">
              <span>Risk score</span>
              <span>{profile.score}/100</span>
            </div>
            <Progress value={profile.score} />
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={profile.allocation} dataKey="value" innerRadius={56} outerRadius={88} paddingAngle={3}>
                  {profile.allocation.map((entry, index) => (
                    <Cell key={entry.name} fill={colors[index % colors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value}%`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid gap-2">
            <p className="text-sm font-medium">Recommended next actions</p>
            {profile.nextActions.map((action) => (
              <div key={action} className="flex gap-3 rounded-md border bg-background p-3 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{action}</span>
              </div>
            ))}
          </div>
          <div className="grid gap-2">
            <p className="text-sm font-medium">Why this plan</p>
            {profile.recommendations.map((recommendation) => (
              <div key={recommendation} className="rounded-md border bg-muted/40 p-3 text-sm leading-6">
                {recommendation}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
