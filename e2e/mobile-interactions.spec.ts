import { expect, type Page, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-27T01:00:00Z'));
  await page.goto('/');
  await expect(page.getByRole('button', { name: '收起为周历' })).toBeVisible();
});

async function height(page: Page) {
  return page.locator('.calendar-gesture').evaluate((node) => node.getBoundingClientRect().height);
}

test('日期网格跟随触摸收起、展开，短拖回弹且不误选日期', async ({ page }) => {
  const client = await page.context().newCDPSession(page);
  const touch = async (type: string, x = 0, y = 0) => {
    await client.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [{ x, y }],
    });
  };
  const full = await height(page);
  const grid = await page.locator('.calendar-gesture').boundingBox();
  if (!grid) throw Error('日历不可见');
  const x = grid.x + grid.width / 2;
  const y = grid.y + 250;
  const selected = page.getByRole('button', { name: /^2026-10-27 星期/ });
  await touch('touchStart', x, y);
  await touch('touchMove', x, y - 100);
  await expect.poll(() => height(page)).toBeLessThan(full - 50);
  expect(await height(page)).toBeGreaterThan(90);
  await expect(selected).toHaveAttribute('aria-pressed', 'true');
  await touch('touchCancel');
  await expect.poll(() => height(page)).toBeCloseTo(full, 0);
  await touch('touchStart', x, y);
  await touch('touchMove', x, y - 20);
  await page.waitForTimeout(120);
  await touch('touchEnd');
  await expect.poll(() => height(page)).toBeCloseTo(full, 0);
  await touch('touchStart', x, y);
  await touch('touchMove', x, y - 220);
  await touch('touchEnd');
  await expect(page.getByRole('button', { name: '展开月历' })).toBeVisible();
  await expect.poll(() => height(page)).toBeLessThan(90);
  await expect(selected).toBeVisible();
  const week = await page.locator('.calendar-gesture').boundingBox();
  if (!week) throw Error('周历不可见');
  await touch('touchStart', x, week.y + 25);
  await touch('touchMove', x, week.y + 125);
  await expect.poll(() => height(page)).toBeGreaterThan(140);
  await touch('touchMove', x, week.y + 250);
  await touch('touchEnd');
  await expect(page.getByRole('button', { name: '收起为周历' })).toBeVisible();
  await expect.poll(() => height(page)).toBeCloseTo(full, 0);
  await expect(selected).toHaveAttribute('aria-pressed', 'true');
  await touch('touchStart', x + 70, grid.y + 35);
  await touch('touchMove', x - 70, grid.y + 35);
  await touch('touchEnd');
  await expect(page.getByRole('button', { name: /^2026-11-27 星期/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('左右翻月翻周，点击视图也有展开收起，边界日期不越界', async ({ page }) => {
  const swipe = async (direction: number) => {
    await page.locator('.calendar-gesture').scrollIntoViewIfNeeded();
    const rect = await page.locator('.calendar-gesture').boundingBox();
    if (!rect) throw Error('日历不可见');
    const x = rect.x + rect.width / 2;
    await page.mouse.move(x, rect.y + 35);
    await page.mouse.down();
    await page.mouse.move(x + 100 * direction, rect.y + 36, { steps: 8 });
    await page.mouse.up();
  };
  await swipe(-1);
  await expect(page.getByRole('button', { name: /^2026-11-27 星期/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await swipe(1);
  await page.getByRole('button', { name: '周', exact: true }).click();
  await expect.poll(() => height(page)).toBeLessThan(90);
  await swipe(-1);
  await expect(page.getByRole('button', { name: /^2026-11-03 星期/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await swipe(1);
  await expect(page.getByRole('button', { name: /^2026-10-27 星期/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: '月', exact: true }).click();
  await expect.poll(() => height(page)).toBeGreaterThan(300);
  await page.getByRole('button', { name: /^2026-10-31 星期/ }).click();
  await swipe(-1);
  await expect(page.getByRole('button', { name: /^2026-11-30 星期/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: '清单', exact: true }).click();
  await expect(page.locator('.calendar-gesture')).toHaveCount(0);
  await page.getByRole('button', { name: '今天', exact: true }).click();
  await page.getByRole('button', { name: '月', exact: true }).click();
  await expect(page.getByRole('button', { name: /^2026-10-27 星期/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('支持范围首尾的日期不会被手势翻出边界', async ({ page }) => {
  for (const [date, button] of [
    ['1900-01-01', '上个月'],
    ['2100-12-31', '下个月'],
  ]) {
    await page.clock.setFixedTime(new Date(`${date}T01:00:00Z`));
    await page.reload();
    await page.getByRole('button', { name: button }).click();
    await expect(page.getByRole('button', { name: new RegExp(`^${date} 星期`) })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.getByRole('button', { name: '周', exact: true }).click();
    await page.getByRole('button', { name: button === '上个月' ? '上一周' : '下一周' }).click();
    await expect(page.getByRole('button', { name: new RegExp(`^${date} 星期`) })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  }
});

test('三个手机面板左右对称，编辑区滚动时保存和标题保持可见', async ({ page }, info) => {
  for (const width of [320, 390, 480]) {
    await page.setViewportSize({ width, height: 844 });
    for (const name of ['本机存图', '截图记录', '记一件事']) {
      await page.getByRole('button', { name, exact: true }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await page.waitForTimeout(300);
      const box = await dialog.boundingBox();
      if (!box) throw Error('弹窗不可见');
      expect(Math.abs(box.x - (width - box.x - box.width))).toBeLessThan(2);
      expect(box.width).toBeGreaterThan(width - 3);
      expect(box.y).toBeGreaterThanOrEqual(15);
      if (name === '记一件事') {
        await expect(dialog.getByLabel('事项名称')).toBeVisible();
        await dialog.locator('.sheet-body').evaluate((node) => {
          node.scrollTop = node.scrollHeight;
        });
        await expect(dialog.getByRole('heading', { name })).toBeInViewport();
        await expect(dialog.getByRole('button', { name: '记进日历' })).toBeInViewport();
        await page.setViewportSize({ width, height: 480 });
        await expect(dialog.getByRole('button', { name: '记进日历' })).toBeInViewport();
        await expect(dialog.getByRole('button', { name: '关闭', exact: true })).toBeInViewport();
        await page.setViewportSize({ width, height: 844 });
      }
      if (width === 390) await page.screenshot({ path: info.outputPath(`${name}.png`) });
      await dialog.getByRole('button', { name: '关闭', exact: true }).click();
      await expect(dialog).not.toBeVisible();
      expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole('button', { name: '本机存图', exact: true }).click();
  const desktop = await page.getByRole('dialog').boundingBox();
  if (!desktop) throw Error('桌面弹窗不可见');
  expect(desktop.width).toBeLessThanOrEqual(560);
  expect(Math.abs(desktop.x - (1280 - desktop.x - desktop.width))).toBeLessThan(2);
});

test('点击年月快速跳转，月末与闰年收敛，取消选择不改变日期', async ({ page }) => {
  await page.getByRole('button', { name: /^2026-10-31 星期/ }).click();
  await page.getByRole('button', { name: /^选择年份/ }).click();
  let picker = page.getByRole('dialog', { name: '选择年月' });
  await picker.getByRole('button', { name: '2028 年', exact: true }).click();
  await picker.getByRole('button', { name: '2028 年 2 月', exact: true }).click();
  await expect(page.getByRole('button', { name: /^2028-02-29 星期/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: /^选择年份/ }).click();
  picker = page.getByRole('dialog', { name: '选择年月' });
  await picker.getByRole('button', { name: '2027 年', exact: true }).click();
  await picker.getByRole('button', { name: '2027 年 2 月', exact: true }).click();
  await expect(page.getByRole('button', { name: /^2027-02-28 星期/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: /^选择年份/ }).click();
  await picker.getByRole('button', { name: '2029 年', exact: true }).click();
  await picker.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(picker).not.toBeVisible();
  await expect(page.getByRole('button', { name: /^2027-02-28 星期/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: '周', exact: true }).click();
  await page.getByRole('button', { name: /^选择月份/ }).click();
  await picker.getByRole('button', { name: '2027 年 3 月', exact: true }).click();
  await expect(page.getByRole('button', { name: '展开月历' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^2027-03-28 星期/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('节日节气和放假补班同时显示，普通节日不被标记放假', async ({ page }) => {
  const month = async (value: number) => {
    await page.getByRole('button', { name: /^选择月份/ }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: `2026 年 ${value} 月`, exact: true })
      .click();
  };
  const halloween = page.getByRole('button', { name: /^2026-10-31 星期/ });
  await expect(halloween).toContainText('万圣夜');
  await expect(halloween.locator('.holiday-mark')).toHaveCount(0);
  await halloween.click();
  await expect(page.getByLabel('当天节日与假期')).toContainText('万圣夜');
  await month(11);
  await expect(page.getByRole('button', { name: /^2026-11-01 星期/ })).toContainText('万圣节');
  await month(2);
  const valentine = page.getByRole('button', { name: /^2026-02-14 星期/ });
  await expect(valentine).toContainText('情人节');
  await expect(valentine.locator('.holiday-mark')).toHaveText('班');
  await valentine.click();
  await expect(page.getByLabel('当天节日与假期')).toContainText('情人节');
  await expect(page.getByLabel('当天节日与假期')).toContainText('春节调休 · 补班');
  await month(6);
  const summer = page.getByRole('button', { name: /^2026-06-21 星期/ });
  await expect(summer).toContainText('夏至');
  await expect(summer).toContainText('父亲节');
  await expect(summer.locator('.day-extra-label')).toHaveText('父亲节');
  await summer.click();
  await expect(page.getByLabel('当天节日与假期')).toContainText('父亲节');
  await expect(page.getByLabel('当天节日与假期')).toContainText('夏至');
  await expect(page.getByLabel('当天节日与假期')).toContainText('端午节 · 放假');
  await month(10);
  const national = page.getByRole('button', { name: /^2026-10-01 星期/ });
  await expect(national).toContainText('国庆');
  await expect(national.locator('.holiday-mark')).toHaveText('休');
});

test('年月选择器首尾年份不能翻出支持范围', async ({ page }) => {
  for (const [date, previous, next] of [
    ['1900-01-01', true, false],
    ['2100-12-31', false, true],
  ] as const) {
    await page.clock.setFixedTime(new Date(`${date}T01:00:00Z`));
    await page.reload();
    await page.getByRole('button', { name: /^选择年份/ }).click();
    const picker = page.getByRole('dialog');
    await expect(picker.getByRole('button', { name: '上一组年份' })).toBeEnabled({
      enabled: !previous,
    });
    await expect(picker.getByRole('button', { name: '下一组年份' })).toBeEnabled({
      enabled: !next,
    });
    await picker.getByRole('button', { name: `${date.slice(0, 4)} 年`, exact: true }).click();
    await expect(picker.getByRole('button', { name: '上一年' })).toBeEnabled({
      enabled: !previous,
    });
    await expect(picker.getByRole('button', { name: '下一年' })).toBeEnabled({ enabled: !next });
    await picker.getByRole('button', { name: '关闭', exact: true }).click();
    await expect(picker).not.toBeVisible();
  }
});

test('南北小年在日历和当天信息中分别显示，且不自动标记放假', async ({ page }) => {
  await page.getByRole('button', { name: /^选择月份/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: '2026 年 2 月', exact: true }).click();
  for (const [date, name] of [
    ['2026-02-10', '北方小年'],
    ['2026-02-11', '南方小年'],
  ]) {
    const day = page.getByRole('button', { name: new RegExp(`^${date} 星期`) });
    await expect(day).toContainText(name ?? '');
    await expect(day.locator('.holiday-mark')).toHaveCount(0);
    await day.click();
    await expect(page.getByLabel('当天节日与假期')).toContainText(name ?? '');
  }
});
