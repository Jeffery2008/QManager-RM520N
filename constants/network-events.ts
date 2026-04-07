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
