# CJK Context Font 0.4.0

按局部语境为中文、日文和韩文选择合适本地字体的 Chromium 扩展。识别完全在浏览器本地完成。

## 0.4.0

这一版继续保持经过验证的稳定模式，并加入：

- 全局和网站级个人词典；
- 完全匹配与包含匹配；
- 网页右键快速加入或删除词典项；
- 设置页识别试验台，显示语言、置信度、原因、证据和得分；
- 元素上的调试属性 `data-cjkcf-confidence` 与 `data-cjkcf-evidence`；
- 黄金测试语料；
- 发布安全检查；
- MIT License、Security Policy、Issue 与 Pull Request 模板；
- CI 自动测试并生成 ZIP artifact。

稳定模式仍然默认开启，不拆分或替换网页文本节点，并跳过 `ruby`、`rt`、`rp`、片假名注音脚本生成区域和 Shadow DOM 实验扫描。

## 安装或升级

1. 解压 ZIP。
2. 用新文件覆盖原扩展目录。
3. 在 `chrome://extensions` 点击“重新加载”。
4. 刷新已打开网页。
5. 确认稳定模式开启。

## 个人词典

在网页文字上右键，可以将当前短标题或选中文字加入全局词典或当前网站词典。设置页可以添加、删除、导入和导出词典。

优先级为：临时标记 > 元素站点规则 > 个人词典 > 自动判断。网站词典优先于全局词典，完全匹配优先于包含匹配。

## 开发

```bash
npm run check
npm test
npm run test:e2e
npm run release:check
npm run package
```

- 架构：[`docs/architecture.md`](docs/architecture.md)
- 识别模型：[`docs/detection.md`](docs/detection.md)
- 测试：[`docs/testing.md`](docs/testing.md)
- 隐私：[`PRIVACY.md`](PRIVACY.md)
- 贡献：[`CONTRIBUTING.md`](CONTRIBUTING.md)
- 安全：[`SECURITY.md`](SECURITY.md)

## 开源许可

当前仓库模板采用 MIT License。首次公开发布前，项目所有者仍可改为其他许可证。

## 已知边界

纯汉字短串无法保证自动判断正确；稳定模式也不会拆开同一连续文本节点里的混合语言。可以用个人词典和站点规则进行安全纠正。
