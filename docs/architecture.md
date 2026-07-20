# Architecture

## Runtime layers

1. `core.js`：无 DOM 依赖的语言识别核心。它以文字和显式上下文对象为输入，因此可直接进行单元测试。
2. `diagnostics.js`：只保存数字、短字符串和时间，不保存 DOM 节点。
3. `content.js`：网页上下文、站点规则、DOM 扫描与字体类应用。
4. `background.js`：右键菜单和站点规则写入。
5. `popup.*` / `options.*`：用户界面。

Manifest 中多个 content script 按 `core.js → diagnostics.js → content.js` 的顺序加载。

## Stability invariants

- 稳定模式下不得调用 `splitText()`、`replaceWith()` 或为自动识别插入包装元素。
- 自动扫描不得进入 `ruby`、`rt`、`rp` 或 `[data-kt-generated="true"]`。
- 长期状态不得保存 DOM 节点的强引用；元素缓存只允许使用 `WeakMap`/`WeakSet`。
- 站点规则和字体识别全部本地运行，不发送网页文本。

## Classification contract

```js
Core.classifyText(text, context) => null | {
  language,
  confidence,
  reason,
  evidence,
  scores?
}
```

`reason` 保持稳定，可用于测试和诊断；`evidence` 供未来调试界面使用。


## 0.4.0 dictionary boundary

个人词典是纯数据，匹配由 `core.js` 完成。网页内容脚本只加载当前网站可用项，不执行正则、选择器或用户代码。词典不能覆盖临时标记和元素站点规则。
