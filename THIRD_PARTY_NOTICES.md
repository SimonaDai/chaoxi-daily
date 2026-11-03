# 第三方组件

项目使用第三方组件。构建时从已锁定 npm 包复制 OCR 模型和引擎；不把下载的模型或依赖目录提交到本仓库。MiSans Global 官方字体以未修改的 WOFF2 切片随源码保存并离线打包。安装包自动携带 `THIRD_PARTY_LICENSES.txt`，由本说明与依赖原包中的许可证文件生成；字体原始授权协议随包位于 `licenses/MiSans-License.pdf`。

| 组件                             | 主要用途                             | 许可证 / 来源                                                              |
| -------------------------------- | ------------------------------------ | -------------------------------------------------------------------------- |
| React / React DOM                | 界面                                 | MIT，https://github.com/facebook/react                                     |
| Capacitor 与官方插件             | Android 容器、文件、偏好、通知、分享 | MIT，https://github.com/ionic-team/capacitor                               |
| Tesseract.js / tesseract.js-core | 本机 OCR / WASM                      | Apache-2.0，https://github.com/naptha/tesseract.js                         |
| Tesseract 语言数据               | 中英文 LSTM 模型                     | Apache-2.0，https://github.com/tesseract-ocr/tessdata_best                 |
| lunar-typescript                 | 农历与节气                           | MIT，https://github.com/6tail/lunar-typescript                             |
| Lucide                           | 图标                                 | ISC，https://lucide.dev/license                                            |
| Zod                              | 数据校验                             | MIT，https://github.com/colinhacks/zod                                     |
| MiSans Global / MiSans VF        | 中文、英文与数字界面字体             | 小米 MiSans 字体知识产权许可协议，https://hyperos.mi.com/font/zh/download/ |

各组件保留自身版权与许可证。项目源码的对外授权方式由仓库所有者另行决定；这里不替源码所有者选择开源许可证。

本应用使用 MiSans Global 字体家族中的 MiSans VF（简体中文与拉丁文字），字体由小米提供，允许在应用中嵌入使用；不将字体作为独立商品分发或销售，不修改字形。原始授权协议：https://hyperos.mi.com/font-download/MiSans字体知识产权许可协议.pdf 。字体来源与各文件 SHA-256 校验值保存在 `src/assets/fonts/misans-global/source.json`。
