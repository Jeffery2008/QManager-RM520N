"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { useLogin } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export default function LoginComponent() {
  const { status, login } = useLogin();

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [retryAfter, setRetryAfter] = useState(0);

  // Redirect to dedicated onboarding wizard when this is a fresh install
  useEffect(() => {
    if (status === "setup_required") {
      window.location.href = "/setup/";
    }
  }, [status]);

  // Rate limit countdown timer
  useEffect(() => {
    if (retryAfter <= 0) return;

    const id = setInterval(() => {
      setRetryAfter((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    return () => clearInterval(id);
  }, [retryAfter]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setIsSubmitting(true);

      try {
        const result = await login(password);
        if (!result.success) {
          if (result.retry_after) {
            setRetryAfter(result.retry_after);
            setError(
              `Too many failed attempts. Try again in ${result.retry_after} seconds.`
            );
          } else {
            setError(result.error || "Invalid password.");
          }
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [password, login]
  );

  // Show spinner while detecting setup status or during redirect to /setup/
  if (status === "loading" || status === "setup_required") {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <Spinner className="size-6" />
      </div>
    );
  }

  return (
    <motion.div
      className="flex flex-col gap-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex size-16 p-1 items-center justify-center rounded-md">
              <img
                src="/qmanager-logo.svg"
                alt="QManager Logo"
                className="size-full"
              />
            </div>
            <h1 className="text-xl font-bold">Welcome to QManager</h1>
            <FieldDescription>
              Enter your QManager password to continue.
            </FieldDescription>
          </div>

          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </Field>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <Field>
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || retryAfter > 0}
            >
              {isSubmitting ? (
                <>
                  <Spinner className="mr-2" />
                  Logging in...
                </>
              ) : retryAfter > 0 ? (
                `Locked (${retryAfter}s)`
              ) : (
                "Login"
              )}
            </Button>
          </Field>
        </FieldGroup>
      </form>
      <FieldDescription className="px-6 text-center">
        QManager — Quectel Modem Management
      </FieldDescription>
    </motion.div>
  );
}
