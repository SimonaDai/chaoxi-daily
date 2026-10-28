# 从源码备份到手机 APK

源码、构建结果、手机资料是三件不同的东西：GitHub 仓库保存源码；Actions 临时编译 APK；你在手机记录的事项和截图只在手机，需从应用内导出备份。

## 1. 首次把本地仓库上传 GitHub

当前已有空的 `main` 基线提交和独立功能分支 `feature/chaoxi-android`。还没有配置远程仓库。先验收本地界面与说明；确认后，在 GitHub 创建一个**空仓库**，建议命名 `chaoxi-daily`，不要勾选自动创建 README、.gitignore 或许可证。

在项目目录终端执行（把地址替换成你实际创建的仓库地址）：

```sh
git status
git remote add origin https://github.com/你的用户名/chaoxi-daily.git
git push -u origin main
git push -u origin feature/chaoxi-android
```

这些命令只在你决定上传时执行。本项目不会替你推送。遇到登录提示按 GitHub 引导登录，不要把访问令牌写进仓库 URL 或源代码。已有 origin 时先 `git remote -v` 核对，不盲目重复添加。

若 `main` 推送显示分支冲突，先停下核对远程历史，不使用强推。可能是创建 GitHub 仓库时自动生成过文件，需要先处理双方历史。

## 2. 从功能分支拿到第一个测试 APK

功能分支推送会触发 **Check and build APK** 工作流：

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

## 3. 验收和 PR 合并

功能分支通过检查后，在 GitHub 点 **Compare & pull request**，base 选择 `main`，compare 选择 `feature/chaoxi-android`。说明用户行为、测试和限制，审查后再合并。

个人仓库没有其他审查人时也保留 PR 记录，自己逐项核对；仓库如果设置了“必须其他人批准”，需要指定实际审查人，不绕过规则。

合并后在本机同步（先保证没有未保存的修改）：

```sh
git switch main
git pull --ff-only origin main
git log --oneline --decorate -5
```

确认功能已合入后按授权清理分支。优先 `git branch -d feature/chaoxi-android`；若使用 squash merge 导致安全删除被拒绝，先核对实际合入情况，不直接改用 `-D`。

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

浏览器端到端测试不能替代上述 Android 真机验收。当前开发机没有 JDK/Android SDK，已完成网页构建与 Capacitor 同步；GitHub 构建结果需上传后实际确认。
