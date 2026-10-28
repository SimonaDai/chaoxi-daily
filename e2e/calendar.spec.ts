import { expect, type Page, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-27T01:00:00Z'));
  await page.goto('/');
  await expect(page.getByRole('button', { name: '记一件事', exact: true })).toBeVisible();
});

async function addEvent(page: Page, title: string) {
  await page.getByRole('button', { name: '记一件事', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('combobox', { name: '提醒', exact: true })).toHaveValue('none');
  await dialog.getByLabel('事项名称', { exact: true }).fill(title);
  await dialog.getByRole('button', { name: '记进日历' }).click();
  await expect(dialog).not.toBeVisible();
}

test('手机记录、毛玻璃切换与重新打开', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await addEvent(page, '产品面试');
  await addEvent(page, '资格笔试');
  await expect(page.locator('.glass-card .glass-title')).toHaveText('产品面试');
  await page.getByRole('button', { name: '下一件事项' }).click();
  await expect(page.locator('.glass-card .glass-title')).toHaveText('资格笔试');
  await page.waitForTimeout(400);
  const card = page.locator('.glass-card .glass-summary');
  const bounds = await card.boundingBox();
  if (!bounds) throw new Error('卡片不可见');
  await page.mouse.move(bounds.x + bounds.width * 0.8, bounds.y + 70);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.2, bounds.y + 75, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator('.glass-card .glass-title')).toHaveText('产品面试');
  await page.reload();
  await expect(page.locator('.glass-card .glass-title')).toHaveText('产品面试');
  await expect(page.getByText('左右滑动切换')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: info.outputPath('mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: info.outputPath('desktop.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('未定日期存待整理，自定义类型有颜色且可以再使用', async ({ page }) => {
  await page.getByRole('button', { name: '记一件事', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('事项名称').fill('预约体检');
  await dialog.getByRole('combobox', { name: '类型', exact: true }).selectOption('__custom');
  await dialog.getByLabel('类型名称').fill('健康');
  await dialog.getByLabel('颜色', { exact: true }).fill('#348765');
  await dialog.getByLabel('日期还没确定，先存入待整理').check();
  await dialog.getByRole('button', { name: '存入待整理' }).click();
  await expect(page.getByRole('button', { name: /预约体检/ })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /待整理，1/ }).click();
  await page.getByRole('button', { name: /预约体检/ }).click();
  await expect(
    dialog.getByRole('combobox', { name: '类型', exact: true }).locator('option:checked'),
  ).toHaveText('健康');
  await dialog.getByLabel('日期还没确定，先存入待整理').uncheck();
  await dialog.getByRole('button', { name: '记进日历' }).click();
  await expect(page.locator('.glass-card .category-label')).toHaveText('健康');
  await expect(page.locator('.glass-card')).toHaveCSS('--category-color', '#348765');
});

test('截图仅保存在本机，重载后仍能查看并完整导出', async ({ page }) => {
  // 控制压缩完成时机，覆盖 CI 上“点击已完成，但异步保存尚未完成”的情况。
  const compression = await page.evaluateHandle(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    let release = () => {};
    let started = false;
    const ready = new Promise<void>((resolve) => {
      release = resolve;
    });
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      started = true;
      HTMLCanvasElement.prototype.toBlob = original;
      void ready.then(() => original.call(this, callback, type, quality));
    };
    return { release, isStarted: () => started };
  });
  await page.getByRole('button', { name: '截图记录' }).click();
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 500;
    canvas.height = 180;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas unavailable');
    context.fillStyle = 'white';
    context.fillRect(0, 0, 500, 180);
    context.fillStyle = 'black';
    context.font = '28px sans-serif';
    context.fillText('Local image test', 20, 70);
    return canvas.toDataURL('image/png').split(',')[1] ?? '';
  });
  await page
    .getByRole('dialog')
    .locator('input[type=file]')
    .setInputFiles({
      name: 'notice.png',
      mimeType: 'image/png',
      buffer: Buffer.from(png, 'base64'),
    });
  await page.getByRole('button', { name: '仅附图，自己填写' }).click();
  const editor = page.getByRole('dialog');
  await page.getByRole('button', { name: '存入待整理' }).click();
  await expect.poll(() => compression.evaluate((control) => control.isStarted())).toBe(true);
  await expect(editor.getByRole('button', { name: '正在保存…' })).toBeDisabled();
  await compression.evaluate((control) => control.release());
  // 点击结束不等于保存结束；关闭编辑器和显示新记录发生在持久化成功之后。
  await expect(editor).not.toBeVisible();
  await expect(page.getByRole('button', { name: /截图待整理/ })).toBeVisible();
  await compression.dispose();
  await page.reload();
  await page.getByRole('button', { name: /待整理，1/ }).click();
  await page.getByRole('button', { name: /截图待整理/ }).click();
  await page.getByText('原始截图 · notice.png').click();
  const image = page.getByRole('img', { name: '事项截图：notice.png' });
  await expect(image).toBeVisible();
  await expect
    .poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0))
    .toBe(true);
  await page.getByLabel('日期还没确定，先存入待整理').uncheck();
  await page.getByRole('button', { name: '记进日历' }).click();
  await page.getByRole('button', { name: '截图待整理，查看详情' }).click();
  await page.getByText('原始截图 · notice.png').click();
  await expect(image).toBeVisible();
  await page.getByRole('button', { name: '本机存图' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出完整备份' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('chaoxi-backup-2026-10-27.json');
  const stream = await file.createReadStream();
  if (!stream) throw new Error('未生成备份内容');
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const backup = Buffer.concat(chunks);
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '删除本次' }).click();
  await expect(page.locator('.glass-card')).toHaveCount(0);
  await page.getByRole('button', { name: '本机存图' }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page
    .locator('.file-button input[type=file]')
    .setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: backup });
  await expect(page.getByRole('status')).toContainText('本机资料已从备份恢复');
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: '截图待整理，查看详情' }).click();
  await page.getByText('原始截图 · notice.png').click();
  await expect(image).toBeVisible();
});

test('中英文离线 OCR 使用随包模型，所有请求都留在本机', async ({ page }) => {
  test.setTimeout(120_000);
  const diagnostics: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && diagnostics.length < 10)
      diagnostics.push(message.text().slice(0, 500));
  });
  const remoteRequests: string[] = [];
  page.on('request', (request) => {
    if (/^https?:/.test(request.url()) && !request.url().startsWith('http://127.0.0.1:4173/'))
      remoteRequests.push(request.url());
  });
  await page.evaluate(() => document.fonts.ready);
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 300;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas unavailable');
    context.fillStyle = 'white';
    context.fillRect(0, 0, 1200, 300);
    context.fillStyle = 'black';
    context.font = '40px "Noto Sans SC", sans-serif';
    context.fillText('【星河科技】笔试通知', 35, 85);
    context.fillText('2026年10月28日 14:00-15:00', 35, 170);
    return canvas.toDataURL('image/png').split(',')[1] ?? '';
  });
  await page.getByRole('button', { name: '截图记录' }).click();
  await page
    .getByRole('dialog')
    .locator('input[type=file]')
    .setInputFiles({
      name: 'ocr-test.png',
      mimeType: 'image/png',
      buffer: Buffer.from(png, 'base64'),
    });
  await page.getByRole('button', { name: '识别截图文字' }).click();
  await expect(page.getByLabel('通知文字（也可以直接粘贴）')).toBeEnabled({
    timeout: 90_000,
  });
  expect(
    await page.getByLabel('通知文字（也可以直接粘贴）').inputValue(),
    diagnostics.join('\n'),
  ).toMatch(/2026/);
  await page.getByRole('button', { name: '核对并填写事项' }).click();
  await expect(page.getByRole('combobox', { name: '提醒', exact: true })).toHaveValue('none');
  expect(remoteRequests).toEqual([]);
});
