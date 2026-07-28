"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
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
import { AskMentorLink } from "@/components/wealth/ask-mentor-link";
import { MentorOpenCue } from "@/components/wealth/mentor-open-cue";
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
import type { MentorLaunchRequest } from "@/lib/mentor-chat";
import type { RiskAnswers, RiskProfile } from "@/lib/wealth-rules";

export type AcademyFocusTarget = "comparator" | "track-plans" | "use-cases";
export type AcademyReturnState = {
  leftCategoryId: string;
  rightCategoryId: string;
  searchQuery: string;
};

export function Academy({
  answers,
  focusRequest,
  focusRequestKey,
  returnState,
  mentorRevision,
  onOpenMentor,
  profile,
}: {
  answers: RiskAnswers;
  focusRequest?: AcademyFocusTarget | null;
  focusRequestKey?: number;
  returnState?: AcademyReturnState | null;
  mentorRevision: number;
  onOpenMentor: (request: MentorLaunchRequest) => void;
  profile: RiskProfile;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [leftCategoryId, setLeftCategoryId] = useState("index-funds");
  const [rightCategoryId, setRightCategoryId] = useState("equity-mutual-funds");
  const [sectionNavigatorValue, setSectionNavigatorValue] = useState("academy-overview");
  const [trackNavigatorValue, setTrackNavigatorValue] = useState("academy-track-placeholder");
  const [useCaseNavigatorValue, setUseCaseNavigatorValue] = useState("academy-use-case-placeholder");
  const [categoryNavigatorValue, setCategoryNavigatorValue] = useState("academy-category-placeholder");

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
  const primaryTrack = trackPlans[0] ?? null;
  const secondaryTrack = trackPlans[1] ?? null;
  const academyMentorReturnState = {
    leftCategoryId: leftCategory.id,
    rightCategoryId: rightCategory.id,
    searchQuery,
  } satisfies AcademyReturnState;
  const academyReadinessLabel =
    normalizedQuery.length > 0
      ? "Search in progress"
      : trackPlans.length > 0
      ? "Learning plan ready"
        : "Explore categories";
  const academyCoverageStats = useMemo(
    () => ({
      groupCount: categoryGroups.length,
      categoryCount: categoryGroups.reduce(
        (total, group) => total + group.categories.length,
        0,
      ),
      useCaseCount: academyUseCases.length,
    }),
    [],
  );
  const searchResultCount = useMemo(
    () => filteredGroups.reduce((total, group) => total + group.categories.length, 0),
    [filteredGroups],
  );
  const academyOperatingLenses = [
    {
      label: "Current lane",
      value: primaryTrack?.title ?? "Explore categories",
      detail: primaryTrack
        ? "This is the cleanest next learning lane from your current profile and goal posture."
        : "Use the category finder or shortlists to create a first learning lane.",
    },
    {
      label: "Search pressure",
      value: normalizedQuery ? `${searchResultCount} matches` : "Browse mode",
      detail: normalizedQuery
        ? `${filteredUseCases.length} shortlists also match the current search.`
        : "Use search only when you already know the job or the category clue.",
    },
    {
      label: "Best close call",
      value: `${leftCategory.name} vs ${rightCategory.name}`,
      detail: "The comparator should settle the final close call, not start the session.",
    },
  ];
  const academyWorkingOrder = [
    "Start with the guided lane so you reduce the choice set first.",
    "Open one shortlist when the money job is clearer than the product category.",
    "Use the comparator only after the decision is down to two realistic options.",
  ];
  type AcademyPriorityAction =
    | "track-plans"
    | "use-cases"
    | "comparator"
    | "search-reset";
  const academyPriorityQueue = [
    {
      title: primaryTrack ? "Start with your guided lane" : "Open guided learning lanes",
      detail: primaryTrack
        ? `${primaryTrack.title} is the cleanest first pass from your current answers and profile.`
        : "Let the app narrow the next study lane before you browse the full category library.",
      action: "track-plans" as AcademyPriorityAction,
    },
    {
      title: normalizedQuery
        ? `Review ${filteredUseCases.length} matching shortlists`
        : "Use shortlists by money job",
      detail: normalizedQuery
        ? "Your current search already maps to shortlists. Use them to turn a fuzzy search into a smaller study set."
        : "Shortlists work best when you know the goal or money job but not the right product family yet.",
      action: "use-cases" as AcademyPriorityAction,
    },
    {
      title:
        leftCategory.id === rightCategory.id
          ? "Pick two categories to compare"
          : `Pressure-test ${leftCategory.name} vs ${rightCategory.name}`,
      detail:
        leftCategory.id === rightCategory.id
          ? "Use the comparator after you have narrowed the field to two realistic options."
          : "Use the final close-call lens only after you understand the role each option is supposed to play.",
      action: "comparator" as AcademyPriorityAction,
    },
    ...(normalizedQuery
      ? [
          {
            title: "Clear search and return to browse mode",
            detail:
              "If results feel too narrow, reset the finder and use the guided lane or shortlists instead.",
            action: "search-reset" as AcademyPriorityAction,
          },
        ]
      : []),
  ];
  const academyWorkspaceVerdict =
    normalizedQuery.length > 0
      ? {
          badge: "Search is narrowing the field",
          badgeVariant: "outline" as const,
          detail:
            "You are no longer in broad browse mode. The best use of the page now is turning this narrower set into one realistic learning lane, not reopening the whole category universe.",
          move: "Use the filtered tracks, shortlists, or categories to settle one next topic before widening the search again.",
          toneClass: "border-sky-500/30 bg-sky-500/10",
        }
      : primaryTrack
        ? {
            badge: "Learning desk is ready",
            badgeVariant: "secondary" as const,
            detail:
              "The academy already has enough context from your profile to give you a strong first lane, which means you do not need to start from the full library.",
            move: "Start with the guided lane first, then use shortlists or comparison only when the decision tightens.",
            toneClass: "border-emerald-500/30 bg-emerald-500/10",
          }
        : {
            badge: "Browse mode",
            badgeVariant: "outline" as const,
            detail:
              "The page can still help, but it is waiting on either a clearer search or a cleaner learning lane to reduce the choice set.",
            move: "Use the finder or one shortlist to turn the page from browsing into a focused study session.",
            toneClass: "border-sky-500/30 bg-sky-500/10",
          };
  const trackVerdict =
    primaryTrack
      ? {
          badge: "Best starting lane is visible",
          badgeVariant: "secondary" as const,
          detail:
            "The guided tracks are already doing the most valuable work on this page: shrinking a huge category set into one next lane that fits your profile and current goal posture.",
          move: `Start with ${primaryTrack.title} before you open the larger library.`,
          toneClass: "border-emerald-500/30 bg-emerald-500/10",
        }
      : {
          badge: "Tracks need a clearer base",
          badgeVariant: "outline" as const,
          detail:
            "Without a stronger profile signal, the guided lane area is more suggestion than sequence.",
          move: "Use search or a shortlist first, then come back when the category job is clearer.",
          toneClass: "border-sky-500/30 bg-sky-500/10",
        };
  const useCaseVerdict =
    filteredUseCases.length > 0
      ? {
          badge: "Money-job view is usable",
          badgeVariant: "secondary" as const,
          detail:
            "The shortlist lane is strong because it starts from the problem to solve, which usually leads to better beginner decisions than starting from product labels.",
          move: "Open one shortlist, then compare only the categories it keeps alive.",
          toneClass: "border-emerald-500/30 bg-emerald-500/10",
        }
      : {
          badge: "No shortlist matches yet",
          badgeVariant: "outline" as const,
          detail:
            "The shortlist lane cannot reduce the field until the search or learning job becomes clearer.",
          move: "Search by goal or role words like retirement, safety, liquidity, or growth.",
          toneClass: "border-amber-500/30 bg-amber-500/10",
        };
  const comparatorVerdict =
    leftCategory.id === rightCategory.id
      ? {
          badge: "Comparator is not active yet",
          badgeVariant: "outline" as const,
          detail:
            "The comparator is most useful only when two realistic options are still alive. Right now it still needs a real close call.",
          move: "Pick two categories that feel genuinely adjacent, then use this to settle the final choice.",
          toneClass: "border-sky-500/30 bg-sky-500/10",
        }
      : {
          badge: "Close-call desk is live",
          badgeVariant: "secondary" as const,
          detail:
            "This is now the right place to separate similar-looking categories by role, effort, and watchouts instead of relying on surface labels.",
          move: `Use ${comparisonSummary.defaultPick} as the default unless the other option solves a meaningfully different job for you.`,
          toneClass: "border-emerald-500/30 bg-emerald-500/10",
        };
  const academyMentorPrompt = [
    `I am comparing ${leftCategory.name} versus ${rightCategory.name}${searchQuery.trim() ? ` while searching for "${searchQuery.trim()}"` : ""}.`,
    `My current learning posture is ${academyReadinessLabel}.`,
    `My profile is ${profile.band} with ${profile.confidence} confidence, and my investing personality reads as ${profile.personality}.`,
    `My main goal is ${answers.primaryGoal}, my experience level is ${answers.experience}, and my current market-drop response is ${answers.marketDropResponse}.`,
    trackPlans[0]
      ? `The top suggested learning lane right now is "${trackPlans[0].title}".`
      : null,
    `Help me decide which category fits my goal and profile better, and tell me what confusion I should clear up before choosing.`,
  ]
    .filter(Boolean)
    .join(" ");
  const trackPlansRef = useRef<HTMLDivElement | null>(null);
  const useCasesRef = useRef<HTMLDivElement | null>(null);
  const comparatorRef = useRef<HTMLDivElement | null>(null);
  const introRef = useRef<HTMLDivElement | null>(null);
  const navigationMapRef = useRef<HTMLDivElement | null>(null);
  const finderRef = useRef<HTMLDivElement | null>(null);
  const scrollToAcademySection = (target: AcademyFocusTarget) => {
    (
      {
        comparator: comparatorRef,
        "track-plans": trackPlansRef,
        "use-cases": useCasesRef,
      } satisfies Record<AcademyFocusTarget, typeof comparatorRef>
    )[target]?.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };
  const scrollToAcademyElement = (id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };
  const openTrackComparator = (categoryIds: string[]) => {
    if (categoryIds.length >= 2) {
      setLeftCategoryId(categoryIds[0]);
      setRightCategoryId(categoryIds[1]);
    } else if (categoryIds[0]) {
      setLeftCategoryId(categoryIds[0]);
    }
    scrollToAcademySection("comparator");
  };
  const handleAcademyPriorityAction = (action: AcademyPriorityAction) => {
    if (action === "search-reset") {
      setSearchQuery("");
      return;
    }
    scrollToAcademySection(action);
  };
  const sectionNavigatorOptions = [
    ["academy-overview", "Overview: learning desk"],
    ["academy-priority-queue", "Queue: next best lane"],
    ["academy-track-plans", "Lanes: guided tracks"],
    ["academy-intro", "Start: academy intro"],
    ["academy-navigation-map", "Map: beginner route"],
    ["academy-category-finder", "Finder: category search"],
    ["academy-use-cases", "Shortlists: money jobs"],
    ["academy-comparator", "Compare: category close call"],
  ] as Array<[string, string]>;
  const trackNavigatorOptions = [
    ["academy-track-placeholder", "Choose a guided lane"],
    ...trackPlans.map((plan) => [`academy-track-${plan.id}`, `Lane: ${plan.title}`] as [string, string]),
  ];
  const useCaseNavigatorOptions = [
    ["academy-use-case-placeholder", "Choose a shortlist"],
    ...academyUseCases.map((useCase) => [`academy-use-case-${useCase.id}`, `Shortlist: ${useCase.title}`] as [string, string]),
  ];
  const categoryNavigatorOptions = [
    ["academy-category-placeholder", "Choose a category card"],
    ...categoryGroups.flatMap((group) =>
      group.categories.map(
        (category) =>
          [
            `academy-category-${category.id}`,
            `${group.title}: ${category.name}`,
          ] as [string, string],
      ),
    ),
  ];

  const handleSectionNavigate = (value: string) => {
    setSectionNavigatorValue(value);
    if (value === "academy-overview") {
      scrollToAcademyElement(value);
      return;
    }
    if (value === "academy-track-plans") {
      scrollToAcademySection("track-plans");
      return;
    }
    if (value === "academy-use-cases") {
      scrollToAcademySection("use-cases");
      return;
    }
    if (value === "academy-comparator") {
      scrollToAcademySection("comparator");
      return;
    }
    if (value === "academy-intro") {
      introRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (value === "academy-navigation-map") {
      navigationMapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (value === "academy-category-finder") {
      finderRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    scrollToAcademyElement(value);
  };

  const handleTrackNavigate = (value: string) => {
    setTrackNavigatorValue(value);
    if (value === "academy-track-placeholder") return;
    scrollToAcademySection("track-plans");
    window.requestAnimationFrame(() => scrollToAcademyElement(value));
  };

  const handleUseCaseNavigate = (value: string) => {
    setUseCaseNavigatorValue(value);
    if (value === "academy-use-case-placeholder") return;
    scrollToAcademySection("use-cases");
    window.requestAnimationFrame(() => scrollToAcademyElement(value));
  };

  const handleCategoryNavigate = (value: string) => {
    setCategoryNavigatorValue(value);
    if (value === "academy-category-placeholder") return;
    const categoryId = value.replace("academy-category-", "");
    const category = getCategoryById(categoryId);
    setSearchQuery(category.name);
    window.requestAnimationFrame(() => scrollToAcademyElement(value));
  };

  useEffect(() => {
    if (!focusRequest) return;

    window.requestAnimationFrame(() => {
      (
        {
          comparator: comparatorRef,
          "track-plans": trackPlansRef,
          "use-cases": useCasesRef,
        } satisfies Record<AcademyFocusTarget, typeof comparatorRef>
      )[focusRequest]?.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [focusRequest, focusRequestKey]);

  useEffect(() => {
    if (!returnState) return;
    setSearchQuery(returnState.searchQuery);
    setLeftCategoryId(returnState.leftCategoryId);
    setRightCategoryId(returnState.rightCategoryId);
  }, [returnState, focusRequestKey]);

  return (
    <div className="academy-page grid gap-5">
      <Card id="academy-overview" className="wealth-panel-strong overflow-hidden">
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
              <div className="mt-3">
                <AskMentorLink
                  label="Ask AI mentor which category fits your goal"
                  returnState={academyMentorReturnState}
                  mentorPrompt={academyMentorPrompt}
                  mentorQuestionId="etf"
                  onOpenMentor={onOpenMentor}
                  sourceLabel="Academy category fit"
                />
              </div>
              <div className="mt-3">
                <MentorOpenCue
                  cueLabel="Still open before choosing"
                  description="You already have an open mentor thread that could sharpen this category decision before you compare further."
                  mentorRevision={mentorRevision}
                  onOpenMentor={onOpenMentor}
                  questionIds={["etf", "tax", "gold", "crash"]}
                  resumeLabel="Talk this through with AI mentor"
                  sourceLabel="Academy"
                  stuckLabel="Unblock this before choosing a lane"
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="wealth-muted-block p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Guided tracks
                </p>
                <p className="mt-3 text-sm font-medium leading-6 text-foreground">
                  {trackPlans.length} personalized lane{trackPlans.length === 1 ? "" : "s"} built from your current profile and answers.
                </p>
              </div>
              <div className="wealth-muted-block p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Compare on purpose
                </p>
                <p className="mt-3 text-sm font-medium leading-6 text-foreground">
                  Put two categories side by side before you mistake similar labels for similar roles.
                </p>
              </div>
              <div className="wealth-muted-block p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Start from the job
                </p>
                <p className="mt-3 text-sm font-medium leading-6 text-foreground">
                  Use shortlists for growth, safety, liquidity, retirement, and near-term money decisions.
                </p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Main goal
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {answers.primaryGoal}
                </p>
              </div>
              <div className="rounded-md border border-sky-500/20 bg-sky-500/5 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Experience level
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {answers.experience}
                </p>
              </div>
              <div className="rounded-md border border-violet-500/20 bg-violet-500/5 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Confidence band
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {profile.confidence}
                </p>
              </div>
              <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Suggested first lane
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {primaryTrack?.title ?? "Explore category finder"}
                </p>
              </div>
            </div>
            <div className={`grid gap-3 rounded-md border p-4 md:grid-cols-[1fr_0.9fr] ${academyWorkspaceVerdict.toneClass}`}>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-foreground">Academy verdict</p>
                  <Badge variant={academyWorkspaceVerdict.badgeVariant}>{academyWorkspaceVerdict.badge}</Badge>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {academyWorkspaceVerdict.detail}
                </p>
              </div>
              <div className="rounded-md border border-border/60 bg-background/70 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Best operating move
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {academyWorkspaceVerdict.move}
                </p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {academyOperatingLenses.map((lens) => (
                <div key={lens.label} className="wealth-data-card p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {lens.label}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-foreground">{lens.value}</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{lens.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 content-start">
            <div className="wealth-muted-block p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Session map
              </p>
              <div className="mt-3 grid gap-2 text-sm text-foreground">
                <p>1. Start with your guided learning lane.</p>
                <p>2. Narrow the job using shortlists.</p>
                <p>3. Use the comparator only for the final close call.</p>
              </div>
            </div>
            <div className="wealth-muted-block p-4">
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
            <div className="wealth-muted-block p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Best next move
              </p>
              <p className="mt-3 text-sm leading-6 text-foreground">
                {trackPlans[0]?.description ??
                  "Use the category finder or use-case shortlists to narrow the next topic worth learning."}
              </p>
            </div>
            <div className="wealth-muted-block p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Today&apos;s learning route
              </p>
              <div className="mt-3 grid gap-2 text-sm text-foreground">
                <p>1. Review the first lane and understand the job it solves.</p>
                <p>2. Shortlist only one money decision to study next.</p>
                <p>3. Use the comparator for the last close call, not the first pass.</p>
              </div>
            </div>
            <div className="wealth-data-card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Reading order
              </p>
              <ul className="mt-3 grid gap-2 text-sm leading-6 text-foreground">
                {academyWorkingOrder.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="wealth-muted-block p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Page coverage
              </p>
              <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="font-semibold text-foreground">
                    {academyCoverageStats.groupCount}
                  </p>
                  <p className="text-muted-foreground">groups</p>
                </div>
                <div>
                  <p className="font-semibold text-foreground">
                    {academyCoverageStats.categoryCount}
                  </p>
                  <p className="text-muted-foreground">categories</p>
                </div>
                <div>
                  <p className="font-semibold text-foreground">
                    {academyCoverageStats.useCaseCount}
                  </p>
                  <p className="text-muted-foreground">use cases</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="sticky top-3 z-20">
        <div className="wealth-panel-strong rounded-lg border border-border/80 bg-background/95 px-3 py-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/85">
          <div className="grid grid-cols-[auto_repeat(4,minmax(0,1fr))] items-center gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Badge variant="secondary">Academy navigator</Badge>
            </div>
            <select
              aria-label="Browse Academy sections"
              className="h-8 min-w-0 rounded-md border border-border bg-background px-2 text-[11px] text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              value={sectionNavigatorValue}
              onChange={(event) => handleSectionNavigate(event.target.value)}
            >
              {sectionNavigatorOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              aria-label="Browse Academy guided lanes"
              className="h-8 min-w-0 rounded-md border border-border bg-background px-2 text-[11px] text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              value={trackNavigatorValue}
              onChange={(event) => handleTrackNavigate(event.target.value)}
            >
              {trackNavigatorOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              aria-label="Browse Academy shortlists"
              className="h-8 min-w-0 rounded-md border border-border bg-background px-2 text-[11px] text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              value={useCaseNavigatorValue}
              onChange={(event) => handleUseCaseNavigate(event.target.value)}
            >
              {useCaseNavigatorOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              aria-label="Browse Academy categories"
              className="h-8 min-w-0 rounded-md border border-border bg-background px-2 text-[11px] text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              value={categoryNavigatorValue}
              onChange={(event) => handleCategoryNavigate(event.target.value)}
            >
              {categoryNavigatorOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <Card id="academy-priority-queue" className="wealth-panel-strong overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Priority queue</Badge>
            <Badge variant="outline">{academyReadinessLabel}</Badge>
          </div>
          <CardTitle>What to do next on this page</CardTitle>
          <CardDescription>
            Enter the academy from the smallest useful next move, not from the full category list.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {academyPriorityQueue.map((item) => (
            <button
              key={item.title}
              type="button"
              onClick={() => handleAcademyPriorityAction(item.action)}
              className="wealth-data-card text-left transition hover:bg-muted/40"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Next move
              </p>
              <p className="mt-2 text-sm font-semibold text-foreground">{item.title}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.detail}</p>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card className="wealth-panel-strong overflow-hidden">
        <CardContent className="grid gap-3 p-4 md:grid-cols-3">
          <button
            type="button"
            onClick={() => scrollToAcademySection("track-plans")}
            className="wealth-data-card text-left transition hover:bg-muted/40"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Start here
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              Guided learning lanes
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Best when you want the cleanest next step based on your current profile.
            </p>
          </button>
          <button
            type="button"
            onClick={() => scrollToAcademySection("use-cases")}
            className="wealth-data-card text-left transition hover:bg-muted/40"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Narrow the job
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              Use-case shortlists
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Best when you already know the money decision but not the category.
            </p>
          </button>
          <button
            type="button"
            onClick={() => scrollToAcademySection("comparator")}
            className="wealth-data-card text-left transition hover:bg-muted/40"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Final choice
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              Comparator desk
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Best when two categories still feel similar and you need the deciding lens.
            </p>
          </button>
        </CardContent>
      </Card>

      <Card id="academy-track-plans" ref={trackPlansRef} className="wealth-panel-strong overflow-hidden">
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
        <CardContent className="grid gap-4">
          <div className="wealth-chart-frame grid gap-3 md:grid-cols-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Use this first
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                When you want the app to reduce overload and point to the smallest useful next study lane.
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Watch closely
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                Do not study five lanes at once. One lane is enough until the next real money decision changes.
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Best next move
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                Finish one lane, compare only the categories inside it, then come back if your goal or confidence shifts.
              </p>
            </div>
          </div>
            <div className="grid gap-4 xl:grid-cols-3">
          {trackPlans.map((plan) => (
            <div id={`academy-track-${plan.id}`} key={plan.id} className="wealth-data-card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">{plan.title}</p>
                <Badge variant="outline">{plan.categoryIds.length} categories</Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{plan.description}</p>
              <div className="mt-4 rounded-lg border border-border/75 bg-muted/30 p-3">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5" />
                  What this track helps with
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Move from broad category confusion to a smaller set of products that fit your current stage, goal pressure, and learning confidence.
                </p>
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-3">
                <div className="wealth-stat-tile p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Best for now
                  </p>
                  <p className="mt-2 text-xs leading-5 text-foreground">
                    Focused learning with fewer choices and clearer category roles.
                  </p>
                </div>
                <div className="wealth-stat-tile p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Avoid doing
                  </p>
                  <p className="mt-2 text-xs leading-5 text-foreground">
                    Jumping into a product before you understand what job this lane is solving.
                  </p>
                </div>
                <div className="wealth-stat-tile p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Exit signal
                  </p>
                  <p className="mt-2 text-xs leading-5 text-foreground">
                    You can explain in plain words when each category in this lane fits and when it does not.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-2">
                {plan.useCaseIds.map((useCaseId) => {
                  const useCase = academyUseCases.find((item) => item.id === useCaseId);
                  if (!useCase) return null;

                  return (
                    <div key={useCase.id} className="wealth-stat-tile p-3">
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
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => scrollToAcademySection("use-cases")}
                >
                  Open shortlists
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => openTrackComparator(plan.categoryIds)}
                >
                  Compare this lane
                </Button>
              </div>
            </div>
          ))}
          </div>
        </CardContent>
      </Card>

      <Card id="academy-intro" ref={introRef} className="wealth-panel-strong overflow-hidden">
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

      <Card id="academy-navigation-map" ref={navigationMapRef} className="wealth-panel-strong overflow-hidden">
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

      <Card id="academy-category-finder" ref={finderRef} className="wealth-panel-strong overflow-hidden">
        <CardHeader>
          <CardTitle>Category Finder</CardTitle>
          <CardDescription>
            Search by product name, role, or beginner use case.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className={`grid gap-3 rounded-md border p-4 md:grid-cols-[1fr_0.9fr] ${trackVerdict.toneClass}`}>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-foreground">Guided-lane verdict</p>
                <Badge variant={trackVerdict.badgeVariant}>{trackVerdict.badge}</Badge>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{trackVerdict.detail}</p>
            </div>
            <div className="rounded-md border border-border/60 bg-background/70 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Best operating move
              </p>
              <p className="mt-2 text-sm font-semibold text-foreground">{trackVerdict.move}</p>
            </div>
          </div>
          <div className="wealth-muted-block grid gap-3 p-4 md:grid-cols-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Good searches
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                Try phrases like retirement, short-term money, gold hedge, diversification, or core growth.
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                What this avoids
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                Random scrolling through every category when the real question is still fuzzy.
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Results now
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                {searchResultCount} categories and {filteredUseCases.length} use cases match your current search.
              </p>
            </div>
          </div>
          <label className="grid gap-2 text-sm">
            <span className="font-medium">Search categories</span>
            <div className="wealth-data-card flex items-center gap-2 px-3">
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

      <Card id="academy-use-cases" ref={useCasesRef} className="wealth-panel-strong overflow-hidden">
        <CardHeader>
          <CardTitle>Use-Case Shortlists</CardTitle>
          <CardDescription>
            Start from the job you need done, then narrow the categories worth studying.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className={`grid gap-3 rounded-md border p-4 md:grid-cols-[1fr_0.9fr] ${useCaseVerdict.toneClass}`}>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-foreground">Shortlist verdict</p>
                <Badge variant={useCaseVerdict.badgeVariant}>{useCaseVerdict.badge}</Badge>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{useCaseVerdict.detail}</p>
            </div>
            <div className="rounded-md border border-border/60 bg-background/70 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Best operating move
              </p>
              <p className="mt-2 text-sm font-semibold text-foreground">{useCaseVerdict.move}</p>
            </div>
          </div>
          {primaryTrack ? (
            <div className="grid gap-3 rounded-md border border-primary/20 bg-primary/5 p-4 md:grid-cols-[1.15fr_0.85fr]">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Suggested from your current profile
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {primaryTrack.title}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {primaryTrack.description}
                </p>
              </div>
              <div className="grid gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Shortlists worth opening first
                </p>
                <div className="flex flex-wrap gap-2">
                  {primaryTrack.useCaseIds.map((useCaseId) => {
                    const useCase = academyUseCases.find((item) => item.id === useCaseId);
                    if (!useCase) return null;
                    return (
                      <Badge key={useCase.id} variant="outline">
                        {useCase.title}
                      </Badge>
                    );
                  })}
                </div>
                {secondaryTrack ? (
                  <p className="text-xs leading-5 text-muted-foreground">
                    Backup lane: {secondaryTrack.title}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
          <div className="wealth-muted-block grid gap-3 p-4 md:grid-cols-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Use this when
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                You know the decision, like short-term parking or retirement planning, but not the right category family.
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Common mistake
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                Picking a product because it sounds familiar before checking whether it matches the time horizon.
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Best move
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                Pick one shortlist, then compare only the categories it recommends.
              </p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredUseCases.map((useCase) => (
            <div id={`academy-use-case-${useCase.id}`} key={useCase.id} className="wealth-data-card p-4">
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
          </div>
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
        <Card className="wealth-panel-strong overflow-hidden">
          <CardContent className="grid gap-4 p-6">
            <div>
              <p className="text-sm font-medium text-foreground">Nothing matched that search yet</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Try a product name, a goal type, or a role like growth, safety, liquidity, diversification, or tax saving.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="wealth-stat-tile p-3">
                <p className="text-xs text-muted-foreground">Good first retry</p>
                <p className="mt-1 text-sm font-medium">Search by goal</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Terms like retirement, emergency, short-term money, or income usually work better than product jargon.
                </p>
              </div>
              <div className="wealth-stat-tile p-3">
                <p className="text-xs text-muted-foreground">Then narrow</p>
                <p className="mt-1 text-sm font-medium">Use one role word</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Try one clean lens such as safety, growth, or liquidity before comparing categories.
                </p>
              </div>
              <div className="wealth-stat-tile p-3">
                <p className="text-xs text-muted-foreground">Best next move</p>
                <p className="mt-1 text-sm font-medium">Review a shortlist instead</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  If search still feels fuzzy, the use-case shortlists usually give a better starting point.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card id="academy-comparator" ref={comparatorRef} className="wealth-panel-strong overflow-hidden">
        <CardHeader>
          <CardTitle>Category comparator</CardTitle>
          <CardDescription>
            Choose any two categories and compare them directly. You are no longer limited to only prebuilt pairs.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className={`grid gap-3 rounded-md border p-4 md:grid-cols-[1fr_0.9fr] ${comparatorVerdict.toneClass}`}>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-foreground">Comparator verdict</p>
                <Badge variant={comparatorVerdict.badgeVariant}>{comparatorVerdict.badge}</Badge>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{comparatorVerdict.detail}</p>
            </div>
            <div className="rounded-md border border-border/60 bg-background/70 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Best operating move
              </p>
              <p className="mt-2 text-sm font-semibold text-foreground">{comparatorVerdict.move}</p>
            </div>
          </div>
          <div className="wealth-muted-block grid gap-3 p-4 md:grid-cols-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Use comparator when
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                Two categories feel similar, but the money role, risk path, or effort level may still be meaningfully different.
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Avoid using it for
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                Broad exploration before you know the goal job. Use tracks or shortlists first if the choice set is still too wide.
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Best outcome
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                You leave with a default pick, a watchout, and a plain reason for why the other option is not first.
              </p>
            </div>
          </div>
          <div className="wealth-inset grid gap-4 p-4">
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
                  variant="ghost"
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
                    className="wealth-data-card px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-primary/5"
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

          <div className="wealth-muted-block p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Beginner read</Badge>
              <span className="text-sm font-medium">{comparisonSummary.defaultPick}</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {comparisonSummary.recommendation}
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="wealth-data-card p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Default pick
                </p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {comparisonSummary.defaultPick}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Start here if you need the simpler first choice rather than the more exciting label.
                </p>
              </div>
              <div className="wealth-data-card p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  What decides it
                </p>
                <p className="mt-2 text-sm text-foreground">
                  Focus on the money role, effort level, and watchout that matter most for your current goal.
                </p>
              </div>
              <div className="wealth-data-card p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Best next move
                </p>
                <p className="mt-2 text-sm text-foreground">
                  Take the default pick forward, and keep the other option as a later comparison note instead of forcing both into the plan.
                </p>
              </div>
            </div>
            <div className="mt-4">
              <AskMentorLink
                label="Ask AI mentor to explain this comparison"
                returnState={academyMentorReturnState}
                mentorPrompt={academyMentorPrompt}
                mentorQuestionId="etf"
                onOpenMentor={onOpenMentor}
                sourceLabel="Academy comparator"
              />
            </div>
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
    <div className="wealth-inset p-4">
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
    <Card className="wealth-panel-strong overflow-hidden">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {categories.map((category) => (
          <div id={`academy-category-${category.id}`} key={category.id} className="wealth-inset p-4">
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
            <div className="wealth-muted-block mt-4 grid gap-2 p-3">
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
    <div className="wealth-inset p-4">
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
      <div className="wealth-muted-block mt-4 p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-foreground">Beginner edge</p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{emphasis}</p>
      </div>
    </div>
  );
}
