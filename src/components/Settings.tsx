import { Download, HardDrive, RefreshCw, Upload } from 'lucide-react';
import { useState } from 'react';
import { holidayOn } from '../domain/holidays';
import { expiredPhotoIds } from '../domain/retention';
import type { AppModel } from '../hooks/useAppModel';
import { createBackup, exportFile, parseBackup } from '../platform/backup';
import { Sheet } from './Sheet';

export function Settings({ app, onClose }: { app: AppModel; onClose(): void }) {
  const [url, setUrl] = useState(app.snapshot?.settings.holidayFeedUrl ?? '');
  const [working, setWorking] = useState(false),
    [error, setError] = useState('');
  const snapshot = app.snapshot;
  if (!snapshot) return null;
  const policy = holidayOn(app.policies, app.today),
    bytes = snapshot.photos.reduce((sum, photo) => sum + photo.bytes, 0);
  const run = async (action: () => Promise<unknown>) => {
    setWorking(true);
    setError('');
    try {
      await action();
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : '操作失败，请重试。');
    } finally {
      setWorking(false);
    }
  };
  return (
    <Sheet
      title="本机数据与设置"
      onClose={() => {
        if (!working && !app.busy) onClose();
      }}
    >
      <div className="settings-content">
        <div className="storage-hero">
          <HardDrive />
          <div>
            <strong>轻轻记录，轻装前行。</strong>
            <span>
              资料保存在{app.repository.native ? '这台手机的应用目录' : '当前浏览器'}，由你掌握。
            </span>
          </div>
        </div>
        <div className="storage-stats">
          <div>
            <span>事项记录</span>
            <strong>{snapshot.events.length}</strong>
          </div>
          <div>
            <span>本机图片</span>
            <strong>
              {snapshot.photos.length}
              <small> 张</small>
            </strong>
          </div>
          <div>
            <span>图片占用</span>
            <strong>
              {(bytes / 1024 / 1024).toFixed(1)}
              <small> MB</small>
            </strong>
          </div>
        </div>
        <div className="setting-block">
          <h3>自动保持轻量</h3>
          <p>
            图片保存满 <strong>1 个自然月</strong>
            ，并且对应事项已经结束，打开应用或回到前台时自动清理。未来事项、日期待定的事项继续保留图片。
          </p>
          <p>
            仅清理应用保存的图片副本，事项文字和备注继续保留。重复事项按其关联的那一次日期判断。
          </p>
          <button
            type="button"
            className="secondary-button"
            disabled={working || app.busy}
            onClick={() =>
              void run(async () => {
                const count = expiredPhotoIds(snapshot).length;
                await app.clean();
                app.setMessage(
                  count ? `已检查 ${count} 张到期图片。` : '当前没有需要清理的到期图片。',
                );
              })
            }
          >
            检查并清理到期图片
          </button>
        </div>
        <div className="setting-block">
          <h3>本机备份</h3>
          <p>导出内容包含事项、类型、完成状态和图片。换手机或卸载前可以先保存一份。</p>
          <div className="settings-buttons">
            <button
              type="button"
              className="secondary-button"
              disabled={working || app.busy}
              onClick={() =>
                void run(async () => {
                  await exportFile(await createBackup(snapshot, app.repository));
                  app.setMessage('备份文件已生成，请保存到你选择的位置。');
                })
              }
            >
              <Download />
              导出完整备份
            </button>
            <label
              className={`secondary-button file-button ${working || app.busy ? 'disabled' : ''}`}
            >
              <Upload />
              恢复备份
              <input
                type="file"
                accept="application/json,.json"
                disabled={working || app.busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (!file) return;
                  void run(async () => {
                    if (file.size > 45 * 1024 * 1024) throw new Error('备份文件需小于 45 MB。');
                    const text = await file.text();
                    const backup = parseBackup(text);
                    if (
                      !window.confirm(
                        `将用备份中的 ${backup.snapshot.events.length} 件事项、${backup.snapshot.photos.length} 张图片替换本机资料。是否继续？建议先导出当前备份。`,
                      )
                    )
                      return;
                    await app.restore(text);
                  });
                }}
              />
            </label>
          </div>
          <p className="field-help">
            本地模式不跨设备同步。卸载 APK
            或清除应用数据会清除本机资料；网页版清除网站数据也有同样影响。
          </p>
        </div>
        <div className="setting-block">
          <h3>中国大陆假期</h3>
          <p>
            {policy.configured
              ? `已收录 ${app.today.slice(0, 4)} 年法定放假与调休安排。`
              : `${app.today.slice(0, 4)} 年的官方安排尚未收录，日期不会被猜测。`}
          </p>
          {policy.source && (
            <p>
              <a href={policy.source} target="_blank" rel="noreferrer">
                查看官方政策
              </a>
              <span className="field-help"> · 发布于 {policy.publishedAt}</span>
            </p>
          )}
          <p className="field-help">
            周末、法定放假和补班分开标记；学校寒暑假、单位自定假期不纳入。
          </p>
          <details className="advanced-settings">
            <summary>高级：假期数据同步</summary>
            <label className="field">
              已审核的假期 JSON 地址
              <input
                type="url"
                value={url}
                maxLength={1000}
                placeholder="https://…/holidays.json"
                onChange={(event) => setUrl(event.target.value)}
              />
            </label>
            <p className="field-help">
              由项目维护者核对官方通知后更新数据文件。配置后启动时联网同步，失败时保留现有数据；只获取公开政策，不上传个人事项。
            </p>
            <button
              type="button"
              className="secondary-button"
              disabled={working || app.busy || !url.trim()}
              onClick={() =>
                void run(async () => {
                  await app.updatePolicies(url.trim());
                  await app.saveSettings(url.trim());
                })
              }
            >
              <RefreshCw />
              保存并同步
            </button>
          </details>
        </div>
        <div className="setting-block">
          <h3>提醒与离线识别</h3>
          <p>
            新事项默认不提醒。选择提醒时才申请系统通知权限；Android 版滚动安排未来 60
            天的提醒，全天事项以北京时间 09:00 为基准，实际送达受系统节电策略影响。
          </p>
          <p>中文、英文 OCR 模型随安装包内置，图片在设备上识别，识别结果由你核对。</p>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <p className="about-line">
          朝夕●一日一记 · 0.1.0
          <br />
          学习、工作，也记生活。
        </p>
      </div>
    </Sheet>
  );
}
