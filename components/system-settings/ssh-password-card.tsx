"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { EyeIcon, EyeOffIcon, TerminalIcon } from "lucide-react";
import { changeSSHPassword } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export default function SSHPasswordCard() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reset = useCallback(() => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setError("");
  }, []);

  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= 6 &&
    confirmPassword.length > 0 &&
    !isSubmitting;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");

      if (newPassword.length < 6) {
        setError("SSH 密码至少需要 6 个字符。");
        return;
      }

      if (newPassword !== confirmPassword) {
        setError("两次输入的密码不一致。");
        return;
      }

      setIsSubmitting(true);
      try {
        const result = await changeSSHPassword(
          currentPassword,
          newPassword,
          confirmPassword
        );
        if (result.success) {
          toast.success("SSH 密码更新成功。");
          reset();
        } else {
          setError(result.error || "SSH 密码修改失败。");
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [currentPassword, newPassword, confirmPassword, reset]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>SSH 密码</CardTitle>
        <CardDescription>
          设置用于通过 SSH 访问调制解调器的 root 密码。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          <Field>
            <FieldLabel htmlFor="ssh-current-password">
              当前 Web UI 密码
            </FieldLabel>
            <div className="relative">
              <Input
                id="ssh-current-password"
                type={showCurrentPassword ? "text" : "password"}
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                disabled={isSubmitting}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowCurrentPassword((v) => !v)}
                tabIndex={-1}
                aria-label={
                  showCurrentPassword ? "隐藏密码" : "显示密码"
                }
              >
                {showCurrentPassword ? (
                  <EyeOffIcon className="size-4" />
                ) : (
                  <EyeIcon className="size-4" />
                )}
              </Button>
            </div>
          </Field>

          <Field>
            <FieldLabel htmlFor="ssh-new-password">
              New SSH 密码
            </FieldLabel>
            <div className="relative">
              <Input
                id="ssh-new-password"
                type={showNewPassword ? "text" : "password"}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                disabled={isSubmitting}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowNewPassword((v) => !v)}
                tabIndex={-1}
                aria-label={
                  showNewPassword ? "隐藏密码" : "显示密码"
                }
              >
                {showNewPassword ? (
                  <EyeOffIcon className="size-4" />
                ) : (
                  <EyeIcon className="size-4" />
                )}
              </Button>
            </div>
          </Field>

          <Field>
            <FieldLabel htmlFor="ssh-confirm-password">
              Confirm SSH 密码
            </FieldLabel>
            <div className="relative">
              <Input
                id="ssh-confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isSubmitting}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowConfirmPassword((v) => !v)}
                tabIndex={-1}
                aria-label={
                  showConfirmPassword ? "隐藏密码" : "显示密码"
                }
              >
                {showConfirmPassword ? (
                  <EyeOffIcon className="size-4" />
                ) : (
                  <EyeIcon className="size-4" />
                )}
              </Button>
            </div>
          </Field>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" disabled={!canSubmit} className="w-full">
            {isSubmitting ? (
              <>
                <Spinner className="mr-2" />
                更新中...
              </>
            ) : (
              "Update SSH 密码"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
