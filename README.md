# QManager 简体中文语言包

本仓库是 QManager 的简体中文翻译工作区，不是应用源码 fork 或可安装语言包。上游已经原生支持多语言，并内置简体中文；这里仅维护中文翻译文件、同步与校验工具，并通过 PR 向上游贡献翻译。

- 汉化仓库：[Jeffery2008/QManager-RM520N](https://github.com/Jeffery2008/QManager-RM520N)
- 上游项目：[dr-dolomite/QManager-RM520N](https://github.com/dr-dolomite/QManager-RM520N)
- 英文源文件：`public/locales/en/`
- 简体中文：`public/locales/zh-CN/`

## 同步上游

```sh
npm run language:sync
npm run language:check
npm test
```

同步工具会从上游 `development` 获取英文语言文件，以英文为准更新键结构和顺序：保留已有中文值，新键留空待翻译，删除上游已移除的键。英文原文修改会列出供译者复核，不会覆盖原有中文。GitHub Actions 每日检查上游并在有变化时创建 PR；也可以在 Actions 页面手动运行。

## 翻译规则

只改 `public/locales/zh-CN/` 中的翻译值，不改键名、结构或英文源。未完成的译文可以留为 `""`，界面会回退到英文。`npm run language:check` 会检查键结构、`{{placeholder}}` 插值和 HTML 标签是否与英文一致；部分翻译会报告待办数量，但不会因此让校验失败。

## 向上游贡献

每日同步工作流只会更新本仓库的英文基线，并在本仓库有差异时创建 PR；它不会自动向官方仓库提交翻译。确认新增或变更的中文译文后，请将翻译变更提交到 [上游项目](https://github.com/dr-dolomite/QManager-RM520N) 的 `development` 分支，由上游维护者审核、合并和发布。

设备运行时只读取上游仓库维护的语言包清单和发布资产。将本仓库发布到 GitHub **不会**自动把它加入设备的可下载语言列表，也不会产生固件或 OTA 更新；只有翻译进入上游并随官方版本发布后，设备才会获得对应更新。

## 许可

沿用仓库中的 [LICENSE](LICENSE)。
