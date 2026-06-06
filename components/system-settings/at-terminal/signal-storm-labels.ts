// ─── Signal Storm — label bundle ─────────────────────────────────────────────
// Pure TS. The engine reads these at draw time. RM520N has no i18n setup, so
// strings are hard-coded here because the app has no i18n setup.
// Shape preserved so the engine/boss modules can consume `GameLabels` unchanged.

export interface GameLabels {
  hud: {
    score: string;
    best: string;
    wave: string;
  };
  power_ups: {
    /** Prefix only. Suffix " Ns" is concatenated by the engine. */
    rapid_fire: string;
    /** Prefix only. Suffix " Ns" is concatenated by the engine. */
    spread: string;
    shield: string;
  };
  pause: {
    title: string;
    resume_hint: string;
  };
  game_over: {
    title: string;
    score_label: string;
    new_high_score: string;
    /** Prefix only. Suffix " N" is concatenated by the engine. */
    best_prefix: string;
    controls_hint: string;
  };
  boss_defeated: string;
  muted: string;
  boss_names: Record<1 | 2 | 3 | 4 | 5, string>;
  boss_subtitles: Record<1 | 2 | 3 | 4 | 5, string>;
}

export const GAME_LABELS: GameLabels = {
  hud: {
    score: "分数",
    best: "最佳",
    wave: "波次",
  },
  power_ups: {
    rapid_fire: "快速射击",
    spread: "散射",
    shield: "护盾",
  },
  pause: {
    title: "已暂停",
    resume_hint: "按 P 继续",
  },
  game_over: {
    title: "游戏结束",
    score_label: "最终得分",
    new_high_score: "新纪录！",
    best_prefix: "最佳",
    controls_hint: "按 R 重试  ·  Esc 退出",
  },
  boss_defeated: "Boss 已击败！",
  muted: "已静音",
  boss_names: {
    1: "干扰者",
    2: "破坏者",
    3: "拦截者",
    4: "破袭者",
    5: "主宰者",
  },
  boss_subtitles: {
    1: "第 1 阶段 — 信号噪声",
    2: "第 2 阶段 — 频率劫持者",
    3: "第 3 阶段 — 频谱杀手",
    4: "第 4 阶段 — 相位反转器",
    5: "第 5 阶段 — 最终风暴",
  },
};
