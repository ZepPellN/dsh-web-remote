// dsh-web-remote — QQ markdown 转换的单测（真跑输入/输出，不是结构断言）
//
// 为什么单独一个文件：表格→列表是**纯函数**，正是最该用真实用例覆盖的地方。
// test-dist.mjs 那套是"结构断言"（检查代码里有没有某段），证明不了转换结果对不对。
//
// 依据：官方"支持格式"清单里**没有表格**，所以必须降级。
//   https://bot.q.qq.com/wiki/develop/api-v2/server-inter/message/type/markdown.html
import { toQQMarkdown, convertQQTables } from '../lib/qqbot.mjs';

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

// ── 1. 表格（带表头）→ 列表 ────────────────────────────────
{
  const src = [
    '| 项目 | 状态 |',
    '| --- | --- |',
    '| 登录 | 完成 |',
    '| 支付 | 进行中 |',
  ].join('\n');
  const got = convertQQTables(src);
  eq('表格→列表（带表头）',
    got,
    ['- 项目：登录 ｜ 状态：完成', '- 项目：支付 ｜ 状态：进行中'].join('\n'));
  hasNot('表格竖线被消掉', got, '|');
}

// ── 2. 对齐标记 :---: 也要能识别为分隔行 ───────────────────
{
  const src = ['| A | B |', '| :---: | ---: |', '| 1 | 2 |'].join('\n');
  eq('表格→列表（对齐标记）', convertQQTables(src), '- A：1 ｜ B：2');
}

// ── 3. 没有分隔行 → 视为无表头，只列值 ──────────────────────
{
  const src = ['| x | y |', '| 1 | 2 |'].join('\n');
  eq('无表头表格', convertQQTables(src), ['- x ｜ y', '- 1 ｜ 2'].join('\n'));
}

// ── 4. 转义竖线 \| 不能把单元格切开 ────────────────────────
{
  const src = ['| 表达式 | 值 |', '| --- | --- |', '| a \\| b | 3 |'].join('\n');
  eq('转义竖线', convertQQTables(src), '- 表达式：a | b ｜ 值：3');
}

// ── 5. 空单元格跳过，不产生 "：值" 这种残骸 ────────────────
{
  const src = ['| A | B |', '| --- | --- |', '|  | 2 |'].join('\n');
  eq('空单元格跳过', convertQQTables(src), '- B：2');
}

// ── 6. 表格里的加粗保留（QQ 支持 **） ──────────────────────
{
  const src = ['| 名 | 值 |', '| --- | --- |', '| **甲** | 1 |'].join('\n');
  eq('单元格内加粗保留', convertQQTables(src), '- 名：**甲** ｜ 值：1');
}

// ── 7. 正文里偶然出现的 | 不该被当表格 ─────────────────────
{
  const src = '命令是 a | b 这样用的';
  eq('非表格行不动', convertQQTables(src), src);
}

// ── 8. 任务列表 → 勾选符号（QQ 不支持 - [x]） ──────────────
{
  const got = toQQMarkdown('- [x] 已完成\n- [ ] 待办\n- [X] 大写也算');
  eq('任务列表', got, ['- ✅ 已完成', '- ⬜ 待办', '- ✅ 大写也算'].join('\n'));
}

// ── 9. 代码块 → 去围栏 + 缩进（QQ 没有代码块） ─────────────
{
  const got = toQQMarkdown('说明：\n```js\nconst a = 1;\n```\n结束');
  has('代码块内容保留', got, 'const a = 1;');
  hasNot('代码围栏被去掉', got, '```');
}

// ── 10. 行内代码去反引号 ───────────────────────────────────
{
  eq('行内代码', toQQMarkdown('用 `npm test` 跑测试'), '用 npm test 跑测试');
}

// ── 11. 图片引用一律删除（图片走富媒体，避免重复/坏链） ─────
{
  hasNot('markdown 图片删除', toQQMarkdown('看图 ![截图](https://a.com/x.png) 完'), 'x.png');
  hasNot('裸图片 URL 删除', toQQMarkdown('见 https://a.com/y.jpg 结束'), 'y.jpg');
  hasNot('本地图片路径删除', toQQMarkdown('文件 E:\\pic\\z.png 在此'), 'z.png');
}

// ── 12. QQ 支持的语法必须原样保留 ──────────────────────────
{
  const got = toQQMarkdown([
    '# 标题',
    '',
    '**加粗** 和 _斜体_ 和 ~~删除线~~',
    '',
    '> 引用',
    '',
    '- 列表项',
    '1. 有序项',
    '',
    '[链接](https://example.com)',
  ].join('\n'));
  has('标题保留', got, '# 标题');
  has('加粗保留', got, '**加粗**');
  has('斜体保留', got, '_斜体_');
  has('删除线保留', got, '~~删除线~~');
  has('引用保留', got, '> 引用');
  has('无序列表保留', got, '- 列表项');
  has('有序列表保留', got, '1. 有序项');
  has('链接保留', got, '[链接](https://example.com)');
}

// ── 13. --- 统一成官方文档里的 *** ─────────────────────────
{
  eq('水平分割线', toQQMarkdown('上\n---\n下'), ['上', '***', '下'].join('\n'));
}

// ── 14. 删图片后不留一堆空行 ───────────────────────────────
{
  const got = toQQMarkdown('第一段\n\n![x](https://a.com/x.png)\n\n\n第二段');
  hasNot('没有三连空行', got, '\n\n\n');
}

// ── 15. 空输入 ─────────────────────────────────────────────
{
  eq('空字符串', toQQMarkdown(''), '');
  eq('null', toQQMarkdown(null), '');
  eq('undefined', toQQMarkdown(undefined), '');
}

// ── 16. 幂等：转过的再转一次不变（防止反复转换越转越乱） ───
{
  const once = toQQMarkdown('| A | B |\n| --- | --- |\n| 1 | 2 |\n- [x] 完');
  eq('幂等', toQQMarkdown(once), once);
}

// ── 17. 官方文档：列表前是普通文本时必须空行隔开，否则不识别为列表 ──
{
  const got = convertQQTables('这是正文一行\n| A | B |\n| --- | --- |\n| 1 | 2 |');
  eq('表格紧跟正文 → 补空行', got, ['这是正文一行', '', '- A：1 ｜ B：2'].join('\n'));
}
{
  const got = convertQQTables('| A | B |\n| --- | --- |\n| 1 | 2 |');
  eq('表格在开头 → 不补空行', got, '- A：1 ｜ B：2');
}
{
  const got = convertQQTables('正文\n\n| A | B |\n| --- | --- |\n| 1 | 2 |');
  eq('表格前已有空行 → 不重复补', got, ['正文', '', '- A：1 ｜ B：2'].join('\n'));
}
{
  const got = convertQQTables('- 已有列表\n| A | B |\n| --- | --- |\n| 1 | 2 |');
  eq('表格紧跟列表 → 不补空行', got, ['- 已有列表', '- A：1 ｜ B：2'].join('\n'));
}

// ── 18. 官方文档：二级列表前面需要空 4 个空格（≥3 列改多行） ──
{
  const src = ['| 检查项 | 状态 | 说明 |', '| --- | --- | --- |', '| 依赖安装 | 通过 | 58 个包 |'].join('\n');
  const got = convertQQTables(src);
  eq('≥3 列 → 每条一行 + 其余字段缩进 4 空格',
    got,
    ['- 检查项：依赖安装', '    状态：通过', '    说明：58 个包'].join('\n'));
}
{
  // 2 列仍走单行（短，手机一行放得下）
  const got = convertQQTables('| 项目 | 状态 |\n| --- | --- |\n| 登录 | 完成 |');
  eq('2 列 → 保持单行', got, '- 项目：登录 ｜ 状态：完成');
}
{
  // 空单元格跳过后只剩 1 个字段，仍走单行
  const got = convertQQTables('| A | B | C |\n| --- | --- | --- |\n| 1 |  |  |');
  eq('≥3 列但只剩 1 个字段', got, '- A：1');
}

// ── 19. 尖括号里的图片 URL 是「链接」不是「图片」，不能删 ────
{
  const got = toQQMarkdown('见 <https://example.com/shot.png> 这个链接');
  has('尖括号链接保留', got, '<https://example.com/shot.png>');
}
{
  const got = toQQMarkdown('见 https://example.com/shot.png 这个裸链接');
  hasNot('裸图片 URL 仍删除', got, 'shot.png');
}

console.log('');
if (failed) {
  console.error('QQ markdown 单测失败：' + failed + ' 项');
  process.exit(1);
}
console.log('QQ markdown 单测全部通过（21 组）');
