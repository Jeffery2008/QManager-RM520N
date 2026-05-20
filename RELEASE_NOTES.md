# 🚀 QManager RM520N BETA v0.1.10-cn.1

> 如果你已经在 v0.1.5 或更新版本，可在 **系统设置 → 软件更新** 中一键 OTA。无需 SSH/ADB。

## ✨ 新功能

- **可在界面中启用 Tailscale SSH。** Tailscale 连接卡片新增开关，可一键开启 Tailscale 内置 SSH 服务。访问权限完全由 Tailscale 管理后台的 ACL 策略控制，不会改动设备现有 SSH。启用前会弹出确认提示，提醒你先检查 ACL；该设置会在重连和重启后保持。

- **系统健康新增负载均值。** CPU 使用率下方新增一行显示 1 分钟、5 分钟和 15 分钟负载均值。在单核 RM520N-GL 上，这比单次 CPU 百分比快照更能反映持续负载；设备压力较高时进度条会变成黄色或红色，信息图标会解释三个数字的含义。

- **数据用量计数现在可跨重启保留。** 之前调制解调器重启或数据会话重新附着时计数会归零，不适合跨天统计。QManager 现在独立维护累计总量，不再依赖调制解调器会话。设备指标卡片新增 **重置** 按钮，便于按账单周期手动清零。

## 🛠️ 改进

- **修复 x5x 系列调制解调器（RM501、RM502、RG502Q）的实时流量。** 之前这些平台上会读取错误网络接口，导致计数显示为 0。现在每次都会正确自动检测活动接口。

- **连接状态不再卡在“离线”。** 某些设备变体之前会从固定但未激活的接口读取连接状态，即使互联网正常也显示离线。现在改用 Cloudflare 和 Google 的 HTTP 探测作为更可靠的判断信号。

- **非标准设备变体 OTA 升级不再误中止。** 使用变体固件 ID（例如 `RM520FGL_VA`）的用户升级时，之前可能看到“用户中止安装”，但实际并未取消。安装器现在能正确处理非交互环境，并以警告方式继续执行。

- **LAN 网关现在可在所有变体上正确显示。** 在部分设备（尤其 RM501 系列）上，LAN Gateway 字段偶尔会停留在 `-`。现在后台轮询器启动时会读取并缓存一次，因此加载更快，也能在所有支持机型上正确渲染。

- **修复旧款 Quectel 平台（RM502Q-AE、RG502Q）的调制解调器访问。** X55 系列设备上的权限问题可能让 Web 服务无法与调制解调器通信，导致 AT 命令失败。安装器现在使用多种兜底方式确保权限正确，并移除第三方工具留下的冲突规则。

- **新增 PayPal 捐赠入口。** 捐赠弹窗和支持文案新增 PayPal 选项，跟随上游最新 `v0.1.10` tag。

## 📥 安装

### 从 v0.1.8 升级

进入 **系统设置 → 软件更新**，点击下载，然后安装。无需 SSH/ADB，所有设置都会保留。

### 全新安装

通过 ADB 或 SSH 进入调制解调器后运行：

```sh
curl -fsSL -o /tmp/qmanager-installer.sh \
  https://github.com/Jeffery2008/QManager-RM520N/raw/refs/heads/main/qmanager-installer.sh && \
  bash /tmp/qmanager-installer.sh
```

如果你的调制解调器有 `wget` 但没有 `curl`（RM502/RM520/RM521 等 x5x/x6x 固件上比较常见），也可以用 `wget` 获取安装器。预检会从 Entware 自动安装 `curl`，方便后续 OTA 更新正常工作（前提是 Entware 已经完成引导）：

```sh
wget -O /tmp/qmanager-installer.sh \
  https://github.com/Jeffery2008/QManager-RM520N/raw/refs/heads/main/qmanager-installer.sh && \
  bash /tmp/qmanager-installer.sh
```

## 💙 致谢

欢迎通过 [GitHub Issues](https://github.com/Jeffery2008/QManager-RM520N/issues) 反馈问题和功能建议。

如果这些更新让你的网络配置体验更好，可以通过 [Wise](https://wise.com/pay/business/blackcatdev?currency=USD)、[PayPal](https://paypal.me/iamrusss) 或 [GitHub Sponsors](https://github.com/sponsors/dr-dolomite) 支持上游作者。


**许可证：** MIT + Commons Clause — **祝连接顺利！**

---
