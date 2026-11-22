"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "./button";
import type { FormState } from "@/src/features/account/auth-actions";
export function Submit({
  children,
  variant = "primary",
  disabled = false,
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "outline";
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button variant={variant} type="submit" disabled={pending || disabled}>
      {pending ? "Zapisywanie…" : children}
    </Button>
  );
}
export function ActionForm({
  action,
  children,
  submit = "Zapisz",
  className = "form-stack",
  variant,
}: {
  action: (state: FormState, data: FormData) => Promise<FormState>;
  children?: React.ReactNode;
  submit?: string;
  className?: string;
  variant?: "primary" | "secondary" | "outline";
}) {
  const [state, submitAction] = useActionState(action, {});
  return (
    <form action={submitAction} className={className}>
      {children}
      {state.error && (
        <p className="alert alert-error" role="alert">
          {state.error}
        </p>
      )}
      {state.message && (
        <p className="alert alert-success" role="status">
          {state.message}
        </p>
      )}
      <Submit variant={variant}>{submit}</Submit>
    </form>
  );
}
