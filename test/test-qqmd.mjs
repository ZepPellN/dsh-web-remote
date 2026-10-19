// dsh-web-remote — QQ markdown 发送前处理的单测（真跑输入/输出）
//
// ⚠ 这个文件在 2026-10-19 被**整体重写**过，原因值得记住：
//
//   我原先照着官方文档的"支持格式"清单，认为 QQ **不支持**表格/代码块/行内代码/任务列表，
//   于是写了一整套"降级"（表格→列表、代码块→去围栏缩进、行内代码→去反引号、任务列表→✅⬜），
//   并给它们配了 21 组单测 —— 那些测试**全都通过**，因为它们只验证了"我的降级按我设想工作"，
//   **没有验证"QQ 到底需要不需要降级"**。
//
//   真机实测（msg_type=2 原样发送）把每一条都推翻了：
//     · 表格        → 「表格」卡片（复制/保存/全屏）；三种写法都行；单元格内联 markdown 生效
//     · 代码块      → 代码卡片：语言标注 + 语法高亮 + 复制按钮
//     · 四空格缩进  → 同样识别成代码卡片
//     · 行内代码    → 等宽 + 底色
//     · 任务列表    → 真正的 ☑ / ☐ 勾选框
//     · HTML        → <b> 变粗体、<br> 变换行
//
//   所以现在的测试重点变了：**断言那些语法原样通过、不被改写** ——
//   防止以后有人又照着文档"补降级"。另外保留真正必要的两项（删图片引用、--- → ***）。
import { toQQMarkdown } from '../lib/qqbot.mjs';

let failed = 0;
function eq(name, got, want) {
  if (got !== want) {
    failed++;
    console.error('✗ ' + name);
    console.error('   得到: ' + JSON.stringify(got));
    console.error('   期望: ' + JSON.stringify(want));
  } else {
    console.log('✓ ' + name);
  }
}
function has(name, got, needle) {
  if (String(got).indexOf(needle) < 0) {
    failed++;
    console.error('✗ ' + name + ' —— 结果里找不到 ' + JSON.stringify(needle));
    console.error('   得到: ' + JSON.stringify(got));
  } else {
    console.log('✓ ' + name);
  }
}
function hasNot(name, got, needle) {
  if (String(got).indexOf(needle) >= 0) {
    failed++;
    console.error('✗ ' + name + ' —— 结果里不该出现 ' + JSON.stringify(needle));
    console.error('   得到: ' + JSON.stringify(got));
  } else {
    console.log('✓ ' + name);
  }
}

// ══ 一、QQ 支持的语法必须**原样通过**（不许再降级） ═════════════

// ── 1. 表格：三种写法都不许被改写（真机证明 QQ 渲染成表格卡片） ──
{
  const std = '| 新顺序 | 阶段 |\n| --- | --- |\n| 1 | 形状质量轮 |';
  eq('标准表格原样通过', toQQMarkdown(std), std);

  const quoted = '> | A | B |\n> | --- | --- |\n> | 1 | 2 |';
  eq('引用里的表格原样通过', toQQMarkdown(quoted), quoted);

  const noPipe = '新顺序 | 阶段\n--- | ---\n1 | 形状质量轮';
  has('无首尾竖线的表格不被改写', toQQMarkdown(noPipe), '新顺序 | 阶段');

  const bold = '| 项 | 值 |\n| --- | --- |\n| 倒角 | **重要** |';
  has('单元格内加粗保留', toQQMarkdown(bold), '**重要**');
}

// ── 2. 代码块：不许去围栏（真机证明是代码卡片 + 语法高亮） ──────
{
  const src = '说明：\n```js\nconst a = 1;\n```\n结束';
  const got = toQQMarkdown(src);
  has('代码围栏保留', got, '```js');
  has('代码内容保留', got, 'const a = 1;');
}

// ── 3. 行内代码：不许去反引号（真机证明是等宽+底色） ────────────
{
  eq('行内代码保留', toQQMarkdown('用 `npm test` 跑测试'), '用 `npm test` 跑测试');
}

// ── 4. 任务列表：不许转成 ✅/⬜（真机证明是真正的勾选框） ───────
{
  const src = '- [x] 已完成\n- [ ] 待办';
  eq('任务列表原样通过', toQQMarkdown(src), src);
}

// ── 5. HTML：原样通过（真机证明 <b>/<br> 会被渲染） ────────────
{
  const src = '<b>粗体</b> 和 <br>换行';
  eq('HTML 标签原样通过', toQQMarkdown(src), src);
}

// ── 6. 文档列出的那些语法，当然也原样通过 ──────────────────────
{
  const src = [
    '# 标题',
    '',
    '**加粗** 和 __下划线加粗__ 和 _斜体_ 和 ***加粗斜体*** 和 ~~删除线~~',
    '',
    '> 块引用',
    '',
    '- 无序',
    '1. 有序',
    '1. 第一层',
    '    - 第二层',
    '',
    '[链接](https://example.com) 和 <https://example.com/shot.png>',
  ].join('\n');
  eq('支持的语法整段原样通过', toQQMarkdown(src), src);
}

// ══ 二、真正必要的处理 ═══════════════════════════════════════

// ── 7. 图片引用删除（图片走富媒体，留着会重复或成坏图） ─────────
{
  hasNot('markdown 图片删除', toQQMarkdown('看图 ![截图](https://a.com/x.png) 完'), 'x.png');
  hasNot('裸图片 URL 删除', toQQMarkdown('见 https://a.com/y.jpg 结束'), 'y.jpg');
  hasNot('本地图片路径删除', toQQMarkdown('文件 E:\\pic\\z.png 在此'), 'z.png');
  hasNot('本地正斜杠路径删除', toQQMarkdown('文件 /home/u/z.png 在此'), 'z.png');
}
// 尖括号里的是「链接」不是「图片」，不能删（官方支持 <https://...> 写法）
{
  has('尖括号链接保留', toQQMarkdown('见 <https://example.com/shot.png> 这个链接'), '<https://example.com/shot.png>');
}
// 上一版这里有个真 bug：本地路径正则太贪，把 URL 的路径段也吃了 → <http>
// 这条用例就是当时抓出来的，留着防回归。
{
  const got = toQQMarkdown('见 <https://a.com/b/c.png> 完');
  hasNot('URL 路径段不被当本地路径', got, '<http>');
  has('URL 链接完整', got, '<https://a.com/b/c.png>');
}

// ── 8. 水平分割线统一成官方文档写的 *** ────────────────────────
{
  eq('--- 变 ***', toQQMarkdown('上\n---\n下'), ['上', '***', '下'].join('\n'));
  eq('___ 变 ***', toQQMarkdown('上\n___\n下'), ['上', '***', '下'].join('\n'));
  eq('*** 保持 ***', toQQMarkdown('上\n***\n下'), ['上', '***', '下'].join('\n'));
}

// ── 9. 删图片后不留多余空行 ───────────────────────────────────
{
  const got = toQQMarkdown('第一段\n\n![x](https://a.com/x.png)\n\n\n第二段');
  hasNot('没有三连空行', got, '\n\n\n');
}

// ── 10. 边界 ──────────────────────────────────────────────────
{
  eq('空字符串', toQQMarkdown(''), '');
  eq('null', toQQMarkdown(null), '');
  eq('undefined', toQQMarkdown(undefined), '');
}

// ── 11. 幂等 ──────────────────────────────────────────────────
{
  const once = toQQMarkdown('| A | B |\n| --- | --- |\n| 1 | 2 |\n- [x] 完\n```js\nx\n```');
  eq('幂等', toQQMarkdown(once), once);
}

console.log('');
if (failed) {
  console.error('QQ markdown 单测失败：' + failed + ' 项');
  process.exit(1);
}
console.log('QQ markdown 单测全部通过（11 组）');
