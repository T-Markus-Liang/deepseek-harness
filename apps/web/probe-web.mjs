import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage()
const logs = []
page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`))
page.on('pageerror', err => logs.push(`[pageerror] ${err.message}\n${(err.stack ?? '').split('\n').slice(0,5).join('\n')}`))
page.on('requestfailed', req => logs.push(`[reqfail] ${req.url()} ${req.failure()?.errorText}`))
await page.goto('http://127.0.0.1:3080/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(8000)
const state = await page.evaluate(() => {
  const tree = document.querySelector('[role="tree"]')
  return {
    tree: tree?.getAttribute('aria-label') ?? null,
    treeText: tree?.textContent?.slice(0, 800) ?? null,
    bodyText: document.body?.innerText?.slice(0, 1200) ?? null,
  }
})
console.log(JSON.stringify({ state, logs }, null, 2))
await browser.close()
