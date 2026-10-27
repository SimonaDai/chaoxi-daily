import { createWorker, OEM, type Worker } from 'tesseract.js';

let worker: Worker | null = null;
let generation = 0;
let controller: AbortController | null = null;

export async function recognizeNotice(
  image: Blob,
  onProgress: (progress: number) => void,
): Promise<string> {
  const current = ++generation;
  controller?.abort();
  const abort = new AbortController();
  controller = abort;
  if (worker) {
    await worker.terminate();
    worker = null;
  }
  const base = new URL('ocr/', document.baseURI).href;
  const languages = await Promise.all(
    ['chi_sim', 'eng'].map(async (code) => {
      const response = await fetch(`${base}${code}.traineddata`, { signal: abort.signal });
      if (!response.ok)
        throw new Error('本机识别模型无法读取，请重新打开应用或重新安装完整安装包。');
      const data = new Uint8Array(await response.arrayBuffer());
      if (data.byteLength < 1_000_000)
        throw new Error('识别模型不完整，可以先保存截图后手动填写。');
      // 上游 7.0.0 初始化对 Lang 对象错误读取 data 作为语言名，使用稳定的字符串语言入口。
      return code;
    }),
  );
  if (abort.signal.aborted) throw new Error('识别已取消。');
  let fail: (reason: Error) => void = () => {};
  const failed = new Promise<never>((_, reject) => {
    fail = reject;
  });
  const onAbort = () => fail(new Error('识别已取消。'));
  abort.signal.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => {
    fail(new Error('识别引擎启动超时，请稍后重试或手动填写。'));
    abort.abort();
  }, 60_000);
  const initialization = createWorker(languages, OEM.LSTM_ONLY, {
    workerPath: `${base}worker.min.js`,
    corePath: `${base}core`,
    langPath: base,
    workerBlobURL: false,
    gzip: false,
    cacheMethod: 'none',
    errorHandler: (reason) => {
      console.error('OCR engine initialization failed', reason);
      fail(new Error('识别引擎启动失败，可以先保存截图后手动填写。'));
    },
    logger: (message) => {
      if (current === generation)
        onProgress(
          Math.round(
            (message.status === 'recognizing text'
              ? 0.25 + message.progress * 0.75
              : message.progress * 0.25) * 100,
          ),
        );
    },
  });
  // 初始化期间取消后，若引擎稍后才返回，立即释放它，避免误写上一张截图的结果。
  void initialization
    .then((value) => {
      if (abort.signal.aborted || current !== generation) void value.terminate();
    })
    .catch(() => {});
  let created: Worker;
  try {
    created = await Promise.race([initialization, failed]);
  } finally {
    clearTimeout(timer);
    abort.signal.removeEventListener('abort', onAbort);
  }
  if (current !== generation) {
    await created.terminate();
    throw new Error('识别已取消。');
  }
  worker = created;
  try {
    const result = await created.recognize(image);
    if (current !== generation) throw new Error('识别已取消。');
    return result.data.text.trim();
  } finally {
    if (worker === created) worker = null;
    await created.terminate();
  }
}

export async function cancelRecognition(): Promise<void> {
  generation++;
  controller?.abort();
  controller = null;
  const current = worker;
  worker = null;
  if (current) await current.terminate();
}
