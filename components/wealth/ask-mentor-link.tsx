"use client";

import { MessageCircleQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MentorLaunchRequest } from "@/lib/mentor-chat";

export function AskMentorLink({
  className,
  contextLabel,
  contextNote,
  label = "Ask AI mentor",
  mentorPrompt,
  mentorQuestionId,
  onOpenMentor,
  returnState,
  sourceLabel,
}: {
  className?: string;
  contextLabel?: string;
  contextNote?: string;
  label?: string;
  mentorPrompt: string;
  mentorQuestionId: MentorLaunchRequest["questionId"];
  onOpenMentor: (request: MentorLaunchRequest) => void;
  returnState?: MentorLaunchRequest["returnState"];
  sourceLabel?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      onClick={() =>
        onOpenMentor({
          contextLabel: contextLabel ?? label,
          contextNote:
            contextNote ??
            (sourceLabel
              ? `Opened from ${sourceLabel}. Carry this page context into the conversation.`
              : undefined),
          prompt: mentorPrompt,
          questionId: mentorQuestionId,
          returnState,
          sourceLabel,
        })
      }
    >
      <MessageCircleQuestion className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}
