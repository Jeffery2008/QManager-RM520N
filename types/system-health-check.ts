// types/system-health-check.ts
// Shared types for the System Health Check feature.

export type TestStatus = "pending" | "running" | "pass" | "fail" | "warn" | "skip";

export type JobStatus = "running" | "complete" | "complete_no_bundle" | "error";

export type TestCategory =
  | "binaries"
  | "permissions"
  | "at_transport"
  | "sms"
  | "sudoers"
  | "services"
  | "network"
  | "configuration";

export interface HealthCheckTest {
  id: string;
  category: TestCategory;
  label: string;
  status: TestStatus;
  duration_ms: number;
  detail: string;
}

export interface HealthCheckSummary {
  pass: number;
  fail: number;
  warn: number;
  skip: number;
  total: number;
}

export interface HealthCheckJob {
  job_id: string;
  status: JobStatus;
  started_at: number;
  finished_at: number | null;
  pid: number;
  summary: HealthCheckSummary;
  tests: HealthCheckTest[];
  tarball_path: string | null;
  tarball_size: number | null;
  error: string | null;
}

export interface RunResponse {
  success: boolean;
  job_id?: string;
  started_at?: number;
  error?: string;
  detail?: string;
}

export interface TestOutputResponse {
  success: boolean;
  test_id?: string;
  output?: string;
  truncated?: boolean;
  error?: string;
}

export const CATEGORY_LABELS: Record<TestCategory, string> = {
  binaries: "二进制与版本",
  permissions: "文件系统与权限",
  at_transport: "AT 通信",
  sms: "短信子系统",
  sudoers: "Sudoers 权限",
  services: "Systemd 服务",
  network: "网络",
  configuration: "配置",
};

export const CATEGORY_DESCRIPTIONS: Record<TestCategory, string> = {
  binaries: "检查必需二进制文件和版本",
  permissions: "检查文件所有权、权限模式和用户组成员",
  at_transport: "通过 qcmd / atcli_smd11 对调制解调器执行往返检查",
  sms: "检查 sms_tool 可用性和 SIM 卡状态",
  sudoers: "检查 www-data 可见的 sudoers 辅助命令",
  services: "检查 systemd 单元是否存在、启用以及正在运行",
  network: "检查 DNS、IPv4、调制解调器数据路径、lighttpd 和防火墙",
  configuration: "检查 QManager 配置文件和轮询缓存新鲜度",
};
