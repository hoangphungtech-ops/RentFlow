const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const source = fs.readFileSync(path.join(__dirname, '../app/vietnamese-search.ts'), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
const mod = { exports: {} }
new Function('module', 'exports', compiled)(mod, mod.exports)
const { normalizeVietnameseSearch, matchesVietnameseSearch } = mod.exports

test('tim kiem tieng Viet co/khong dau', () => {
  assert.equal(normalizeVietnameseSearch('  ĐẶNG  Văn   A  '), 'dang van a')
  assert.equal(matchesVietnameseSearch('Phòng Trọ Quận 3', 'phong tro quan 3'), true)
  assert.equal(matchesVietnameseSearch('Nguyễn Thị Ngọc', 'nguyen thi'), true)
  assert.equal(matchesVietnameseSearch('Dãy A - P101', 'p102'), false)
  assert.equal(matchesVietnameseSearch('Khu trọ Bình Thạnh', '  BINH   THANH  '), true)
})
