"use client";

import type { Dispatch, SetStateAction } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ShieldCheck,
  Target,
  TrendingUp,
} from "lucide-react";
import { AskMentorLink } from "@/components/wealth/ask-mentor-link";
import { MentorOpenCue } from "@/components/wealth/mentor-open-cue";
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
import type { MentorLaunchRequest } from "@/lib/mentor-chat";
import { calculateRiskProfile, goalLabels, type RiskAnswers } from "@/lib/wealth-rules";

const colors = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

const onboardingSteps = [
  {
    id: "profile",
    label: "Profile",
    title: "Set your base",
    description:
      "Add your income, household context, and main goal so planning starts from your actual situation.",
  },
  {
    id: "risk",
    label: "Risk",
    title: "Map your behavior",
    description:
      "A few behavioral questions help us understand how much volatility, liquidity, and decision complexity fits you.",
  },
  {
    id: "plan",
    label: "Plan",
    title: "Submit the assessment",
    description:
      "Confirm your horizon, learning time, and tax readiness, then submit to unlock your starting plan.",
  },
] as const;

export type OnboardingFocusTarget = (typeof onboardingSteps)[number]["id"];

export type OnboardingReturnState = {
  draftAnswers: RiskAnswers;
  hasSubmittedAssessment: boolean;
  step: number;
  submittedAnswers: RiskAnswers;
};

function areAnswersEqual(left: RiskAnswers, right: RiskAnswers) {
  return (
    left.age === right.age &&
    left.annualIncome === right.annualIncome &&
    left.country === right.country &&
    left.decisionStyle === right.decisionStyle &&
    left.debtLevel === right.debtLevel &&
    left.dependents === right.dependents &&
    left.emergencyMonths === right.emergencyMonths &&
    left.experience === right.experience &&
    left.horizonYears === right.horizonYears &&
    left.incomeStability === right.incomeStability &&
    left.liquidityNeeds === right.liquidityNeeds &&
    left.marketDropResponse === right.marketDropResponse &&
    left.postLearningDropResponse === right.postLearningDropResponse &&
    left.monthlyInvestment === right.monthlyInvestment &&
    left.monthlySavings === right.monthlySavings &&
    left.primaryGoal === right.primaryGoal &&
    left.taxAwareness === right.taxAwareness &&
    left.timeAvailable === right.timeAvailable
  );
}

export function Onboarding({
  answers,
  focusRequest,
  focusRequestKey,
  returnState,
  onChange,
  mentorRevision,
  onOpenMentor,
}: {
  answers: RiskAnswers;
  focusRequest?: OnboardingFocusTarget | null;
  focusRequestKey?: number;
  returnState?: OnboardingReturnState | null;
  onChange: Dispatch<SetStateAction<RiskAnswers>>;
  mentorRevision: number;
  onOpenMentor: (request: MentorLaunchRequest) => void;
}) {
  const [draftAnswers, setDraftAnswers] = useState<RiskAnswers>(answers);
  const [submittedAnswers, setSubmittedAnswers] = useState<RiskAnswers>(answers);
  const [hasSubmittedAssessment, setHasSubmittedAssessment] = useState(false);
  const [step, setStep] = useState(0);
  const onboardingCardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setDraftAnswers(answers);
    setSubmittedAnswers(answers);
  }, [answers]);

  useEffect(() => {
    if (!focusRequest) return;
    const nextIndex = onboardingSteps.findIndex((item) => item.id === focusRequest);
    if (nextIndex === -1) return;
    setStep(nextIndex);
    window.requestAnimationFrame(() => {
      onboardingCardRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [focusRequest, focusRequestKey]);

  useEffect(() => {
    if (!returnState) return;
    setDraftAnswers(returnState.draftAnswers);
    setSubmittedAnswers(returnState.submittedAnswers);
    setHasSubmittedAssessment(returnState.hasSubmittedAssessment);
    setStep(
      Math.max(0, Math.min(onboardingSteps.length - 1, returnState.step)),
    );
  }, [returnState, focusRequestKey]);

  const update = <K extends keyof RiskAnswers>(key: K, value: RiskAnswers[K]) => {
    setDraftAnswers((current) => ({ ...current, [key]: value }));
  };

  const completionChecks = useMemo(
    () => [
      draftAnswers.country.trim().length > 0,
      draftAnswers.age > 0,
      draftAnswers.annualIncome > 0,
      draftAnswers.monthlySavings > 0,
      draftAnswers.monthlyInvestment >= 0,
      draftAnswers.emergencyMonths >= 0,
      draftAnswers.horizonYears > 0,
      draftAnswers.primaryGoal.length > 0,
      draftAnswers.taxAwareness.length > 0,
    ],
    [draftAnswers],
  );
  const completionCount = completionChecks.filter(Boolean).length;
  const completionPercent = Math.round((completionCount / completionChecks.length) * 100);
  const currentStep = onboardingSteps[step];
  const draftProfile = useMemo(() => calculateRiskProfile(draftAnswers), [draftAnswers]);
  const submittedProfile = useMemo(
    () => calculateRiskProfile(submittedAnswers),
    [submittedAnswers],
  );
  const hasDraftChanges = hasSubmittedAssessment && !areAnswersEqual(draftAnswers, submittedAnswers);
  const displayedProfile = hasSubmittedAssessment ? submittedProfile : null;
  const profileForPreview = hasSubmittedAssessment ? submittedProfile : draftProfile;
  const monthlyReadiness = Math.max(
    draftAnswers.monthlySavings - draftAnswers.monthlyInvestment,
    0,
  );
  const roadmapPreview = profileForPreview.roadmap.slice(0, 3);
  const onboardingMentorReturnState = {
    draftAnswers,
    hasSubmittedAssessment,
    step,
    submittedAnswers,
  } satisfies OnboardingReturnState;
  const assessmentMentorPrompt = [
    `I am ${completionPercent}% through the onboarding assessment and I am currently on the ${currentStep.title.toLowerCase()} step.`,
    `My draft profile currently looks like ${draftProfile.band} with ${draftProfile.confidence} confidence.`,
    `My primary goal is ${goalLabels[draftAnswers.primaryGoal]}.`,
    `I have ${draftAnswers.emergencyMonths} emergency months, ${draftAnswers.debtLevel} debt, and about ${draftAnswers.monthlySavings} in monthly savings versus ${draftAnswers.monthlyInvestment} in planned monthly investing.`,
    monthlyReadiness > 0
      ? `That leaves roughly ${monthlyReadiness} of monthly readiness after planned investing.`
      : "My current monthly investing already uses up most of my current monthly savings capacity.",
    draftProfile.potentialScore && draftProfile.potentialScore > draftProfile.score
      ? `The preview says my potential risk score may be higher than my current score after learning, so I may have a knowledge gap rather than a pure risk-intent gap.`
      : null,
    hasSubmittedAssessment
      ? hasDraftChanges
        ? "I already submitted once, but I have draft changes now and want help understanding what those changes might mean before I submit again."
        : "I already submitted this assessment once and want help understanding the result more clearly."
      : "I have not submitted the assessment yet and want help understanding what this result is really saying about my investing starting point.",
  ]
    .filter(Boolean)
    .join(" ");
  const stepMentorPrompt = [
    `I am on the ${currentStep.title.toLowerCase()} step of onboarding and ${completionPercent}% complete.`,
    `The current draft risk band is ${draftProfile.band}.`,
    currentStep.id === "profile"
      ? `The profile inputs I am working through include country ${draftAnswers.country || "not filled yet"}, age ${draftAnswers.age || 0}, annual income ${draftAnswers.annualIncome || 0}, and monthly savings ${draftAnswers.monthlySavings || 0}.`
      : currentStep.id === "risk"
        ? `The behavior inputs I am working through include decision style ${draftAnswers.decisionStyle}, liquidity needs ${draftAnswers.liquidityNeeds}, market-drop response ${draftAnswers.marketDropResponse}, and post-learning response ${draftAnswers.postLearningDropResponse}.`
        : `The planning inputs I am working through include horizon ${draftAnswers.horizonYears} years, tax awareness ${draftAnswers.taxAwareness}, and time available ${draftAnswers.timeAvailable}.`,
    "A question on this step feels unclear. Help me interpret it in simple language before I answer so I do not guess blindly.",
  ].join(" ");
  const unlockedFeatures = [
    {
      icon: ShieldCheck,
      title: "Risk profile",
      detail: "Band, confidence, and behavior-backed starter allocation.",
    },
    {
      icon: TrendingUp,
      title: "Portfolio posture",
      detail: "A simple asset mix you can compare against imported holdings.",
    },
    {
      icon: Target,
      title: "Next actions",
      detail: "Foundation and investing priorities based on your current setup.",
    },
    {
      icon: BookOpenCheck,
      title: "Learning roadmap",
      detail: "A short plan that fits your time available and goal type.",
    },
  ];

  function handleSubmitAssessment() {
    setSubmittedAnswers(draftAnswers);
    setHasSubmittedAssessment(true);
    onChange(() => draftAnswers);
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
      <Card ref={onboardingCardRef}>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Assessment</Badge>
            <Badge variant="outline">4 focus areas</Badge>
            <Badge variant="outline">{completionPercent}% complete</Badge>
          </div>
          <CardTitle>Build your investing starting point</CardTitle>
          <CardDescription>
            Finish the assessment first, submit it once, and then review your starter
            plan with clearer context behind it.
          </CardDescription>
          <div className="pt-1">
            <AskMentorLink
              label="Ask AI mentor about this assessment"
              mentorPrompt={assessmentMentorPrompt}
              mentorQuestionId="risk"
              onOpenMentor={onOpenMentor}
              returnState={onboardingMentorReturnState}
              sourceLabel="Onboarding assessment"
            />
          </div>
          <MentorOpenCue
            cueLabel="Still open before answering"
            description="You already have an open mentor thread that could help before you finish this assessment."
            mentorRevision={mentorRevision}
            onOpenMentor={onOpenMentor}
            questionIds={["risk", "emergency", "debt", "first-investment"]}
            resumeLabel="Review this with AI mentor"
            sourceLabel="Onboarding"
            stuckLabel="Clear this up before submitting"
          />
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="rounded-lg border border-border/75 bg-background/70 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{currentStep.title}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {currentStep.description}
                </p>
              </div>
              <div className="min-w-40">
                <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Assessment progress</span>
                  <span>
                    {completionCount}/{completionChecks.length}
                  </span>
                </div>
                <Progress value={completionPercent} />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <AskMentorLink
                label="Ask AI mentor if a question feels unclear"
                mentorPrompt={stepMentorPrompt}
                mentorQuestionId="first-investment"
                onOpenMentor={onOpenMentor}
                returnState={onboardingMentorReturnState}
                sourceLabel={`Onboarding ${currentStep.title}`}
              />
            </div>
          </div>

          <div className="grid gap-2 lg:grid-cols-3">
            {onboardingSteps.map((stepItem, index) => (
              <Button
                key={stepItem.id}
                type="button"
                variant={step === index ? "default" : "outline"}
                className="h-auto min-h-16 justify-start px-4 py-3 text-left"
                onClick={() => setStep(index)}
              >
                <span className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current/20 text-xs">
                    {index + 1}
                  </span>
                  <span className="grid gap-1">
                    <span className="text-sm font-medium">{stepItem.label}</span>
                    <span className="whitespace-normal text-xs leading-5 opacity-80">
                      {stepItem.title}
                    </span>
                  </span>
                </span>
              </Button>
            ))}
          </div>

          {step === 0 && (
            <div className="grid gap-5">
              <div className="rounded-lg border border-border/75 bg-muted/45 px-4 py-3 text-sm leading-6 text-muted-foreground">
                Use approximate numbers if needed. The goal is to understand your shape,
                constraints, and starting capacity, not perfect accounting.
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <TextField
                  label="Country"
                  value={draftAnswers.country}
                  onChange={(value) => update("country", value)}
                />
                <NumberField
                  label="Age"
                  value={draftAnswers.age}
                  onChange={(value) => update("age", value)}
                />
                <NumberField
                  label="Annual income"
                  value={draftAnswers.annualIncome}
                  onChange={(value) => update("annualIncome", value)}
                />
                <NumberField
                  label="Dependents"
                  value={draftAnswers.dependents}
                  onChange={(value) => update("dependents", value)}
                />
                <NumberField
                  label="Monthly savings"
                  value={draftAnswers.monthlySavings}
                  onChange={(value) => update("monthlySavings", value)}
                />
                <NumberField
                  label="Monthly investment"
                  value={draftAnswers.monthlyInvestment}
                  onChange={(value) => update("monthlyInvestment", value)}
                />
                <NumberField
                  label="Emergency fund months"
                  value={draftAnswers.emergencyMonths}
                  onChange={(value) => update("emergencyMonths", value)}
                />
              </div>
              <SegmentedControl
                label="Income stability"
                value={draftAnswers.incomeStability}
                options={[
                  ["variable", "Variable"],
                  ["steady", "Steady"],
                  ["very-steady", "Very steady"],
                ]}
                onChange={(value) =>
                  update("incomeStability", value as RiskAnswers["incomeStability"])
                }
              />
              <SegmentedControl
                label="Primary goal"
                value={draftAnswers.primaryGoal}
                options={Object.entries(goalLabels)}
                onChange={(value) =>
                  update("primaryGoal", value as RiskAnswers["primaryGoal"])
                }
              />
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-5">
              <div className="rounded-lg border border-border/75 bg-muted/45 px-4 py-3 text-sm leading-6 text-muted-foreground">
                These answers help us understand your emotional response to drawdowns
                and how much complexity fits your investing style.
              </div>
              <SegmentedControl
                label="Debt level"
                value={draftAnswers.debtLevel}
                options={[
                  ["none", "None"],
                  ["manageable", "Manageable"],
                  ["heavy", "Heavy"],
                ]}
                onChange={(value) => update("debtLevel", value as RiskAnswers["debtLevel"])}
              />
              <SegmentedControl
                label="If investments dropped 25% today"
                value={draftAnswers.marketDropResponse}
                options={[
                  ["sell", "Sell"],
                  ["wait", "Wait"],
                  ["buy", "Buy more"],
                ]}
                onChange={(value) =>
                  update(
                    "marketDropResponse",
                    value as RiskAnswers["marketDropResponse"],
                  )
                }
              />
              <SegmentedControl
                label="After learning more through this app, what would you expect to do?"
                value={draftAnswers.postLearningDropResponse}
                options={[
                  ["sell", "Still sell"],
                  ["wait", "Wait and review"],
                  ["buy", "Buy more calmly"],
                ]}
                onChange={(value) =>
                  update(
                    "postLearningDropResponse",
                    value as RiskAnswers["postLearningDropResponse"],
                  )
                }
              />
              <SegmentedControl
                label="Experience"
                value={draftAnswers.experience}
                options={[
                  ["new", "New"],
                  ["some", "Some"],
                  ["confident", "Confident"],
                ]}
                onChange={(value) =>
                  update("experience", value as RiskAnswers["experience"])
                }
              />
              <SegmentedControl
                label="How do you want to invest?"
                value={draftAnswers.decisionStyle}
                options={[
                  ["hands-off", "Hands-off"],
                  ["guided", "Guided"],
                  ["active", "Active"],
                ]}
                onChange={(value) =>
                  update("decisionStyle", value as RiskAnswers["decisionStyle"])
                }
              />
              <SegmentedControl
                label="How much liquidity do you need?"
                value={draftAnswers.liquidityNeeds}
                options={[
                  ["high", "High"],
                  ["medium", "Medium"],
                  ["low", "Low"],
                ]}
                onChange={(value) =>
                  update("liquidityNeeds", value as RiskAnswers["liquidityNeeds"])
                }
              />
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-5">
              <div className="rounded-lg border border-border/75 bg-muted/45 px-4 py-3 text-sm leading-6 text-muted-foreground">
                This final step converts your situation into a starting playbook. When
                you submit, WealthCompass saves the assessment and reveals your results.
              </div>
              <NumberField
                label="Goal horizon years"
                value={draftAnswers.horizonYears}
                onChange={(value) => update("horizonYears", value)}
              />
              <SegmentedControl
                label="Weekly learning time"
                value={draftAnswers.timeAvailable}
                options={[
                  ["low", "Low"],
                  ["medium", "Medium"],
                  ["high", "High"],
                ]}
                onChange={(value) =>
                  update("timeAvailable", value as RiskAnswers["timeAvailable"])
                }
              />
              <SegmentedControl
                label="Tax awareness"
                value={draftAnswers.taxAwareness}
                options={[
                  ["low", "Low"],
                  ["medium", "Medium"],
                  ["high", "High"],
                ]}
                onChange={(value) =>
                  update("taxAwareness", value as RiskAnswers["taxAwareness"])
                }
              />
              <div className="rounded-lg border border-primary/20 bg-primary/8 p-4">
                <p className="text-sm font-medium text-foreground">What submission unlocks</p>
                <ul className="mt-3 grid gap-2 text-sm leading-6 text-muted-foreground">
                  <li>Risk band and personality summary</li>
                  <li>Starter allocation guidance</li>
                  <li>Immediate next actions to work on</li>
                  <li>A short roadmap to keep moving</li>
                </ul>
              </div>
            </div>
          )}

          <div className="flex flex-wrap justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={step === 0}
              onClick={() => setStep((current) => Math.max(0, current - 1))}
            >
              Previous
            </Button>
            <div className="flex flex-wrap gap-3">
              {hasDraftChanges ? (
                <Badge variant="outline">Draft changes not submitted</Badge>
              ) : null}
              {step < onboardingSteps.length - 1 ? (
                <Button
                  type="button"
                  onClick={() =>
                    setStep((current) => Math.min(onboardingSteps.length - 1, current + 1))
                  }
                >
                  Next step
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button type="button" onClick={handleSubmitAssessment}>
                  {hasSubmittedAssessment ? "Update assessment" : "Submit assessment"}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              {displayedProfile ? displayedProfile.confidence : "Results locked"}
            </Badge>
            <Badge variant="outline">
              {displayedProfile ? displayedProfile.band : "Submit to reveal"}
            </Badge>
            <Badge variant="outline">{goalLabels[draftAnswers.primaryGoal]}</Badge>
          </div>
          <CardTitle>
            {displayedProfile ? displayedProfile.personality : "Submit the assessment to reveal your plan"}
          </CardTitle>
          <CardDescription>
            {displayedProfile
              ? displayedProfile.summary
              : "We’ll hold back the recommendations until you finish and submit the assessment, so the output reflects a complete first pass."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border/75 bg-background/72 p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Goal focus
              </p>
              <p className="mt-2 text-sm font-semibold">{goalLabels[draftAnswers.primaryGoal]}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Horizon {draftAnswers.horizonYears} years
              </p>
            </div>
            <div className="rounded-lg border border-border/75 bg-background/72 p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Cash flexibility
              </p>
              <p className="mt-2 text-sm font-semibold">
                ₹{monthlyReadiness.toLocaleString("en-IN")}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Savings left after current monthly investing
              </p>
            </div>
          </div>

          {displayedProfile ? (
            <>
              <div className="grid gap-3">
                <div className="mb-2 flex justify-between text-sm">
                  <span>Current risk score</span>
                  <span>{displayedProfile.score}/100</span>
                </div>
                <Progress value={displayedProfile.score} />
                {displayedProfile.potentialScore !== null ? (
                  <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/8 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="font-medium">Potential fit after learning</span>
                      <Badge variant="outline">
                        {displayedProfile.potentialBand} · {displayedProfile.potentialScore}/100
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      Your current caution looks more like a knowledge gap than a true low-risk
                      preference, so we show both your present score and your likely fit after a
                      few learning cycles.
                    </p>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">Confidence: {displayedProfile.confidence}</Badge>
                  <Badge variant="outline">
                    {displayedProfile.intentGap === "knowledge-gap"
                      ? "Knowledge gap"
                      : displayedProfile.intentGap === "steady-caution"
                        ? "Low-risk intent"
                        : displayedProfile.intentGap === "growing-conviction"
                          ? "Confidence building"
                          : "Intent aligned"}
                  </Badge>
                </div>
              </div>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={displayedProfile.allocation}
                      dataKey="value"
                      innerRadius={56}
                      outerRadius={88}
                      paddingAngle={3}
                    >
                      {displayedProfile.allocation.map((entry, index) => (
                        <Cell key={entry.name} fill={colors[index % colors.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${value}%`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {displayedProfile.allocation.map((entry, index) => (
                  <div
                    key={entry.name}
                    className="flex items-center justify-between rounded-lg border border-border/75 bg-background/72 px-3 py-2 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: colors[index % colors.length] }}
                      />
                      {entry.name}
                    </span>
                    <span className="font-medium">{entry.value}%</span>
                  </div>
                ))}
              </div>
              <div className="grid gap-3">
                <p className="text-sm font-medium">Your action tracks</p>
                {displayedProfile.actionBaskets.map((basket) => (
                  <div
                    key={basket.id}
                    className="rounded-lg border border-border/75 bg-background/72 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">{basket.title}</p>
                      <Badge variant="outline">{basket.items.length} suggestions</Badge>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {basket.description}
                    </p>
                    <div className="mt-3 grid gap-2">
                      {basket.items.map((item) => (
                        <div
                          key={item}
                          className="flex gap-3 rounded-lg border border-border/75 bg-muted/35 p-3 text-sm"
                        >
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="grid gap-3">
              <div className="rounded-lg border border-dashed border-border bg-muted/25 p-5 text-sm leading-6 text-muted-foreground">
                Finish the assessment and use the submit button on the final step to
                unlock your full result set.
              </div>
              {unlockedFeatures.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.title}
                    className="flex gap-3 rounded-lg border border-border/75 bg-background/72 p-3"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{feature.title}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {feature.detail}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="grid gap-2">
            <p className="text-sm font-medium">
              {displayedProfile ? "Roadmap preview" : "What the roadmap will cover"}
            </p>
            {roadmapPreview.map((item) => (
              <div
                key={item.week}
                className="flex items-start gap-3 rounded-lg border border-border/75 bg-muted/35 p-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background text-muted-foreground">
                  {item.week.replace("Week ", "")}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{item.topic}</p>
                    <Badge variant="outline">{item.format}</Badge>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {item.outcome}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
