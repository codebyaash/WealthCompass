"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, MessageCircleQuestion, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MetricMini } from "@/components/wealth/metric-mini";
import { formatMoney } from "@/lib/formatters";
import {
  getMentorAnswer,
  getSuggestedMentorQuestions,
  mentorQuestions,
  type MentorQuestionId,
} from "@/lib/mentor-rules";
import type { PortfolioAsset } from "@/lib/local-storage";
import type { RiskAnswers, RiskProfile } from "@/lib/wealth-rules";

export function MentorPanel({
  answers,
  assets,
  profile,
}: {
  answers: RiskAnswers;
  assets: PortfolioAsset[];
  profile: RiskProfile;
}) {
  const [activeQuestionId, setActiveQuestionId] = useState<MentorQuestionId>(
    mentorQuestions[0].id,
  );
  const activeQuestion =
    mentorQuestions.find((question) => question.id === activeQuestionId) ??
    mentorQuestions[0];
  const answer = getMentorAnswer({
    answers,
    assets,
    formatMoney,
    profile,
    questionId: activeQuestion.id,
  });
  const suggestedQuestions = getSuggestedMentorQuestions({
    answers,
    assets,
  });
  const topSuggestedQuestion =
    mentorQuestions.find((question) => question.id === suggestedQuestions[0]) ??
    mentorQuestions[0];
  const mentorReadinessLabel =
    assets.length === 0
      ? "Foundation coaching"
      : answer.focusLabel === "Concentration risk"
        ? "Portfolio coaching"
        : "Decision coaching";

  return (
    <div className="grid gap-5">
      <Card className="overflow-hidden border-border/70 bg-card/95 shadow-sm">
        <CardContent className="grid gap-5 p-6 lg:grid-cols-[1.15fr_0.85fr] lg:p-7">
          <div className="grid gap-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Mentor coaching desk</Badge>
              <Badge variant="outline">{mentorReadinessLabel}</Badge>
              <Badge variant="outline">{profile.band}</Badge>
              <Badge variant="outline">{profile.confidence}</Badge>
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                Get one clearer investing decision at a time.
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                This mentor is strongest when you bring one real doubt, read the personalized context, and leave with one practical next move. The goal is clarity and momentum, not more mental clutter.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-md border border-border/70 bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Best next question
                </p>
                <p className="mt-3 text-sm font-medium leading-6 text-foreground">
                  {topSuggestedQuestion.label}
                </p>
              </div>
              <div className="rounded-md border border-border/70 bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Focus today
                </p>
                <p className="mt-3 text-sm font-medium leading-6 text-foreground">
                  {answer.focusLabel}
                </p>
              </div>
              <div className="rounded-md border border-border/70 bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Coaching track
                </p>
                <p className="mt-3 text-sm font-medium leading-6 text-foreground">
                  {answer.actionTrack.title}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 content-start">
            <div className="rounded-md border border-border/70 bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Coaching read
              </p>
              <p className="mt-3 text-base font-semibold text-foreground">
                {answer.summary}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {answer.actionTrack.description}
              </p>
            </div>
            <div className="rounded-md border border-border/70 bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Best next move
              </p>
              <p className="mt-3 text-sm leading-6 text-foreground">
                {answer.actionTrack.nextMove}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardHeader>
          <CardTitle>Investment mentor</CardTitle>
          <CardDescription>
            Guided explanations tuned to your profile, portfolio, and current setup stage.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 rounded-md border border-border/70 bg-muted/20 p-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{profile.band}</Badge>
              <Badge variant="outline">{profile.confidence}</Badge>
              <Badge variant="outline">{answer.actionTrack.title}</Badge>
            </div>
            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="grid gap-4">
                <div>
                  <p className="text-lg font-semibold tracking-tight text-foreground">
                    Ask the next question that makes your plan clearer, not more complicated.
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    This mentor works best when you use it to remove one doubt at a time, then turn the answer into a simple next move.
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-md border border-border/70 bg-background p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      1. Start with what matters
                    </p>
                    <p className="mt-2 text-sm leading-6">
                      Pick the question that matches your real decision, not the most advanced topic.
                    </p>
                  </div>
                  <div className="rounded-md border border-border/70 bg-background p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      2. Read the checkpoints
                    </p>
                    <p className="mt-2 text-sm leading-6">
                      Use the portfolio and profile cues to understand why the answer is personalized.
                    </p>
                  </div>
                  <div className="rounded-md border border-border/70 bg-background p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      3. Act on one step
                    </p>
                    <p className="mt-2 text-sm leading-6">
                      A good mentor answer should end in one calmer decision, not ten new tasks.
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid gap-3">
                <div className="rounded-md border border-border/70 bg-background p-4">
                  <p className="text-sm font-medium">Best next question</p>
                  <p className="mt-2 text-sm font-semibold text-foreground">
                    {topSuggestedQuestion.label}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    Start here if you want the shortest path to the most relevant answer right now.
                  </p>
                </div>
                <div className="rounded-md border border-border/70 bg-background p-4">
                  <p className="text-sm font-medium">Coaching track</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {answer.actionTrack.description}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-md border border-border/70 bg-muted/20 p-4">
            <p className="text-sm font-medium">Recommended now</p>
            <div className="mt-3 grid gap-2">
              {suggestedQuestions.map((questionId) => {
                const question = mentorQuestions.find((item) => item.id === questionId);
                if (!question) return null;

                return (
                  <Button
                    key={question.id}
                    type="button"
                    variant={activeQuestion.id === question.id ? "default" : "secondary"}
                    className="h-auto min-h-11 justify-start whitespace-normal text-left leading-5"
                    onClick={() => setActiveQuestionId(question.id)}
                  >
                    <MessageCircleQuestion className="h-4 w-4 shrink-0" />
                    {question.label}
                  </Button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-2">
            <p className="text-sm font-medium">Question library</p>
          {mentorQuestions.map((question) => (
            <Button
              key={question.id}
              type="button"
              variant={activeQuestion.id === question.id ? "default" : "outline"}
              className="h-auto min-h-11 justify-start whitespace-normal text-left leading-5"
              onClick={() => setActiveQuestionId(question.id)}
            >
              <MessageCircleQuestion className="h-4 w-4 shrink-0" />
              {question.label}
            </Button>
          ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{profile.personality}</Badge>
            <Badge variant="outline">{profile.band}</Badge>
            <Badge variant="outline">{answer.focusLabel}</Badge>
            <Badge variant="outline">{answer.actionTrack.title}</Badge>
          </div>
          <CardTitle>{activeQuestion.title}</CardTitle>
          <CardDescription>{answer.summary}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-3 rounded-md border border-border/70 bg-muted/20 p-4 md:grid-cols-[1fr_0.95fr]">
            <div>
              <p className="text-sm font-medium">What this answer is optimizing for</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {answer.summary} The point is not just to explain the topic, but to connect it to your current profile, portfolio shape, and setup stage.
              </p>
            </div>
            <div className="rounded-md border border-border/70 bg-background p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Best next move
              </p>
              <p className="mt-2 text-sm leading-6">{answer.actionTrack.nextMove}</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {answer.checkpoints.map((checkpoint) => (
              <MetricMini
                key={checkpoint.label}
                label={checkpoint.label}
                value={checkpoint.value}
              />
            ))}
          </div>
          <div className="rounded-md border border-border/70 bg-muted/20 p-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Plain-language answer
            </div>
            <p className="mt-3 text-sm leading-6 text-foreground">{answer.explanation}</p>
          </div>
          <div className="rounded-md border border-border/70 bg-background p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">{answer.actionTrack.title}</p>
              <Badge variant="outline">Coach track</Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {answer.actionTrack.description}
            </p>
            <div className="mt-3 rounded-md border border-border/70 bg-muted/20 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Best next move
              </p>
              <p className="mt-2 text-sm leading-6">{answer.actionTrack.nextMove}</p>
            </div>
          </div>
          <div className="grid gap-3 rounded-md border border-border/70 bg-background p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Decision steps</p>
              <Badge variant="outline">{answer.focusLabel}</Badge>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              Use these in order. They are meant to reduce confusion and turn the answer into one practical decision.
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              {answer.steps.map((step, index) => (
                <div key={step} className="rounded-md border border-border/70 bg-muted/20 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Step {index + 1}
                  </p>
                  <CheckCircle2 className="mt-3 h-4 w-4 text-primary" />
                  <p className="mt-3 text-sm leading-6">{step}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-md border border-border/70 bg-background p-4">
            <p className="text-sm font-medium">Personal note</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {answer.personalNote}
            </p>
          </div>
          <div className="rounded-md border border-border/70 bg-background p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">Keep going with</p>
              <Badge variant="outline">Next questions</Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {answer.followUps.map((questionId) => {
                const question = mentorQuestions.find((item) => item.id === questionId);
                if (!question) return null;

                return (
                  <Button
                    key={question.id}
                    type="button"
                    variant="outline"
                    className="h-9"
                    onClick={() => setActiveQuestionId(question.id)}
                  >
                    {question.label}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
