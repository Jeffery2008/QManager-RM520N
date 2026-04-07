"use client";

import { motion } from "motion/react";

// =============================================================================
// StepWelcome — Onboarding step 1: brand intro, staggered entrance
// =============================================================================

const STAGGER = 0.09;
const EASE = [0.25, 1, 0.5, 1] as const;

function fadeUp(i: number) {
  return {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.38, delay: i * STAGGER, ease: EASE },
  };
}

export function StepWelcome() {
  return (
    <div className="flex flex-col gap-7">
      {/* Brand lockup */}
      <motion.div {...fadeUp(0)} className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 p-1.5">
          <img
            src="/qmanager-logo.svg"
            alt=""
            aria-hidden="true"
            className="size-full"
          />
        </div>
        <span className="text-sm font-semibold tracking-tight text-muted-foreground">
          QManager
        </span>
      </motion.div>

      {/* Main message */}
      <motion.div {...fadeUp(1)} className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight leading-tight">
          让你的调制解调器，<br />从一开始就更好用。
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          只需几个步骤即可完成初始化。只有密码是必填项，
          其他内容都可以跳过，并且后续随时都能修改。
        </p>
      </motion.div>

      {/* Step preview */}
      <motion.div
        {...fadeUp(2)}
        className="flex flex-col gap-1.5 border-l-2 border-border pl-4"
      >
        <StepPreviewItem label="密码" required />
        <StepPreviewItem label="网络模式" />
        <StepPreviewItem label="APN 或 SIM 配置" />
        <StepPreviewItem label="频段偏好" />
      </motion.div>
    </div>
  );
}

function StepPreviewItem({
  label,
  required,
}: {
  label: string;
  required?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="size-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
      <span>{label}</span>
      {required && (
        <span className="text-xs font-medium text-foreground">必填</span>
      )}
    </div>
  );
}
