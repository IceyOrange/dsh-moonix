import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, realpathSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

test('metadata resources occupy an actual locale directory containing only language filenames', () => {
  for (const specifier of ['dsh-moonix', 'dsh-moonix/token', 'dsh-moonix/oauth']) {
    const english = require.resolve(`${specifier}/locale/en.json`)
    const directory = dirname(english)
    assert.equal(directory, resolve('locale'))
    assert.deepEqual(readdirSync(directory).sort(), ['en.json', 'zh.json'])
    for (const filename of readdirSync(directory)) {
      assert.match(filename, /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*\.json$/u)
      assert.equal(dirname(require.resolve(`${specifier}/locale/${filename}`)), directory)
    }
  }
})

test('brand text, product detail documents and official icon resolve for each entry', () => {
  for (const language of ['en', 'zh']) {
    const dictionary = JSON.parse(readFileSync(require.resolve(`dsh-moonix/locale/${language}.json`), 'utf8'))
    assert.equal(dictionary.meta.title, 'moonix')
    assert.ok(dictionary.meta.description.trim().length > 0)
    const detail = readFileSync(new URL(dictionary.meta.detail, import.meta.url), 'utf8')
    assert.match(detail, /^# moonix\n/)
    assert.doesNotMatch(detail, /MOONIX_TOKEN|engines\.dsh|npm |ctx\.credentials|allow-version/)
    assert.match(detail, language === 'zh' ? /帮我总结本周在 moonix 记录的会议/ : /Summarize my meetings recorded in moonix this week/)
  }
  const icon = realpathSync(new URL(manifest.icon, import.meta.url))
  assert.ok(statSync(icon).size > 0 && statSync(icon).size <= 256 * 1024)
  const bytes = readFileSync(icon)
  assert.equal(bytes.subarray(0, 4).toString(), 'RIFF')
  assert.equal(bytes.subarray(8, 12).toString(), 'WEBP')
  for (const specifier of ['dsh-moonix', 'dsh-moonix/token', 'dsh-moonix/oauth']) {
    assert.equal(realpathSync(require.resolve(`${specifier}/icon`)), icon)
  }
})
