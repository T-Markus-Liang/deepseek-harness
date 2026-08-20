import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage()
const logs = []
page.on('console', msg => { if (msg.type() === 'error' || msg.type() === 'warning') logs.push(`[${msg.type()}] ${msg.text()}`) })
page.on('pageerror', err => logs.push(`[pageerror] ${err.message}`))
await page.goto('http://127.0.0.1:3085/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(10000)
const state = await page.evaluate(() => {
  const tree = document.querySelector('[role="tree"]')
  return {
    treeLabel: tree?.getAttribute('aria-label') ?? null,
    treeText: tree?.textContent?.slice(0, 600) ?? null,
    bodyHead: document.body?.innerText?.slice(0, 400) ?? null,
  }
})
console.log(JSON.stringify({ state, logs }, null, 2))
await browser.close()
