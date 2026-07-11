"use client";

import { useState } from "react";
import { CheckCircle2, MessageCircleQuestion } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatMoney } from "@/lib/formatters";
import {
  getMentorAnswer,
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

  return (
    <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
      <Card>
        <CardHeader>
          <CardTitle>Investment Mentor</CardTitle>
          <CardDescription>
            Rule-based explanations now, AI-powered personalization later.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{profile.personality}</Badge>
            <Badge variant="outline">{profile.band}</Badge>
          </div>
          <CardTitle>{activeQuestion.title}</CardTitle>
          <CardDescription>{answer.summary}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="rounded-md border bg-muted/40 p-4 text-sm leading-6">
            {answer.explanation}
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {answer.steps.map((step) => (
              <div key={step} className="rounded-md border bg-background p-3">
                <CheckCircle2 className="mb-3 h-4 w-4 text-primary" />
                <p className="text-sm leading-6">{step}</p>
              </div>
            ))}
          </div>
          <div className="rounded-md border bg-background p-4">
            <p className="text-sm font-medium">Personal note</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {answer.personalNote}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
