import { ImagePlus, ScanText } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { emptyFields } from '../domain/model';
import { type NoticeDraft, parseNotice } from '../domain/notice';
import { validateImage } from '../platform/images';
import { cancelRecognition, recognizeNotice } from '../platform/ocr';
import { Sheet } from './Sheet';

export function ImportNotice({
  onClose,
  onDraft,
}: {
  onClose(): void;
  onDraft(draft: NoticeDraft, photo: File | null): void;
}) {
  const [file, setFile] = useState<File | null>(null),
    [url, setUrl] = useState(''),
    [text, setText] = useState('');
  const [progress, setProgress] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const active = useRef(true),
    operation = useRef(0);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      operation.current++;
      void cancelRecognition();
    };
  }, []);
  useEffect(() => {
    if (!file) return;
    const value = URL.createObjectURL(file);
    setUrl(value);
    return () => URL.revokeObjectURL(value);
  }, [file]);
  const recognize = async () => {
    if (!file || busy) return;
    const token = ++operation.current;
    setBusy(true);
    setError('');
    setProgress(0);
    try {
      const result = await recognizeNotice(file, (value) => {
        if (active.current && token === operation.current) setProgress(value);
      });
      if (!active.current || token !== operation.current) return;
      if (!result) throw new Error('没有识别出清晰文字。可以换一张截图，或选择仅附图后手动填写。');
      setText(result);
    } catch (value) {
      if (active.current && token === operation.current)
        setError(value instanceof Error ? value.message : '识别失败，请手动填写或重试。');
    } finally {
      if (active.current && token === operation.current) setBusy(false);
    }
  };
  return (
    <Sheet title="从截图记录" onClose={onClose}>
      <div className="import-content">
        <p className="sheet-intro">把通知放进来，重要的信息就有了位置。</p>
        <label className="image-drop">
          <ImagePlus />
          <span>{file ? '换一张截图' : '选择手机截图'}</span>
          <small>PNG / JPG / WebP · 最多 8 MB</small>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={busy}
            onChange={(event) => {
              const value = event.target.files?.[0];
              if (!value) return;
              try {
                validateImage(value);
                setFile(value);
                setText('');
                setError('');
              } catch (issue) {
                setError(issue instanceof Error ? issue.message : '图片无效');
              }
              event.target.value = '';
            }}
          />
        </label>
        {url && <img className="import-preview" src={url} alt="待识别的通知截图" />}
        <div className="privacy-line">本机识别 · 截图不会上传到 OCR 服务</div>
        {busy ? (
          <div className="ocr-progress" role="status">
            <span>正在识别 {progress}%</span>
            <progress max={100} value={progress} />
            <button
              type="button"
              className="text-button"
              onClick={() => {
                operation.current++;
                void cancelRecognition();
                setBusy(false);
              }}
            >
              取消识别
            </button>
          </div>
        ) : (
          <div className="import-actions">
            <button
              type="button"
              className="primary-button"
              disabled={!file}
              onClick={() => void recognize()}
            >
              <ScanText />
              识别截图文字
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={!file}
              onClick={() =>
                onDraft(
                  {
                    fields: { ...emptyFields(), title: '截图待整理' },
                    date: null,
                    dateCandidates: [],
                    warnings: ['可以先存入待整理，之后再补日期和类型。'],
                  },
                  file,
                )
              }
            >
              仅附图，自己填写
            </button>
          </div>
        )}
        <label className="field">
          通知文字（也可以直接粘贴）
          <textarea
            rows={6}
            maxLength={10000}
            value={text}
            disabled={busy}
            placeholder="粘贴短信或修改识别结果，然后核对填写。"
            onChange={(event) => setText(event.target.value)}
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          className="primary-button full-button"
          disabled={!text.trim() || busy}
          onClick={() => onDraft(parseNotice(text), file)}
        >
          核对并填写事项
        </button>
        <p className="field-help">
          日期不明确或存在多个日期时会保留为空。识别不会自动创建日程，也不会自动开启提醒。
        </p>
      </div>
    </Sheet>
  );
}
