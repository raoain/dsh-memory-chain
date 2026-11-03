// 假宿主测试：验证 dsh-notebook 的 apply 能注册工具、工具能执行
import { apply, name } from '../lib/index.js'
import { readFileSync, rmSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const root = mkdtempSync(join(tmpdir(), 'nb-test-'))
const tools = new Map()
const ctx = {
  tools: { register(t) { tools.set(t.name, t); return () => tools.delete(t.name) } },
  logger: { info: (m) => console.log('[log]', m) },
}

apply(ctx, { root })

const fail = []
const ok = (cond, label) => { console.log((cond ? '✅ ' : '❌ ') + label); if (!cond) fail.push(label) }

console.log('插件名:', name)
console.log('注册的工具:', [...tools.keys()].join(', '))
ok(tools.size === 5, '注册了 5 个工具')

// 空记事本：自动初始化模板后，wake 应返回内容且不崩
const wake0 = tools.get('notebook_wake').execute()
ok(wake0.ok === true && String(wake0.text).length > 0, '空记事本自动初始化后 wake 返回内容（不崩）')

// 写入工作层
tools.get('notebook_work').execute({ text: '测试写入' })
// 写入档案层
tools.get('notebook_pit').execute({ text: '现象A|根因B|修法C' })
// 收工标记
tools.get('notebook_close').execute({ note: '测试' })

// 回读：wake 里应有工作层内容，不应有档案内容
const wake1 = tools.get('notebook_wake').execute()
ok(wake1.ok === true, '写入后 wake 返回 ok=true')
ok(wake1.text.includes('测试写入'), 'wake 读到了工作层')
ok(wake1.text.includes('收工'), 'wake 读到了收工标记')
ok(!wake1.text.includes('现象A'), 'wake 不读档案层（分层生效）')

// 档案层确实写进去了
const archive = readFileSync(join(root, '2-档案.md'), 'utf8')
ok(archive.includes('现象A') && archive.includes('根因B') && archive.includes('修法C'), '档案层三段式完整')

// render 形状
const out = tools.get('notebook_wake').output
const rendered = out.render({}, wake1)
ok(Array.isArray(rendered) && rendered[0]?.type === 'text', 'render 返回 text 块')
ok(Array.isArray(out.schema.required), 'output.schema 有 required')

rmSync(root, { recursive: true, force: true })
console.log(fail.length === 0 ? '\n✅ 全部通过（9 项）' : `\n❌ 失败 ${fail.length} 项: ${fail.join(' / ')}`)
process.exit(fail.length === 0 ? 0 : 1)
