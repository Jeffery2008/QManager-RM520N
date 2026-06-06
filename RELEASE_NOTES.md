# 🚀 QManager RM520N BETA v0.1.12-cn.1

本次中文 fork 同步上游 `v0.1.11` 与 `v0.1.12`，继续保留中文界面、fork 更新源和 `-cn.N` 版本规则。若你已安装 `v0.1.5-cn.1` 或更新版本，可在 **系统设置 → 软件更新** 中直接 OTA 更新。

## 🛠️ 改进

- **仪表盘新增存储用量。** 设备指标现在会显示 `/usrdata` 分区使用率，也就是配置、配置档、日志以及 Entware (`/opt`) 所在分区；80% 变为黄色警告，95% 变为红色告警。
- **流量统计自动识别 rx/tx 方向。** 启动时会进行一次小流量探测，判断当前固件里的上传/下载字段是否反向，并自动迁移既有统计，减少不同 Quectel 固件造成的方向错置。
- **SIM 配置可绑定连接场景。** 自定义 SIM 配置现在可与连接场景联动，换卡或套用配置时会根据场景约束处理网络模式、锁频等设置。
- **APN/WAN 配置管理增强。** APN 页面补齐 WAN Profile 管理能力，并支持与 AT-only 的 RM520N-GL 工作流对齐。
- **本地网络新增 Custom DNS。** 可通过 dnsmasq 哨兵块配置上游 DNS，且与 IP 透传/DNS Proxy 状态联动。

## 🐛 修复

- **移除 Live Traffic 实时流量组件。** 该组件无法覆盖 LAN 到 WAN 的硬件卸载流量，容易显示接近 0；累计流量统计不受影响。
- **IP 透传的“应用并重启”现在会真正重启。** 保存 USB Connection Mode 后会走 sudo helper，并进入重启倒计时页面。
- **OTA/系统重启不再卡在空白页面。** 所有重启流程会先等待 `/reboot/` 页面完成确认，再触发设备重启。
- **版本管理里的“安装”会执行完整安装。** 以前只会下载 tarball，现在会完成下载、安装和重启流程，可用于升级、重装和回滚。
- **安装与 OTA 下载脚本会自动选择 `curl` 或 `wget`。** 没有 `curl` 的环境也可以继续安装。

## 🌐 中文 fork 调整

- 新增/变更的前端可见文案已汉化，包括 Custom DNS、WAN Profile、SIM 配置应用状态、Watchdog Tier 名称、软件更新安装确认、IP 透传重启提示和仪表盘存储指标。
- 软件更新源继续指向 `Jeffery2008/QManager-RM520N`，不会回退到上游仓库。
- `package.json` 与安装脚本版本更新为 `v0.1.12-cn.1`。
- 本地打包仍使用 webpack 构建路径，以避开此 Windows 环境里 Turbopack 不稳定的问题。

## 📥 安装

### 从旧版升级

进入 **系统设置 → 软件更新**，下载并安装最新版本。配置会被保留。

### 全新安装

SSH 或 ADB 进入设备后执行：

```sh
curl -fsSL -o /tmp/qmanager-installer.sh \
  https://github.com/Jeffery2008/QManager-RM520N/raw/refs/heads/main/qmanager-installer.sh && \
  bash /tmp/qmanager-installer.sh
```

如果设备没有 `curl`，可使用 `wget`：

```sh
wget -O /tmp/qmanager-installer.sh \
  https://github.com/Jeffery2008/QManager-RM520N/raw/refs/heads/main/qmanager-installer.sh && \
  bash /tmp/qmanager-installer.sh
```

**License:** MIT + Commons Clause
