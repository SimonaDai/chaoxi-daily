# 朝夕●一日一记 - 项目协作规范

遵循用户提供的 `D:/work_detection/Git 协作规范.pdf`，以及会话中的全局工作指南。

- 中文沟通；修改前检查分支、工作区、远程；保护已有修改。
- main 为保护分支。功能在 `codex/feature/*`，修复在 `codex/fix/*` 开发，通过 PR 合并。
- 一个任务一个分支；小步 Conventional Commits；精确暂存本任务文件。
- 默认仅本地提交。推送、创建 PR、合并或部署需要用户授权；已有授权不重复询问。
- 空仓库初始化：先创建空的 main 基线提交，再建立功能分支。没有远程时如实说明无法同步。
- 提交前运行 `npm run check`、`npm run policy:validate`；涉及 Android 时运行适用的 Gradle 构建。
- 没有 Android SDK / JDK 或设备时，明确区分网页验证、APK 编译、真机验证与 GitHub CI。
- 不提交 node_modules、dist、构建产物、日志、下载的模型、签名证书和本地配置。
- 文件修改优先 apply_patch；读取使用 Desktop Commander。Serena 可用时优先用其检索代码；当前未提供时使用 Desktop Commander。
- 本地数据优先，截图不得发送到第三方 OCR 服务。默认不提醒，不在启动时申请通知权限。
- 图片仅清理应用副本：保存满一个自然月且对应事项结束后，在启动/恢复前台时检查。
- 清理逻辑、重复规则、日期解析和导入验证必须有针对边界情况的测试。
- `src/domain` 保持纯逻辑；设备 API 放在 `src/platform`；UI 放在 `src/components`。

常用命令：`npm run dev`、`npm run check`、`npm run android:sync`、`npm run android:debug`。
