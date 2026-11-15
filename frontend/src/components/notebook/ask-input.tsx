"use client";

import { ArrowUp, Square } from "lucide-react";
import { useId, useState, type KeyboardEvent } from "react";
import { MAX_QUESTION_CHARS, QUESTION_COUNTER_FROM_CHARS } from "@repo/backend/shared";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const formatCount = (n: number) => n.toLocaleString("en-US");

type AskInputProps = {
  /**
   * Why the input can't be used: no ready source yet (NB-006 R12) or every ready source excluded
   * (NB-010 R7). It's then read-only with this text as its tooltip. Null when it can be used.
   */
  disabledReason: string | null;
  /** A request is running: typing stays possible, sending doesn't, and "Stop" shows. */
  busy: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
};

/** The question box (NB-009 R12): Enter sends, Shift+Enter adds a line, a counter near the limit. */
export function AskInput({ disabledReason, busy, onSend, onStop }: AskInputProps) {
  const disabled = disabledReason !== null;
  const [value, setValue] = useState("");
  const counterId = useId();
  const tooLong = value.length > MAX_QUESTION_CHARS;
  const canSend = !disabled && !busy && !tooLong && value.trim().length > 0;
  const showCounter = value.length >= QUESTION_COUNTER_FROM_CHARS;

  const send = () => {
    if (!canSend) return;
    onSend(value.trim());
    setValue("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    send();
  };

  const textarea = (
    <Textarea
      aria-label="Ask about your sources"
      placeholder="Ask about your sources…"
      rows={1}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={onKeyDown}
      aria-disabled={disabled || undefined}
      readOnly={disabled}
      aria-invalid={tooLong || undefined}
      aria-describedby={showCounter ? counterId : undefined}
      className="max-h-48 min-h-10 resize-none pr-12 aria-disabled:cursor-not-allowed"
    />
  );

  return (
    <form
      className="relative"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      {disabled ? (
        <Tooltip>
          {/* Read-only and aria-disabled: it stays focusable for the tooltip. */}
          <TooltipTrigger asChild>{textarea}</TooltipTrigger>
          <TooltipContent>{disabledReason}</TooltipContent>
        </Tooltip>
      ) : (
        textarea
      )}

      <div className="absolute right-1.5 bottom-1.5">
        {busy ? (
          <Button type="button" size="icon-sm" variant="outline" onClick={onStop} aria-label="Stop">
            <Square aria-hidden />
          </Button>
        ) : (
          <Button type="submit" size="icon-sm" disabled={!canSend} aria-label="Send question">
            <ArrowUp aria-hidden />
          </Button>
        )}
      </div>

      {showCounter && (
        <p id={counterId} className={`mt-1 text-right text-xs ${tooLong ? "text-danger" : "text-graphite"}`}>
          {formatCount(value.length)} / {formatCount(MAX_QUESTION_CHARS)}
        </p>
      )}
    </form>
  );
}
