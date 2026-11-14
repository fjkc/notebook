"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { logIn, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(logIn, initialState);

  return (
    <form action={formAction} className="flex w-full flex-col gap-2">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="password" className="text-sm font-medium">
        Password
      </label>
      <Input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        autoFocus
        aria-invalid={state.error ? true : undefined}
        aria-describedby={state.error ? "login-error" : undefined}
      />
      {state.error && (
        <p id="login-error" role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="mt-1 w-full">
        {pending ? "Opening…" : "Open the app"}
      </Button>
    </form>
  );
}
