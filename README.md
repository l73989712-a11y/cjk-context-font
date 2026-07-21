# CJK Context Font 0.6.0

按局部语境为中文、日文、繁体中文和韩文选择合适本地字体的 Chromium 扩展。识别完全在浏览器本地完成。

## 0.6.0

- 新增保守、均衡和积极三档识别策略；
- 宽泛的纯汉字 ACG 词只在标题语境中显著增加日文分数；
- 中文句子里只有少量片假名时，不再把整句强制切成日文字体；
- 识别结果增加文字系统密度、决策差值和来源信息；
- 设置页增加八组实时字体预览；
- 识别试验台支持模拟标题/正文语境；
- 可复制结构化误判报告，方便提交 GitHub Issue；
- 保持稳定 DOM 模式、ruby 保护和不联网默认值。

## 安装

1. 下载 Chromium 安装包并完整解压。
2. 打开 `chrome://extensions`，启用开发者模式。
3. 点击“加载未打包的扩展程序”。
4. 选择直接包含 `manifest.json` 的解压文件夹。
5. 刷新已有网页。

## 识别优先级

临时手动标记 → 元素站点规则 → 个人词典 → 最近的网页 `lang` → 文字系统与语境评分 → 页面/浏览器语言回退。

纯汉字永远可能存在无法确定的情况。扩展的目标不是假装百分之百正确，而是在证据不足时保持克制，并让用户能够方便纠正。

## 开发

```bash
npm run check
npm test
npm run build
npm run test:e2e
npm run test:extension
npm run benchmark
npm run release:check
npm run package
```

- 架构：[`docs/architecture.md`](docs/architecture.md)
- 识别模型：[`docs/detection.md`](docs/detection.md)
- 性能：[`docs/performance.md`](docs/performance.md)
- 测试：[`docs/testing.md`](docs/testing.md)
- 发布：[`docs/releasing.md`](docs/releasing.md)
- 隐私：[`PRIVACY.md`](PRIVACY.md)
- 贡献：[`CONTRIBUTING.md`](CONTRIBUTING.md)
- 安全：[`SECURITY.md`](SECURITY.md)

## 隐私

扩展不上传网页文本、浏览历史、词典或站点规则，不包含广告、分析或遥测。

## License

MIT
