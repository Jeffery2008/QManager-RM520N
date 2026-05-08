# 🚀 QManager RM520N BETA v0.1.6-cn.1

这是面向 RM520N-GL **TTL 与 Hop Limit 配置**的专项修复版本。保存 TTL/HL 后，界面现在会正确反映实际状态并在刷新后保持一致；禁用时也会真正清除规则。

> 如果你已经在 v0.1.5，可在 **系统设置 → 软件更新** 中一键 OTA。无需再使用 SSH/ADB。

## 🛠️ 修复

- **TTL/HL 保存后刷新不再显示为禁用。** 实时状态读取逻辑之前会传入一个 RM520N-GL 旧版 iptables 会拒绝的重复参数，导致保存成功后表单误报“已禁用”。现在界面会跟随真实内核状态。
- **禁用 TTL/HL 会完整清除规则。** 之前每次应用只移除一条规则，历史重复或过期规则可能在禁用后残留并重新出现在界面。现在每次应用都会清空整条链，并带有硬性上限防止异常循环。

## 📥 安装

### 从 v0.1.5 升级

进入 **系统设置 → 软件更新**，点击下载，然后安装。无需 SSH/ADB，所有设置都会保留。

### 全新安装

通过 ADB 或 SSH 进入调制解调器后运行：

```sh
curl -fsSL -o /tmp/qmanager-installer.sh \
  https://github.com/Jeffery2008/QManager-RM520N/raw/refs/heads/main/qmanager-installer.sh && \
  bash /tmp/qmanager-installer.sh
```

### 从 v0.1.4 升级

**这一次跨版本升级仍需要 ADB 或 SSH**，因为 v0.1.4 的更新 CGI 缺少安装 v0.1.5+ 所需的 sudo 提权。运行上面的全新安装命令即可；你的设置、配置文件和密码都会保留。

## 💙 致谢

欢迎通过 [GitHub Issues](https://github.com/Jeffery2008/QManager-RM520N/issues) 反馈问题和功能建议。

如果 QManager 节省了你的时间，可以考虑通过 [GitHub Sponsors](https://github.com/sponsors/dr-dolomite) 支持上游作者，或通过 Remitly 向 **Russel Yasol** (+639544817486) 发送 GCash。

**许可证：** MIT + Commons Clause — **祝连接顺利！**

---
