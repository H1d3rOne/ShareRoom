import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('package.json 暴露 node:test 入口，且 .gitignore 忽略本地调试产物', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  const gitignore = fs.readFileSync('.gitignore', 'utf8')

  assert.equal(pkg.scripts?.test, 'node --test tests/**/*.test.mjs')
  assert.match(gitignore, /^\.superpowers\/$/m)
  assert.match(gitignore, /^\.playwright-cli\/$/m)
})
