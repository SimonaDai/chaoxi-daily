# 日常开发、PR 合并与 APK 打包

源码、构建结果、手机资料是三件不同的东西：GitHub 仓库保存源码；Actions 临时编译 APK；你在手机记录的事项和截图只在手机，需从应用内导出备份。

## 1. 日常开发：从最新 main 创建任务分支

项目位于 `F:/chaoxi-daily`，远程仓库为 `https://github.com/SimonaDai/chaoxi-daily`。初始功能 PR #1 已合并，后续任务从最新的 main 开始，不继续在已完成的旧功能分支上堆叠开发。

先确认没有未保存的修改，再同步主分支。下面的 `feature/your-feature` 是新功能的分支名示例；修复使用 `fix/问题名称`，不要添加工具或代理名称前缀。

```sh
git status
git switch main
git pull --ff-only origin main
git switch -c feature/your-feature
```

开发和自测完成后，可以先暂存修改；提交内容和说明必须由用户确认后，才能执行 git commit。推送也按用户授权执行。

```sh
npm run check
npm run policy:validate
npm run test:e2e
git add .
# 用户确认范围与提交说明后执行：
git commit -m "feat: 本次具体完成的功能"
git push -u origin feature/your-feature
```

如果同步主分支报冲突或无法快进，先检查双方历史，不使用强推或强制重置。遇到登录提示按 GitHub 引导登录，不要把访问令牌写入仓库 URL 或源码。

## 2. PR 检查通过后合并，再下载 main 的 APK

在 GitHub 创建 PR：base 选择 `main`，compare 选择当前任务分支。检查改动范围、提交说明和测试结果，再确认合并。

| 操作                               | 自动行为                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------ |
| 只推送任务分支，尚未创建 PR        | 不触发工作流                                                             |
| 创建 PR / 给已打开的 PR 推送新提交 | 只运行 Source and browser checks；Android APK 显示 Skipped，属于正常行为 |
| 合并 PR，main 收到新提交           | 运行检查，通过后自动编译并上传 debug APK                                 |
| 手动 Run workflow                  | 检查通过后打包；可以选 debug，release 需要固定证书且只允许 main          |

PR 阶段的检查覆盖源码、类型、单元测试、网页构建、政策数据和浏览器路径。Android 实际编译放在合并后，不把网页检查通过等同于 APK 编译或真机验收通过。

合并后，到仓库的 Actions 页面，选择 **main 分支、对应合并提交**的 Check and build APK 运行记录：

| GitHub 页面               | 操作                                                  |
| ------------------------- | ----------------------------------------------------- |
| 仓库 → Actions            | 打开最新的 Check and build APK 运行                   |
| Source and browser checks | 等待格式、类型、单元测试、构建、政策和浏览器测试通过  |
| Android APK               | 等待 SDK、Gradle 依赖下载和编译完成；首次运行通常较慢 |
| 运行详情最下方 Artifacts  | 下载 `chaoxi-debug-运行编号`                          |
| 下载后的 ZIP              | 解压得到 `app-debug.apk`，传到 Android 手机打开安装   |

GitHub Artifact 下载通常需要登录。工作流保存产物 **7 天**，过期可重新运行。红叉时打开失败的步骤查看具体错误，不能把源码检查成功等同于 APK 已经编译成功。

debug 包适合界面和功能验收。GitHub 临时构建机的 debug 签名可能每次不同，下一次包可能无法覆盖安装；卸载会清除本机数据。计划持续使用时，请先按第 4 节使用固定 release 签名。两者采用同一应用 ID，切换签名之前也需导出数据。

手机若提示允许“安装未知应用”，只给你用于打开安装包的可信文件管理器/浏览器授权，安装后可关闭。Android 7 以下不在支持范围内。

需要在合并前安装测试包时，可以在 Actions → Check and build APK → Run workflow 中选择自己的任务分支和 debug。手动运行是明确的额外构建，不会由普通分支推送重复触发。正式 release 包仍需选择 main。

## 3. 主分支保护与合并后的分支清理

仓库首页若显示 main 未保护，点击 Protect this branch，或到 Settings → Rules / Branches 为 main 设置保护规则：

- 要求通过 Pull Request 合并，不直接在 main 开发。
- 要求状态检查通过，选择本项目的 **Source and browser checks**。
- 不把仅在合并后运行的 Android APK 设为 PR 必需检查。
- 阻止 main 被强推或删除。
- 单人开发可要求 PR 而不强制第二人批准；有实际协作者时再启用必要审批，避免自己无法批准自己的 PR。

官方说明：[受保护的分支](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)。这些是仓库管理员设置，源码中的 AGENTS.md 不会自动启用 GitHub 分支保护。

合并后同步本机 main（先保证工作区干净）：

```sh
git switch main
git pull --ff-only origin main
git log --oneline --decorate -5
```

确认任务已合入后，可在已合并 PR 页面点击 Delete branch 清理旧远程任务分支。经用户授权，再删除对应的本地分支，并清理失效的远程引用：

```sh
git branch -d feature/your-feature
git fetch --prune origin
```

main 长期保留；每个新任务创建新分支。Dependabot 的未合并分支跟它们的开放 PR 对应，不批量删，不随手合入 main。安全删除被拒绝时先核对实际合入情况，不直接改用 `-D`；尤其是 squash merge 后应先检查差异。

## 4. 持续使用：固定证书的 release APK

Android 用同一个应用 ID **和同一把签名私钥**判断能否覆盖升级。证书需由你自己生成和保管，不是每次打包新建。

安装 JDK 21 后，可在自己保管证书的目录运行以下命令；交互式输入口令，不把口令写入命令：

```sh
keytool -genkeypair -v -keystore chaoxi-release.jks -alias chaoxi -keyalg RSA -keysize 3072 -validity 10000 -storetype PKCS12
```

把证书放在项目以外的安全位置，并另做离线备份。PKCS12 通常使用同一口令作为库口令与密钥口令。也可以在 Android Studio 的 Generate Signed Bundle / APK 中生成和管理证书。

运行项目附带的小工具，生成供 Secrets 使用的 base64 文本（替换为自己的实际证书路径）：

```sh
node scripts/keystore-base64.mjs "D:/你保管证书的目录/chaoxi-release.jks"
```

它只在本机 `.tools/keystore-base64.txt` 写入编码内容，不在终端打印私钥。**base64 只是编码，不是加密**；该文件与证书一样不能发给他人或提交 Git，完成配置后可自行移除临时文件。`.tools/`、`.jks` 和 `.keystore` 均已忽略。

在 GitHub → Settings → Secrets and variables → Actions → New repository secret 添加：

| Secret 名称                 | 填写内容                       |
| --------------------------- | ------------------------------ |
| `ANDROID_KEYSTORE_BASE64`   | 上一步文本文件的完整内容       |
| `ANDROID_KEYSTORE_PASSWORD` | 证书库口令                     |
| `ANDROID_KEY_ALIAS`         | `chaoxi`，或你实际使用的 alias |
| `ANDROID_KEY_PASSWORD`      | 该密钥口令                     |

然后进入 Actions → Check and build APK → Run workflow：选择 **main**，variant 选择 **release**，运行。正式包仅允许从已经审查合并的 main 手动生成。下载 `chaoxi-release-运行编号` 中的 `app-release.apk`。

版本名称当前为 0.1.0。Actions 用该工作流的递增 `run_number` 作为 Android versionCode。后续版本保持应用 ID、证书不变，并保证 versionCode 比已安装版本大；如果重建仓库或更换工作流导致编号归零，应手动调整版本号策略后再发布。

证书丢失会影响后续覆盖升级，修改 GitHub 账号密码不会替你找回签名私钥。Secrets 也不代替你自己的离线备份。

## 5. GitHub 上“免费”的范围

GitHub Actions 有免费额度；公开仓库使用标准 GitHub 托管 runner 通常免费，私有仓库受账户套餐的分钟数与存储额度限制。超过额度或选择付费 runner 可能计费，请以账户 Billing 页面为准。

- 官方说明：[GitHub Actions 计费](https://docs.github.com/en/billing/concepts/product-billing/github-actions)。
- 本项目使用 `ubuntu-latest` 标准 runner，不配置付费大机型；产物只保留 7 天。
- Actions Artifact 适合测试分发；要长期给别人下载，可以在验收后手动创建 GitHub Release，附上固定签名的 APK。本项目不自动发布 Release、不自动部署。
- 正式签名说明：[Android 应用签名](https://developer.android.com/studio/publish/app-signing)。

## 6. 假期按政策更新

维护者核对国务院/政府官网通知后，修改 `src/data/holidays.json`，递增当年 `revision`，更新 `publishedAt` 和 `source`，经测试和 PR 合并。不能推测尚未发布的假期。

应用「本机存图 → 高级：假期数据同步」可以填写维护者提供的 HTTPS JSON 地址。例如公开仓库的 `raw.githubusercontent.com/你的用户名/chaoxi-daily/main/src/data/holidays.json`，需先确认实际地址可公开访问并支持跨域读取。私有仓库不能把访问令牌塞进地址；可另提供只含公共假期的公开源。

如希望安装后默认已有该地址，在仓库 Actions Variables 设置 `HOLIDAY_FEED_URL` 再重新打包即可。同步只接受合规 JSON 与较新 revision，网络失败继续使用已有数据。它是**同步经人工审核的数据**，并未自动理解网页政策，也不上传个人日程。

## 7. 首次真机验收

| 检查               | 预期                                                  |
| ------------------ | ----------------------------------------------------- |
| 首次启动           | 可使用；不弹通知、相册或文件全盘权限请求              |
| 关闭网络           | 日历、字体、本机截图和中英文 OCR 可用                 |
| 记录后杀掉应用再开 | 文字、类型、颜色、截图仍可读取                        |
| 两件同日事项       | 左右拖动、箭头切换；纵向正常滚动，短拖回弹            |
| 月末与单次改期     | 二月月末收敛，下一月恢复原日；只改本次不改变其他次    |
| 可选提醒           | 主动选择后才申请通知权限；拒绝可改回不提醒继续保存    |
| 完整备份           | 能导出至选定位置，恢复后图片和文字一致                |
| 覆盖升级           | 使用同一 release 证书及更大 versionCode，原有记录保留 |

浏览器端到端测试不能替代上述 Android 真机验收。本机没有配置 JDK/Android SDK；APK 是否成功以相应的云端运行记录为准，真机验收单独确认。

## 8. Dependabot：半年维护一次普通版本升级

Dependabot 是依赖维护机器人，创建的 PR 和分支是升级建议，不会直接改 main。当前保留机器人，普通版本更新按半年度执行：每年 1 月 1 日、7 月 1 日北京时间 09:00 检查。

- npm 和 GitHub Actions 各自将 minor / patch 小版本升级分组，减少 PR 数量。
- major 大版本仍逐个创建 PR，单独阅读发布说明并评审；检查变绿不替代兼容性判断。
- 普通版本更新安排不延迟安全告警；如果仓库已启用安全更新，它们按安全机制独立处理。
- 本次已有的 4 个升级 PR 经逐项检查后合并，并删除对应分支；后续普通版本升级遵循上述半年维护安排。

官方说明：[Dependabot 更新频率和分组](https://docs.github.com/en/code-security/tutorials/secure-your-dependencies/optimizing-pr-creation-version-updates)、[安全更新配置](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/configure-security-updates)。
