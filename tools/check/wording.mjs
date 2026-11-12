// 用词检查：扫本次新增的行，挡住"不能写成通过""不代表……"这类反复声明。规矩见 AGENTS.md 第 1 节。
// 用法：
//   node tools/check/wording.mjs            查暂存区（git add 之后、提交之前）
//   node tools/check/wording.mjs <提交>     查从这个提交到工作区的全部改动，例如 HEAD~3
// 确实需要这些字的那一行，在行尾加注释"用词检查:允许"。
import {spawnSync} from 'node:child_process';

const BANNED = [
  /不能写成/, /不得写成/, /不代表/, /不代替/, /不能替代/, /不能代替/, /冒充/,
  /不能据此/, /不能当作/, /不能当成/, /仅表示/, /只表示/, /不视为/, /不能视为/,
  /不能声称/, /不声称/, /未擅自/, /不是[^，。；\n]{0,12}验收/, /不等于[^，。；\n]{0,12}通过/,
];
const SKIP_FILES = new Set(['AGENTS.md', 'tools/check/wording.mjs']);
const ALLOW = '用词检查:允许';

const base = process.argv[2];
const args = base ? ['diff', '-U0', base, '--'] : ['diff', '--cached', '-U0', '--'];
const diff = spawnSync('git', args, {encoding: 'utf8', maxBuffer: 256 * 1024 * 1024});
if (diff.status !== 0) {
  console.error(diff.stderr || 'git diff 失败');
  process.exit(2);
}

let file = null, line = 0;
const hits = [];
for (const text of diff.stdout.split('\n')) {
  if (text.startsWith('+++ ')) { file = text.slice(4).replace(/^b\//, ''); continue; }
  const hunk = text.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);
  if (hunk) { line = Number(hunk[1]); continue; }
  if (!text.startsWith('+') || text.startsWith('+++')) continue;
  const added = text.slice(1);
  if (file && !SKIP_FILES.has(file) && !/\.(patch|diff)$/.test(file) && !added.includes(ALLOW)) {
    for (const pattern of BANNED) {
      const m = added.match(pattern);
      if (m) { hits.push(`${file}:${line}  「${m[0]}」  ${added.trim().slice(0, 80)}`); break; }
    }
  }
  line++;
}

if (hits.length) {
  console.log(`用词检查：${hits.length} 处反复声明，删掉这半句，状态只写一次（见 AGENTS.md 第 1 节）：`);
  for (const h of hits) console.log('  ' + h);
  process.exit(1);
}
console.log('用词检查通过');
