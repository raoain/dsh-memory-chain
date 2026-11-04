// check-bundle.mjs — 发版前自检 bundle 格式（2026-11-05）
//
// 为什么：0.4.2/0.4.3 连续两次装不上，根因都在 cordis.patch.yml 与 package.json 不一致——
//   ① insert.name 写成本地包名 dsh-notebook；
//   ② 改成 scoped 名但没加引号（YAML 里 @ 开头的标量非法）。
// 判据（官方方言）：insert 行的 name 必须是 package.json 的 name；scoped 名必须加双引号；
//   dsh.bundle.patch 指向的文件必须存在且在 files 里。
//
// 用法：node check-bundle.mjs   （失败 exit 1，成功打印 OK）
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const fail = (msg) => { console.error('FAIL: ' + msg); process.exitCode = 1 }
const ok = (msg) => console.log('OK: ' + msg)

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const patchPath = pkg?.dsh?.bundle?.patch
if (!patchPath) fail('package.json 缺 dsh.bundle.patch')
else {
  const rel = patchPath.replace(/^\.\//, '')
  const files = Array.isArray(pkg.files) ? pkg.files : []
  if (!files.some((f) => rel === f || rel.startsWith(f + '/'))) fail(`files 里没有 ${rel}`)
  else ok(`dsh.bundle.patch -> ${rel}，且已列入 files`)
}

if (!pkg.repository?.url) fail('package.json 缺 repository（官方包都有）')
else ok('repository 存在')
if (!pkg.exports) fail('package.json 缺 exports（官方包都有）')
else ok('exports 存在')

const yml = readFileSync(join(root, patchPath.replace(/^\.\//, '')), 'utf8')
const lines = yml.split(/\r?\n/)
let sawInsert = false
for (let i = 0; i < lines.length; i++) {
  const line = lines[i]
  if (/^\s*-\s*insert:\s*$/.test(line)) sawInsert = true
  const m = /^(\s*)name:\s*(.*)$/.exec(line)
  if (!m) continue
  const indent = m[1].length
  const value = m[2].trim()
  // insert 行里的 name 才做包名核对（顶层的 name 是 patch 目标声明）
  if (!sawInsert || indent < 6) continue
  const unquoted = value.replace(/^["']|["']$/g, '')
  if (unquoted !== pkg.name) fail(`insert.name = ${unquoted}，与 package.json 的 ${pkg.name} 不一致`)
  else ok(`insert.name = ${unquoted}`)
  if (pkg.name.startsWith('@') && !/^["']/.test(value)) fail('scoped 包名必须加双引号（YAML 里 @ 开头非法）')
  else if (pkg.name.startsWith('@')) ok('scoped 包名已加引号')
}
if (!sawInsert) fail('cordis.patch.yml 里没有 insert 行')

if (process.exitCode) console.error('bundle 自检未通过，不要发布。')
else console.log('bundle 自检全部通过。')
