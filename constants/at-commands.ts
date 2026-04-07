/** A named AT command preset shown in the Commands popover. */
export interface ATCommandPreset {
  label: string;
  command: string;
}

/**
 * Default AT command presets loaded from the original `/etc/config/atcommands.user`.
 * Covers modem control (CFUN), network mode (QNWPREFCFG), SIM slots (QUIMSLOT),
 * APN management (CGDCONT), band queries, and IP passthrough (QMAP).
 */
export const DEFAULT_AT_COMMANDS: ATCommandPreset[] = [
  { label: "重启", command: "AT+CFUN=1,1" },
  { label: "断开连接", command: "AT+CFUN=0" },
  { label: "连接网络", command: "AT+CFUN=1" },
  { label: "信号信息", command: 'AT+QENG="servingcell"' },
  { label: "载波聚合信息", command: "AT+QCAINFO" },
  { label: "获取当前 SIM 卡槽", command: "AT+QUIMSLOT?" },
  { label: "切换到 SIM 卡槽 1", command: "AT+QUIMSLOT=1" },
  { label: "切换到 SIM 卡槽 2", command: "AT+QUIMSLOT=2" },
  { label: "获取当前 APN 列表", command: "AT+CGDCONT?" },
  { label: "将 APN 设为 NRBROADBAND", command: 'AT+CGDCONT=1,"IPV4V6","NRBROADBAND"' },
  { label: "显示当前 IMEI", command: "AT+EGMR=0,7" },
  { label: "显示当前网络模式", command: 'AT+QNWPREFCFG="mode_pref"' },
  { label: "Set Network Mode to AUTO", command: 'AT+QNWPREFCFG="mode_pref",AUTO' },
  { label: "Set Network Mode to 5G NR/4G LTE Only", command: 'AT+QNWPREFCFG="mode_pref",NR5G:LTE' },
  { label: "Set Network Mode to 5G NR Only", command: 'AT+QNWPREFCFG="mode_pref",NR5G' },
  { label: "Set Network Mode to 4G LTE Only", command: 'AT+QNWPREFCFG="mode_pref",LTE' },
  { label: "Check SA/NSA disable status", command: 'AT+QNWPREFCFG="nr5g_disable_mode"' },
  { label: "Enable Both SA and NSA", command: 'AT+QNWPREFCFG="nr5g_disable_mode",0' },
  { label: "Disable SA Only", command: 'AT+QNWPREFCFG="nr5g_disable_mode",1' },
  { label: "Disable NSA Only", command: 'AT+QNWPREFCFG="nr5g_disable_mode",2' },
  { label: "Get 已启用 5G NR SA Bands", command: 'AT+QNWPREFCFG="nr5g_band"' },
  { label: "Get 已启用 5G NR NSA Bands", command: 'AT+QNWPREFCFG="nsa_nr5g_band"' },
  { label: "Get 已启用 4G LTE Bands", command: 'AT+QNWPREFCFG="lte_band"' },
  { label: "View assigned IP addresses", command: 'AT+QMAP="WWAN"' },
  { label: "Enable IPPT (MAC passthrough)", command: 'AT+QMAP="MPDN_rule",0,1,0,1,1,"FF:FF:FF:FF:FF:FF"' },
  { label: "Disable IPPT", command: 'AT+QMAP="MPDN_rule",0' },
];
