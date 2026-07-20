# Contributing

## 报告误判

请尽量提供：

- 原始文本；
- 期望语言；
- 实际语言；
- 页面主机名；
- 元素附近是否有 `lang`；
- 弹窗中复制的诊断报告。

不要提交包含账号、私信或其他隐私正文的完整网页快照。

## 提交代码

在 Pull Request 前运行：

```bash
npm run check
npm test
npm run test:e2e
```

稳定模式的兼容性约束不得被破坏：自动识别不能拆分网页文本节点，也不能进入 `ruby/rt/rp` 或片假名脚本生成节点。


## 提交识别样例

优先把不含私人信息的最小样例加入 `tests/fixtures/corpus.json`，并明确期望语言或 `null`。任何扩大日文启发式的修改都应同时加入中文反例。
