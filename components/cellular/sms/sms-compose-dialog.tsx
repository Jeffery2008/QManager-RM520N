"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

// =============================================================================
// SmsComposeDialog — Dialog for composing and sending SMS messages
// =============================================================================

interface SmsComposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (phone: string, message: string) => Promise<boolean>;
  isSaving: boolean;
}

export default function SmsComposeDialog({
  open,
  onOpenChange,
  onSend,
  isSaving,
}: SmsComposeDialogProps) {
  const [phone, setPhone] = React.useState("");
  const [message, setMessage] = React.useState("");

  // Character count and encoding detection
  const isUcs2 = /[^\x00-\x7F]/.test(message);
  const maxChars = isUcs2 ? 70 : 160;
  const charCount = message.length;
  const isOverLimit = charCount > maxChars;

  const isValid = phone.trim().length > 0 && message.trim().length > 0;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValid) return;

    const success = await onSend(phone.trim(), message);
    if (success) {
      toast.success("短信发送成功");
      setPhone("");
      setMessage("");
      onOpenChange(false);
    } else {
      toast.error("发送短信失败");
    }
  };

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      setPhone("");
      setMessage("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>新短信</DialogTitle>
          <DialogDescription>
            编写并发送短信。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSend} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sms-phone">电话号码</Label>
            <Input
              id="sms-phone"
              type="tel"
              placeholder="+1234567890"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={isSaving}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="sms-message">短信内容</Label>
              <span
                className={`text-xs ${
                  isOverLimit
                    ? "text-destructive font-medium"
                    : charCount > maxChars * 0.9
                      ? "text-warning"
                      : "text-muted-foreground"
                }`}
              >
                {charCount}/{maxChars}
                {isUcs2 && "（Unicode）"}
              </span>
            </div>
            <Textarea
              id="sms-message"
              placeholder="输入短信内容..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={isSaving}
              rows={4}
              className="resize-none"
            />
            {isOverLimit && (
              <p className="text-xs text-destructive">
                内容超出单条短信长度限制，将分段发送。
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              取消
            </Button>
            <Button type="submit" disabled={isSaving || !isValid}>
              {isSaving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  发送中…
                </>
              ) : (
                "发送"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
