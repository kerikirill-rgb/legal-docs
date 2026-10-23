/**
 * Smoke test full web flow. Run while `npm run dev` is up.
 */
import { chromium } from 'playwright'

const base = process.env.WEB_URL || 'http://localhost:8081'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
page.on('dialog', (d) => d.accept())
await page.goto(base, { waitUntil: 'networkidle', timeout: 90000 })
await page.getByTestId('demo-list').click()
await page.getByTestId('call-btn').click()
await page.getByText('Завершил разговор').click()
await page.getByTestId('demo-transcript').click()
await page.getByText('Разобрать AI').click()
await page.getByText('crm_note', { exact: false }).waitFor({ timeout: 15000 })
await page.getByText('Отправить в Битрикс').click()
await page.getByText('К следующему').click()
await page.getByTestId('stop-btn').click()
await page.waitForTimeout(800)
await page.screenshot({ path: '/opt/cursor/artifacts/drive-calls-e2e-paused.png', fullPage: true })
await browser.close()
console.log('web smoke ok')
