"use client";

import { type ReactNode, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  BookOpen,
  Compass,
  Landmark,
  LineChart,
  Search,
  ShieldCheck,
  SplitSquareVertical,
  Sparkles,
} from "lucide-react";
import {
  academyUseCases,
  buildAcademyTrackPlans,
  buildComparisonSummary,
  categoryGroups,
  getAcademyComparisonOptions,
  getCategoryById,
  normalizeComparisonSelection,
  quickComparePairs,
  type AcademyCategory,
} from "@/lib/academy-rules";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { RiskAnswers, RiskProfile } from "@/lib/wealth-rules";

export function Academy({
  answers,
  profile,
}: {
  answers: RiskAnswers;
  profile: RiskProfile;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [leftCategoryId, setLeftCategoryId] = useState("index-funds");
  const [rightCategoryId, setRightCategoryId] = useState("equity-mutual-funds");

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredGroups = useMemo(() => {
    if (!normalizedQuery) {
      return categoryGroups;
    }

    return categoryGroups
      .map((group) => ({
        ...group,
        categories: group.categories.filter((category) =>
          [
            category.name,
            category.bestFor,
            category.beginnerNote,
            category.productRole,
            category.returnStyle,
            category.risk,
            category.taxHint,
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery),
        ),
      }))
      .filter((group) => group.categories.length > 0);
  }, [normalizedQuery]);

  const filteredUseCases = useMemo(() => {
    if (!normalizedQuery) {
      return academyUseCases;
    }

    return academyUseCases.filter((useCase) =>
      [useCase.title, useCase.description, ...useCase.categoryIds]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [normalizedQuery]);

  const leftOptions = useMemo(
    () => getAcademyComparisonOptions(rightCategoryId),
    [rightCategoryId],
  );
  const rightOptions = useMemo(
    () => getAcademyComparisonOptions(leftCategoryId),
    [leftCategoryId],
  );

  const { leftCategory, rightCategory } = useMemo(
    () => normalizeComparisonSelection(leftCategoryId, rightCategoryId),
    [leftCategoryId, rightCategoryId],
  );
  const comparisonSummary = buildComparisonSummary(leftCategory, rightCategory);
  const trackPlans = useMemo(
    () => buildAcademyTrackPlans({ answers, profile }),
    [answers, profile],
  );
  const academyReadinessLabel =
    normalizedQuery.length > 0
      ? "Search in progress"
      : trackPlans.length > 0
        ? "Learning plan ready"
        : "Explore categories";

  return (
    <div className="grid gap-5">
      <Card className="overflow-hidden border-border/70 bg-card/95 shadow-sm">
        <CardContent className="grid gap-5 p-6 lg:grid-cols-[1.15fr_0.85fr] lg:p-7">
          <div className="grid gap-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Investment learning desk</Badge>
              <Badge variant="outline">{academyReadinessLabel}</Badge>
              <Badge variant="outline">{profile.band}</Badge>
              <Badge variant="outline">{profile.confidence}</Badge>
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                Learn the category job first, then choose the product.
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                This page is meant to reduce decision noise. Use the guided tracks when you want a focused next step, the shortlists when you know the job to be done, and the comparator when two categories look similar on the surface.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-md border border-border/70 bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Guided tracks
                </p>
                <p className="mt-3 text-sm font-medium leading-6 text-foreground">
                  {trackPlans.length} personalized lane{trackPlans.length === 1 ? "" : "s"} built from your current profile and answers.
                </p>
              </div>
              <div className="rounded-md border border-border/70 bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Compare on purpose
                </p>
                <p className="mt-3 text-sm font-medium leading-6 text-foreground">
                  Put two categories side by side before you mistake similar labels for similar roles.
                </p>
              </div>
              <div className="rounded-md border border-border/70 bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Start from the job
                </p>
                <p className="mt-3 text-sm font-medium leading-6 text-foreground">
                  Use shortlists for growth, safety, liquidity, retirement, and near-term money decisions.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 content-start">
            <div className="rounded-md border border-border/70 bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Current learning posture
              </p>
              <p className="mt-3 text-base font-semibold text-foreground">
                {profile.personality}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Start with the learning lane that matches your current confidence and risk posture, then go deeper only where the next real decision needs it.
              </p>
            </div>
            <div className="rounded-md border border-border/70 bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Best next move
              </p>
              <p className="mt-3 text-sm leading-6 text-foreground">
                {trackPlans[0]?.description ??
                  "Use the category finder or use-case shortlists to narrow the next topic worth learning."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{profile.personality}</Badge>
            <Badge variant="outline">{profile.band}</Badge>
            <Badge variant="outline">{profile.confidence}</Badge>
          </div>
          <CardTitle>Academy, mapped to your investing stage</CardTitle>
          <CardDescription>
            Start with the learning lane that fits your current readiness, then use the
            library below when you want deeper category context.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-3">
          {trackPlans.map((plan) => (
            <div key={plan.id} className="rounded-md border border-border/70 bg-background p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">{plan.title}</p>
                <Badge variant="outline">{plan.categoryIds.length} categories</Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{plan.description}</p>
              <div className="mt-4 rounded-md border border-border/70 bg-muted/20 p-3">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5" />
                  What this track helps with
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Move from broad category confusion to a smaller set of products that fit your current stage, goal pressure, and learning confidence.
                </p>
              </div>
              <div className="mt-4 grid gap-2">
                {plan.useCaseIds.map((useCaseId) => {
                  const useCase = academyUseCases.find((item) => item.id === useCaseId);
                  if (!useCase) return null;

                  return (
                    <div key={useCase.id} className="rounded-md border border-border/70 bg-muted/20 p-3">
                      <p className="text-sm font-medium">{useCase.title}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {useCase.description}
                      </p>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {plan.categoryIds.map((categoryId) => {
                  const category = getCategoryById(categoryId);

                  return (
                    <Badge key={category.id} variant="outline">
                      {category.name}
                    </Badge>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardHeader>
          <CardTitle>Investment Academy</CardTitle>
          <CardDescription>
            Learn the main beginner categories, the job each one plays, when it fits, and where it can quietly go wrong.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AcademyIntroCard
            icon={<BookOpen className="h-4 w-4 text-primary" />}
            title="Build category clarity"
            text="A product can be good and still be wrong for your goal timing, risk capacity, or learning stage."
          />
          <AcademyIntroCard
            icon={<ShieldCheck className="h-4 w-4 text-primary" />}
            title="Understand role first"
            text="Beginners usually need clearer bucket roles and cleaner defaults, not more products."
          />
          <AcademyIntroCard
            icon={<LineChart className="h-4 w-4 text-primary" />}
            title="Compare intentionally"
            text="Pick any two categories and compare them directly instead of relying on a fixed preset list."
          />
          <AcademyIntroCard
            icon={<Landmark className="h-4 w-4 text-primary" />}
            title="Avoid role confusion"
            text="Growth, safety, liquidity, and diversification are different jobs. Mixing them causes bad product decisions."
          />
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardHeader>
          <CardTitle>Beginner Navigation Map</CardTitle>
          <CardDescription>
            A simpler order of operations before you wander into every product rabbit hole.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <AcademyIntroCard
            icon={<Compass className="h-4 w-4 text-primary" />}
            title="Start with a core"
            text="Emergency money, a basic SIP habit, and one diversified long-term growth category usually come first."
          />
          <AcademyIntroCard
            icon={<ShieldCheck className="h-4 w-4 text-primary" />}
            title="Add safety on purpose"
            text="FDs, debt funds, liquid funds, bonds, PPF, and savings buckets solve stability and timing problems."
          />
          <AcademyIntroCard
            icon={<LineChart className="h-4 w-4 text-primary" />}
            title="Layer complexity later"
            text="Small-cap funds, direct stocks, REITs, property, and global sleeves work better after the core already makes sense."
          />
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardHeader>
          <CardTitle>Category Finder</CardTitle>
          <CardDescription>Search by product name, role, or beginner use case.</CardDescription>
        </CardHeader>
        <CardContent>
          <label className="grid gap-2 text-sm">
            <span className="font-medium">Search categories</span>
            <div className="flex items-center gap-2 rounded-md border bg-background px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Index funds, retirement, short-term goals, diversification..."
                className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          </label>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardHeader>
          <CardTitle>Use-Case Shortlists</CardTitle>
          <CardDescription>
            Start from the job you need done, then narrow the categories worth studying.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredUseCases.map((useCase) => (
            <div key={useCase.id} className="rounded-md border border-border/70 bg-background p-4">
              <p className="text-sm font-semibold">{useCase.title}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{useCase.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {useCase.categoryIds.map((categoryId) => {
                  const category = getCategoryById(categoryId);

                  return (
                    <Badge key={category.id} variant="outline">
                      {category.name}
                    </Badge>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {filteredGroups.map((group) => (
        <CategorySection
          key={group.title}
          title={group.title}
          description={group.description}
          categories={group.categories}
        />
      ))}

      {!filteredGroups.length ? (
        <Card className="border-border/70 bg-card/95 shadow-sm">
          <CardContent className="p-6 text-sm leading-6 text-muted-foreground">
            No academy categories matched that search yet. Try a product name, a goal type, or a role like growth, safety, or liquidity.
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardHeader>
          <CardTitle>Investment Comparator</CardTitle>
          <CardDescription>
            Choose any two categories and compare them directly. You are no longer limited to only prebuilt pairs.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-4 rounded-md border border-border/70 bg-muted/20 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <SplitSquareVertical className="h-4 w-4 text-primary" />
              Compare what vs what
            </div>
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-end">
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Left side</span>
                <select
                  value={leftCategory.id}
                  onChange={(event) => setLeftCategoryId(event.target.value)}
                  className="h-11 rounded-md border bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {leftOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-center justify-center">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 w-11"
                  aria-label="Swap comparison sides"
                  onClick={() => {
                    setLeftCategoryId(rightCategory.id);
                    setRightCategoryId(leftCategory.id);
                  }}
                >
                  <ArrowRightLeft className="h-4 w-4" />
                </Button>
              </div>
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Right side</span>
                <select
                  value={rightCategory.id}
                  onChange={(event) => setRightCategoryId(event.target.value)}
                  className="h-11 rounded-md border bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {rightOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              {quickComparePairs.map(([leftId, rightId]) => {
                const left = getCategoryById(leftId);
                const right = getCategoryById(rightId);

                return (
                  <button
                    key={`${leftId}-${rightId}`}
                    type="button"
                    className="rounded-md border border-border/70 bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                    onClick={() => {
                      setLeftCategoryId(left.id);
                      setRightCategoryId(right.id);
                    }}
                  >
                    {left.name} vs {right.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr]">
            <ComparisonOption option={leftCategory} emphasis={comparisonSummary.leftEdge} />
            <div className="flex items-center justify-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-md border bg-muted text-xs font-semibold">
                VS
              </div>
            </div>
            <ComparisonOption option={rightCategory} emphasis={comparisonSummary.rightEdge} />
          </div>

          <div className="rounded-md border border-border/70 bg-muted/20 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Beginner read</Badge>
              <span className="text-sm font-medium">{comparisonSummary.defaultPick}</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {comparisonSummary.recommendation}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AcademyIntroCard({
  icon,
  text,
  title,
}: {
  icon: ReactNode;
  text: string;
  title: string;
}) {
  return (
    <div className="rounded-md border bg-background p-4">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted/50">
          {icon}
        </div>
        <p className="text-sm font-medium">{title}</p>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{text}</p>
    </div>
  );
}

function CategorySection({
  categories,
  description,
  title,
}: {
  categories: AcademyCategory[];
  description: string;
  title: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {categories.map((category) => (
          <div key={category.id} className="rounded-md border bg-background p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold">{category.name}</h3>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{category.risk}</Badge>
                <Badge variant="outline">{category.returnStyle}</Badge>
              </div>
            </div>
            <p className="mt-3 text-sm font-medium">{category.bestFor}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{category.beginnerNote}</p>
            <div className="mt-4 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
              <span>Role: {category.productRole}</span>
              <span>Effort: {category.effort}</span>
              <span>Horizon: {category.horizon}</span>
              <span>Liquidity: {category.liquidity}</span>
              <span className="md:col-span-2">Tax note: {category.taxHint}</span>
              <span className="md:col-span-2">Not ideal when: {category.notFor}</span>
            </div>
            <div className="mt-4 grid gap-2 rounded-md border bg-muted/30 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-foreground">Key watchouts</p>
              {category.keyWatchouts.map((watchout) => (
                <p key={watchout} className="text-xs text-muted-foreground">
                  {watchout}
                </p>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ComparisonOption({
  option,
  emphasis,
}: {
  option: AcademyCategory;
  emphasis: string;
}) {
  return (
    <div className="rounded-md border bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold">{option.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">{option.bestFor}</p>
        </div>
        <Badge variant="outline">{option.risk}</Badge>
      </div>
      <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
        <span>Role: {option.productRole}</span>
        <span>Effort: {option.effort}</span>
        <span>Liquidity: {option.liquidity}</span>
        <span>Horizon: {option.horizon}</span>
        <span>Tax note: {option.taxHint}</span>
        <span>Watchout: {option.keyWatchouts[0]}</span>
      </div>
      <div className="mt-4 rounded-md border bg-muted/30 p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-foreground">Beginner edge</p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{emphasis}</p>
      </div>
    </div>
  );
}
