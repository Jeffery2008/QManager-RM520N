"use client";

import React, { useState } from "react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";

import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, EyeIcon, EyeOffIcon, SendIcon, AlertCircle, RefreshCcwIcon, PackageIcon, Trash2Icon } from "lucide-react";
import { SaveButton, useSaveFlash } from "@/components/ui/save-button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { CopyableCommand } from "@/components/ui/copyable-command";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import {
  useEmailAlerts,
  type EmailAlertsSavePayload,
  type EmailAlertsSettings,
} from "@/hooks/use-email-alerts";

// =============================================================================
// EmailAlertsSettingsCard — Toggle + Configuration Form
// =============================================================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface EmailAlertsSettingsCardProps {
  onTestEmailSent?: () => void;
}

const EmailAlertsSettingsCard = ({ onTestEmailSent }: EmailAlertsSettingsCardProps) => {
  const {
    settings,
    msmtpInstalled,
    isLoading,
    isSaving,
    isSendingTest,
    isUninstalling,
    installResult,
    error,
    saveSettings,
    sendTestEmail,
    uninstall,
    runInstall,
    refresh,
  } = useEmailAlerts();

  // --- Local form state (synced from server data during render) --------------
  const { saved, markSaved } = useSaveFlash();
  const [prevSettings, setPrevSettings] = useState<EmailAlertsSettings | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const [senderEmail, setSenderEmail] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [appPassword, setAppPassword] = useState(""); // never pre-filled
  const [thresholdMinutes, setThresholdMinutes] = useState("5");
  const [showPassword, setShowPassword] = useState(false);

  // Adjust state during render when server data changes (React-recommended pattern)
  if (settings && settings !== prevSettings) {
    setPrevSettings(settings);
    setIsEnabled(settings.enabled);
    setSenderEmail(settings.sender_email);
    setRecipientEmail(settings.recipient_email);
    setAppPassword(settings.app_password);
    setThresholdMinutes(String(settings.threshold_minutes));
  }

  // --- Validation ------------------------------------------------------------
  const senderEmailError =
    senderEmail && !EMAIL_REGEX.test(senderEmail)
      ? "请输入有效的电子邮箱地址"
      : null;

  const recipientEmailError =
    recipientEmail && !EMAIL_REGEX.test(recipientEmail)
      ? "请输入有效的电子邮箱地址"
      : null;

  const thresholdError =
    thresholdMinutes &&
    (isNaN(Number(thresholdMinutes)) ||
      Number(thresholdMinutes) < 1 ||
      Number(thresholdMinutes) > 60)
      ? "时长必须在 1–60 分钟之间"
      : null;

  const hasValidationErrors = !!(
    senderEmailError ||
    recipientEmailError ||
    thresholdError
  );

  // --- Dirty check -----------------------------------------------------------
  const isDirty = settings
    ? isEnabled !== settings.enabled ||
      senderEmail !== settings.sender_email ||
      recipientEmail !== settings.recipient_email ||
      thresholdMinutes !== String(settings.threshold_minutes) ||
      appPassword !== settings.app_password
    : false;

  const canSave = !hasValidationErrors && isDirty && !isSaving && !isSendingTest;

  // --- Handlers --------------------------------------------------------------
  const handleToggle = (checked: boolean) => {
    setIsEnabled(checked);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;

    const payload: EmailAlertsSavePayload = {
      action: "save_settings",
      enabled: isEnabled,
      sender_email: senderEmail,
      recipient_email: recipientEmail,
      threshold_minutes: parseInt(thresholdMinutes, 10),
    };

    // Only include password if it changed from the saved value
    if (appPassword !== (settings?.app_password ?? "")) {
      payload.app_password = appPassword;
    }

    const success = await saveSettings(payload);
    if (success) {
      markSaved();
      toast.success("邮件告警设置已保存");
    } else {
      toast.error(error || "保存邮件告警设置失败");
    }
  };

  const handleSendTest = async () => {
    const success = await sendTestEmail();
    if (success) {
      toast.success("测试邮件发送成功");
    } else {
      toast.error("发送测试邮件失败，请检查配置");
    }
    // Refresh log on both success and failure — backend logs both outcomes
    onTestEmailSent?.();
  };

  // Test button enabled only when fully configured and saved
  const canSendTest =
    settings?.enabled &&
    !!settings?.app_password &&
    EMAIL_REGEX.test(senderEmail) &&
    EMAIL_REGEX.test(recipientEmail) &&
    !isSaving &&
    !isSendingTest;

  // --- Loading skeleton ------------------------------------------------------
  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>邮件告警设置</CardTitle>
          <CardDescription>
            通过 Gmail SMTP 和应用专用密码发送邮件。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-10 w-full max-w-sm" />
            <Skeleton className="h-10 w-full max-w-sm" />
            <Skeleton className="h-10 w-full max-w-sm" />
            <Skeleton className="h-10 w-full max-w-sm" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-9 w-32" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // --- Error state (initial fetch failed) ------------------------------------
  if (!isLoading && error && !settings) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>邮件告警设置</CardTitle>
          <CardDescription>
            通过 Gmail SMTP 和应用专用密码发送邮件。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>加载设置失败</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span>{error}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refresh()}
              >
                <RefreshCcwIcon className="size-3.5" />
                重试
              </Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // --- Not installed state — msmtp missing -----------------------------------
  if (!msmtpInstalled) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>邮件告警设置</CardTitle>
          <CardDescription>
            通过 Gmail SMTP 和应用专用密码发送邮件。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 gap-4">
            <PackageIcon className="size-10 text-muted-foreground" />
            <div className="text-center space-y-1.5">
              <p className="text-sm font-medium">
                此设备尚未安装 <code>msmtp</code>。
              </p>
              <p className="text-xs text-muted-foreground">
                可自动安装，也可手动执行命令安装。
              </p>
            </div>

            {installResult.status === "complete" && (
              <Alert className="border-success/30 bg-success/5">
                <AlertCircle className="text-success" />
                <AlertDescription className="text-success">
                  <p>{installResult.message}</p>
                </AlertDescription>
              </Alert>
            )}

            {installResult.status === "error" && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <p>
                    {installResult.message}
                    {installResult.detail && (
                      <span className="block text-xs mt-1 opacity-80">
                        {installResult.detail}
                      </span>
                    )}
                  </p>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex items-center gap-2">
              <Button
                onClick={runInstall}
                disabled={installResult.status === "running"}
              >
                {installResult.status === "running" ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {installResult.message || "安装中..."}
                  </>
                ) : (
                  <>
                    <PackageIcon className="size-4" />
                    安装 msmtp
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refresh()}
                disabled={installResult.status === "running"}
              >
                <RefreshCcwIcon className="size-3.5" />
                重新检查
              </Button>
            </div>

            <div className="w-full flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              <span>或手动安装</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <CopyableCommand command="opkg update && opkg install msmtp" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // --- Render ----------------------------------------------------------------
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>邮件告警设置</CardTitle>
        <CardDescription>
          通过 Gmail SMTP 和应用专用密码发送邮件。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={handleSave}>
          <FieldSet>
            <FieldGroup>
              {/* Enable toggle */}
              <Field orientation="horizontal" className="w-fit">
                <FieldLabel htmlFor="email-alerts-enabled">
                  启用邮件告警
                </FieldLabel>
                <Switch
                  id="email-alerts-enabled"
                  checked={isEnabled}
                  onCheckedChange={handleToggle}
                />
              </Field>

              {/* Sender email */}
              <Field>
                <FieldLabel htmlFor="sender-email">发件邮箱</FieldLabel>
                <Input
                  id="sender-email"
                  type="email"
                  placeholder="alerts@gmail.com"
                  className="max-w-sm"
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  disabled={!isEnabled}
                  required={isEnabled}
                  aria-invalid={!!senderEmailError}
                  aria-describedby={
                    senderEmailError ? "sender-email-error" : "sender-email-desc"
                  }
                  autoComplete="email"
                />
                {senderEmailError ? (
                  <FieldError id="sender-email-error">
                    {senderEmailError}
                  </FieldError>
                ) : (
                  <FieldDescription id="sender-email-desc">
                    用于发送告警的 Gmail 账号。
                  </FieldDescription>
                )}
              </Field>

              {/* Recipient email */}
              <Field>
                <FieldLabel htmlFor="recipient-email">
                  收件邮箱
                </FieldLabel>
                <Input
                  id="recipient-email"
                  type="email"
                  placeholder="you@example.com"
                  className="max-w-sm"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  disabled={!isEnabled}
                  required={isEnabled}
                  aria-invalid={!!recipientEmailError}
                  aria-describedby={
                    recipientEmailError
                      ? "recipient-email-error"
                      : "recipient-email-desc"
                  }
                  autoComplete="email"
                />
                {recipientEmailError ? (
                  <FieldError id="recipient-email-error">
                    {recipientEmailError}
                  </FieldError>
                ) : (
                  <FieldDescription id="recipient-email-desc">
                    告警邮件将发送到这个地址。
                  </FieldDescription>
                )}
              </Field>

              {/* Gmail App Password */}
              <Field>
                <FieldLabel htmlFor="app-password">
                  Gmail 应用专用密码
                </FieldLabel>
                <div className="relative max-w-sm">
                  <Input
                    id="app-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="xxxx xxxx xxxx xxxx"
                    className="pr-10"
                    value={appPassword}
                    onChange={(e) => setAppPassword(e.target.value)}
                    disabled={!isEnabled}
                    required={isEnabled}
                    autoComplete="new-password"
                    aria-describedby="app-password-desc"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "隐藏密码" : "显示密码"}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? (
                      <EyeOffIcon className="size-4" />
                    ) : (
                      <EyeIcon className="size-4" />
                    )}
                  </button>
                </div>
                <FieldDescription id="app-password-desc">
                  在 Google 账号中生成{" "}
                  <a
                    href="https://myaccount.google.com/apppasswords"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-info underline underline-offset-2 hover:text-info/80"
                  >
                    应用专用密码
                  </a>{" "}
                  以供此处使用。
                </FieldDescription>
              </Field>

              {/* Threshold duration */}
              <Field>
                <FieldLabel htmlFor="threshold-minutes">
                  告警触发时间（分钟）
                </FieldLabel>
                <Input
                  id="threshold-minutes"
                  type="number"
                  min="1"
                  max="60"
                  placeholder="5"
                  className="max-w-sm"
                  value={thresholdMinutes}
                  onChange={(e) => setThresholdMinutes(e.target.value)}
                  disabled={!isEnabled}
                  required={isEnabled}
                  aria-invalid={!!thresholdError}
                  aria-describedby={
                    thresholdError ? "threshold-error" : "threshold-desc"
                  }
                />
                {thresholdError ? (
                  <FieldError id="threshold-error">{thresholdError}</FieldError>
                ) : (
                  <FieldDescription id="threshold-desc">
                    连接中断持续多久后才发送告警，可避免因短暂抖动而误报。
                  </FieldDescription>
                )}
              </Field>

              {/* Action buttons */}
              <div className="grid gap-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <SaveButton
                    type="submit"
                    isSaving={isSaving}
                    saved={saved}
                    disabled={!canSave}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-fit"
                    disabled={!canSendTest}
                    onClick={handleSendTest}
                  >
                    {isSendingTest ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        发送中…
                      </>
                    ) : (
                      <>
                        <SendIcon className="size-4" />
                        发送测试邮件
                      </>
                    )}
                  </Button>
                </div>
                {isDirty && !canSendTest && isEnabled && (
                  <p className="text-xs text-muted-foreground">
                    请先保存更改，再发送测试邮件。
                  </p>
                )}
              </div>
            </FieldGroup>
          </FieldSet>
        </form>

        {msmtpInstalled && !isEnabled && (
          <>
            <Separator className="mt-4" />
            <div className="flex items-center justify-between pt-4">
              <div>
                <p className="text-sm font-medium">移除 msmtp</p>
                <p className="text-xs text-muted-foreground">
                  从此设备中卸载 msmtp 软件包。
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={isUninstalling}
                  >
                    {isUninstalling ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        移除中…
                      </>
                    ) : (
                      <>
                        <Trash2Icon className="size-4" />
                        卸载
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Uninstall msmtp?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove the msmtp package from this device. Your
                      email alert settings will be preserved, but alerts will
                      not be sent until msmtp is reinstalled.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={async () => {
                        const success = await uninstall();
                        if (success) {
                          toast.success("msmtp uninstalled");
                          refresh();
                        } else {
                          toast.error(
                            error || "Failed to uninstall msmtp",
                          );
                        }
                      }}
                    >
                      Uninstall
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default EmailAlertsSettingsCard;
