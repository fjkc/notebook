"use client";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type SuggestedQuestionsProps = {
  questions: readonly string[];
  /** Why they can't be sent right now (every ready source excluded), or null. */
  disabledReason: string | null;
  onPick: (question: string) => void;
};

/** Up to 5 suggested questions in the empty chat (NB-010 R6); pressing one sends it like the input. */
export function SuggestedQuestions({ questions, disabledReason, onPick }: SuggestedQuestionsProps) {
  if (questions.length === 0) return null;
  return (
    <ul aria-label="Suggested questions" className="mt-6 flex flex-col items-start gap-2">
      {questions.map((question) => {
        const button = (
          <Button
            type="button"
            variant="outline"
            aria-disabled={disabledReason ? true : undefined}
            onClick={() => !disabledReason && onPick(question)}
            className="h-auto max-w-full justify-start rounded-[4px] py-2 text-left font-normal whitespace-normal"
          >
            {question}
          </Button>
        );
        return (
          <li key={question} className="max-w-full">
            {disabledReason ? (
              <Tooltip>
                <TooltipTrigger asChild>{button}</TooltipTrigger>
                <TooltipContent>{disabledReason}</TooltipContent>
              </Tooltip>
            ) : (
              button
            )}
          </li>
        );
      })}
    </ul>
  );
}
