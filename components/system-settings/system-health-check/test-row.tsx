"use client";

import { useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import HealthStatusBadge from "./health-status-badge";
import type { HealthCheckTest } from "@/types/system-health-check";
import { cn } from "@/lib/utils";

interface TestRowProps {
  test: HealthCheckTest;
  fetchOutput: (testId: string) => Promise<string>;
}

const TEST_LABELS_ZH: Record<string, string> = {
  "bin.atcli": "atcli_smd11 二进制文件存在",
  "bin.sms_tool": "sms_tool 二进制文件存在",
  "bin.qcmd": "qcmd 包装脚本存在",
  "bin.jq": "jq 存在",
  "bin.curl": "curl 存在",
  "bin.openssl": "openssl 存在",
  "bin.speedtest": "speedtest CLI",
  "bin.tailscale": "tailscale 二进制文件",
  "bin.msmtp": "msmtp 二进制文件",
  "bin.ttyd": "ttyd 二进制文件",
  "perm.smd11": "/dev/smd11 权限为 660 root:dialout",
  "perm.www_dialout": "www-data 属于 dialout 组",
  "perm.qmanager_dir": "/usrdata/qmanager 可遍历",
  "perm.rootfs_state": "rootfs 默认只读",
  "perm.tmp_writable": "/tmp 可由 www-data 写入",
  "at.echo": "AT 回显（qcmd \"AT\"）",
  "at.cgmi": "AT+CGMI 返回制造商",
  "at.cgmm": "AT+CGMM 返回型号",
  "at.cgsn": "AT+CGSN 返回 IMEI",
  "at.cfun": "AT+CFUN? 无线状态",
  "at.lock_serial": "qcmd 可串行化连续请求",
  "sms.recv_listing": "sms_tool -j recv 返回有效 JSON",
  "sms.flock": "共享 AT 锁 flock 正常",
  "sms.cpin": "AT+CPIN? 返回 READY",
  "sudo.list": "sudo -n -l 可列出 qmanager 辅助命令",
  "svc.firewall": "qmanager-firewall.service",
  "svc.poller": "qmanager-poller.service",
  "svc.console": "qmanager-console.service",
  "svc.setup": "qmanager-setup.service",
  "svc.lighttpd": "lighttpd.service",
  "svc.tailscaled": "tailscaled.service（可选）",
  "net.dns": "DNS 可解析 install.speedtest.net",
  "net.ping": "IPv4 可达性（1.1.1.1）",
  "net.rmnet": "rmnet+ 已获取 IP",
  "net.lighttpd_listen": "lighttpd 正在监听 80/443",
  "net.firewall_rules": "iptables INPUT 规则已加载",
  "cfg.qmanager_dir": "/etc/qmanager 存在",
  "cfg.sms_alerts_json": "sms_alerts.json 有效",
  "cfg.email_alerts_json": "email_alerts.json 有效",
  "cfg.poller_cache_fresh": "轮询缓存 mtime 小于 60 秒",
  "cfg.cgi_path_opt": "lighttpd CGI PATH 包含 /opt/bin",
};

export default function TestRow({ test, fetchOutput }: TestRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expandable = test.status === "fail" || test.status === "warn";

  const toggle = async () => {
    if (!expandable) return;
    const next = !expanded;
    setExpanded(next);
    if (next && output === null) {
      setLoading(true);
      setError(null);
      try {
        const body = await fetchOutput(test.id);
        setOutput(body || "（未捕获输出）");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="border-b last:border-b-0">
      <button
        type="button"
        onClick={toggle}
        disabled={!expandable}
        className={cn(
          "flex w-full items-center justify-between gap-3 py-2 px-1 text-left",
          expandable ? "cursor-pointer hover:bg-muted/40" : "cursor-default",
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          {expandable ? (
            expanded
              ? <ChevronDownIcon className="size-4 text-muted-foreground shrink-0" />
              : <ChevronRightIcon className="size-4 text-muted-foreground shrink-0" />
          ) : (
            <span className="size-4 shrink-0" aria-hidden />
          )}
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">
              {TEST_LABELS_ZH[test.id] ?? test.label}
            </div>
            {test.detail && (
              <div className="text-xs text-muted-foreground truncate">{test.detail}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {test.status !== "pending" && test.status !== "running" && test.duration_ms > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">{test.duration_ms}ms</span>
          )}
          <HealthStatusBadge status={test.status} />
        </div>
      </button>
      {expanded && (
        <div className="bg-muted/40 border-t px-3 py-2">
          {loading && <div className="text-xs text-muted-foreground">加载中...</div>}
          {error && <div className="text-xs text-destructive">加载输出失败：{error}</div>}
          {output !== null && (
            <pre className="text-xs whitespace-pre-wrap break-words font-mono max-h-64 overflow-auto">{output}</pre>
          )}
        </div>
      )}
    </div>
  );
}
