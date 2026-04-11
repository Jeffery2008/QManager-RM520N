import type { NetworkEventType } from "@/types/modem-status";

/** Human-readable labels for each event type */
export const EVENT_LABELS: Record<NetworkEventType, string> = {
  network_mode: "网络模式变更",
  band_change: "频段变更",
  pci_change: "小区切换",
  scc_pci_change: "辅载波频段变更",
  ca_change: "载波聚合变更",
  nr_anchor: "5G 锚点变更",
  signal_lost: "信号丢失",
  signal_restored: "信号恢复",
  internet_lost: "互联网断开",
  internet_restored: "互联网恢复",
  high_latency: "高延迟",
  latency_recovered: "延迟恢复",
  high_packet_loss: "高丢包",
  packet_loss_recovered: "丢包恢复",
  watchcat_recovery: "看门狗恢复",
  sim_failover: "SIM 切换",
  sim_swap_detected: "检测到换卡",
  airplane_mode: "飞行模式",
  profile_applied: "配置已应用",
  profile_failed: "配置应用失败",
  profile_deactivated: "配置已停用",
    tower_failover: "基站锁定故障切换",
  };

const EVENT_MESSAGE_TRANSLATORS: Array<{
  pattern: RegExp;
  translate: (match: RegExpExecArray) => string;
}> = [
  {
    pattern: /^High packet loss detected \((\d+)%\)$/,
    translate: ([, value]) => `检测到高丢包（${value}%）`,
  },
  {
    pattern: /^Packet loss recovered \((\d+)%\)$/,
    translate: ([, value]) => `丢包已恢复（${value}%）`,
  },
  {
    pattern: /^Internet connectivity lost(?: \((.+)\))?$/,
    translate: ([, detail]) =>
      detail ? `互联网连接已断开（${detail}）` : "互联网连接已断开",
  },
  {
    pattern: /^Internet connectivity restored(?: \(latency: (\d+)ms\))?$/,
    translate: ([, latency]) =>
      latency ? `互联网连接已恢复（延迟：${latency} 毫秒）` : "互联网连接已恢复",
  },
  {
    pattern: /^High latency detected \((\d+)ms, avg (\d+)ms\)$/,
    translate: ([, current, average]) =>
      `检测到高延迟（当前 ${current} 毫秒，平均 ${average} 毫秒）`,
  },
  {
    pattern: /^Latency recovered \((\d+)ms\)$/,
    translate: ([, value]) => `延迟已恢复（${value} 毫秒）`,
  },
  {
    pattern: /^Modem signal restored(?: — (.+))?$/,
    translate: ([, detail]) =>
      detail ? `调制解调器信号已恢复：${detail}` : "调制解调器信号已恢复",
  },
  {
    pattern: /^Modem became unreachable$/,
    translate: () => "调制解调器当前不可达",
  },
  {
    pattern: /^Airplane mode enabled \(CFUN=(\d+)\)$/,
    translate: ([, cfun]) => `飞行模式已启用（CFUN=${cfun}）`,
  },
  {
    pattern: /^Airplane mode disabled$/,
    translate: () => "飞行模式已关闭",
  },
  {
    pattern: /^NR PCC cell handoff on (.+) \(PCI: (\d+) -> (\d+)\)$/,
    translate: ([, band, from, to]) =>
      `NR 主小区已在 ${band} 上切换（PCI：${from} -> ${to}）`,
  },
  {
    pattern: /^NR band changed from (.+) to (.+) \(PCI: (\d+) -> (\d+)\)$/,
    translate: ([, fromBand, toBand, fromPci, toPci]) =>
      `NR 频段已从 ${fromBand} 切换到 ${toBand}（PCI：${fromPci} -> ${toPci}）`,
  },
  {
    pattern: /^LTE PCC cell handoff(?: on (.+))? \(PCI: (\d+) -> (\d+)\)$/,
    translate: ([, band, from, to]) =>
      band
        ? `LTE 主小区已在 ${band} 上切换（PCI：${from} -> ${to}）`
        : `LTE 主小区已切换（PCI：${from} -> ${to}）`,
  },
  {
    pattern: /^LTE band changed from (.+) to (.+)(?: \(PCI: (\d+) -> (\d+)\)| \(PCI (\d+)\))?$/,
    translate: ([, fromBand, toBand, fromPci, toPci, pci]) => {
      if (fromPci && toPci) {
        return `LTE 频段已从 ${fromBand} 切换到 ${toBand}（PCI：${fromPci} -> ${toPci}）`;
      }
      if (pci) {
        return `LTE 频段已从 ${fromBand} 切换到 ${toBand}（PCI ${pci}）`;
      }
      return `LTE 频段已从 ${fromBand} 切换到 ${toBand}`;
    },
  },
];

export function translateEventMessage(message: string): string {
  for (const rule of EVENT_MESSAGE_TRANSLATORS) {
    const match = rule.pattern.exec(message);
    if (match) {
      return rule.translate(match);
    }
  }

  return message;
}

/** Tab categories used by the monitoring Network Events card */
export type EventTabCategory = "bandChanges" | "dataConnection" | "networkMode";

/** Maps each NetworkEventType to its tab category */
export const EVENT_TAB_CATEGORIES: Record<NetworkEventType, EventTabCategory> =
  {
    band_change: "bandChanges",
    pci_change: "bandChanges",
    scc_pci_change: "bandChanges",
    nr_anchor: "bandChanges",
    ca_change: "bandChanges",
    network_mode: "networkMode",
    signal_lost: "networkMode",
    signal_restored: "networkMode",
    internet_lost: "dataConnection",
    internet_restored: "dataConnection",
    high_latency: "dataConnection",
    latency_recovered: "dataConnection",
    high_packet_loss: "dataConnection",
    packet_loss_recovered: "dataConnection",
    watchcat_recovery: "dataConnection",
    sim_failover: "dataConnection",
    sim_swap_detected: "dataConnection",
    airplane_mode: "networkMode",
    profile_applied: "dataConnection",
    profile_failed: "dataConnection",
    profile_deactivated: "dataConnection",
    tower_failover: "dataConnection",
  };
