import { ArrowUpRight, ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { Category, Occurrence, PhotoMeta } from '../domain/model';
import { reminderLabels, repeatLabels } from '../domain/model';
import type { Repository } from '../platform/repository';
import { PhotoAttachment } from './PhotoAttachment';

export function categoryStyle(category: Category | undefined): CSSProperties {
  const hex = category?.color ?? '#596b85';
  const n = Number.parseInt(hex.slice(1), 16);
  return {
    '--category-color': hex,
    '--category-wash': `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},.10)`,
  } as CSSProperties;
}

interface Props {
  items: Occurrence[];
  categories: Category[];
  completed: string[];
  photos: PhotoMeta[];
  repository: Repository;
  busy: boolean;
  onToggle(item: Occurrence): void;
  onEdit(item: Occurrence): void;
  onDelete(item: Occurrence, scope: 'one' | 'series'): void;
  onAdd(): void;
}

export function EventDeck(props: Props) {
  const {
    items,
    categories,
    completed,
    photos,
    repository,
    busy,
    onToggle,
    onEdit,
    onDelete,
    onAdd,
  } = props;
  const [index, setIndex] = useState(0),
    [expanded, setExpanded] = useState(false),
    [open, setOpen] = useState(false);
  const frame = useRef<HTMLDivElement>(null),
    front = useRef<HTMLDivElement>(null),
    preview = useRef<HTMLDivElement>(null);
  const [direction, setDirection] = useState(1);
  const motion = useRef<{ token: number; busy: boolean; animations: Animation[] }>({
    token: 0,
    busy: false,
    animations: [],
  });
  const drag = useRef<{ id: number; x: number; y: number; dx: number; horizontal: boolean } | null>(
    null,
  );
  const clickUntil = useRef(0);
  const identity = items.map((item) => item.key).join('|');
  const selected = items[index % Math.max(1, items.length)];
  const behind = items[(index + direction + items.length) % Math.max(1, items.length)];

  // biome-ignore lint/correctness/useExhaustiveDependencies: identity 是发生项集合的重置令牌，勾选完成不应触发重置。
  useEffect(() => {
    setIndex(0);
    setExpanded(false);
    setOpen(false);
    motion.current.token++;
    motion.current.busy = false;
    for (const animation of motion.current.animations) animation.cancel();
    motion.current.animations = [];
    drag.current = null;
    frame.current?.style.removeProperty('--drag-x');
    frame.current?.style.removeProperty('--drag-turn');
    // identity 只随日期/筛选结果变化，完成勾选不重置当前卡片。
    return () => {
      motion.current.token++;
      for (const animation of motion.current.animations) animation.cancel();
    };
  }, [identity]);

  const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const clearDrag = () => {
    frame.current?.classList.remove('dragging');
    frame.current?.style.removeProperty('--drag-x');
    frame.current?.style.removeProperty('--drag-turn');
    frame.current?.style.removeProperty('--drag-progress');
  };

  const switchCard = async (delta: number, fromX = 0) => {
    const card = front.current,
      deck = frame.current;
    if (!card || !deck || motion.current.busy || items.length < 2) return;
    motion.current.busy = true;
    const token = ++motion.current.token;
    const focus = document.activeElement?.getAttribute('data-card-action');
    setDirection(delta);
    setOpen(false);
    clearDrag();
    try {
      if (!reduced() && typeof card.animate === 'function') {
        const sign = delta > 0 ? -1 : 1;
        const out = card.animate(
          [
            { transform: `translateX(${fromX}px) rotate(${fromX / 30}deg)`, opacity: 1 },
            {
              transform: `translateX(${sign * deck.clientWidth * 0.75}px) rotate(${sign * 8}deg)`,
              opacity: 0,
            },
          ],
          { duration: 190, easing: 'cubic-bezier(.3,.1,.4,1)', fill: 'forwards' },
        );
        motion.current.animations.push(out);
        await out.finished.catch(() => {});
      }
      if (token !== motion.current.token) return;
      for (const animation of motion.current.animations) animation.cancel();
      motion.current.animations = [];
      setIndex((value) => (value + delta + items.length) % items.length);
      if (!reduced() && typeof card.animate === 'function') {
        const incoming = card.animate(
          [
            { transform: 'translateY(10px) scale(.97)', opacity: 0.8 },
            { transform: 'translateY(0) scale(1)', opacity: 1 },
          ],
          { duration: 170, easing: 'cubic-bezier(.2,.8,.2,1)' },
        );
        motion.current.animations.push(incoming);
        await incoming.finished.catch(() => {});
      }
      if (focus && token === motion.current.token)
        frame.current?.parentElement
          ?.querySelector<HTMLButtonElement>(`[data-card-action="${focus}"]`)
          ?.focus({ preventScroll: true });
    } finally {
      if (token === motion.current.token) {
        motion.current.busy = false;
        motion.current.animations = [];
      }
    }
  };

  const pointerStart = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (
      items.length < 2 ||
      open ||
      motion.current.busy ||
      event.button !== 0 ||
      event.isPrimary === false
    )
      return;
    drag.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      dx: 0,
      horizontal: false,
    };
  };
  const pointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const state = drag.current;
    if (!state || event.pointerId !== state.id) return;
    const dx = event.clientX - state.x,
      dy = event.clientY - state.y;
    state.dx = dx;
    if (!state.horizontal) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx) * 1.15) {
        drag.current = null;
        return;
      }
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.15) return;
      state.horizontal = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    setDirection(dx < 0 ? 1 : -1);
    frame.current?.classList.add('dragging');
    frame.current?.style.setProperty('--drag-x', `${Math.max(-300, Math.min(300, dx))}px`);
    frame.current?.style.setProperty('--drag-turn', `${Math.max(-8, Math.min(8, dx / 30))}deg`);
    frame.current?.style.setProperty('--drag-progress', `${Math.min(1, Math.abs(dx) / 140)}`);
  };
  const pointerEnd = (event: ReactPointerEvent<HTMLButtonElement>, cancelled = false) => {
    const state = drag.current;
    if (!state || event.pointerId !== state.id) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (!state.horizontal) return;
    clickUntil.current = Date.now() + 450;
    const threshold = Math.max(38, Math.min(70, (frame.current?.clientWidth ?? 360) * 0.18));
    if (!cancelled && Math.abs(state.dx) >= threshold)
      void switchCard(state.dx < 0 ? 1 : -1, state.dx);
    else {
      clearDrag();
      if (!reduced())
        front.current?.animate?.(
          [
            { transform: `translateX(${state.dx}px) rotate(${state.dx / 30}deg)` },
            { transform: 'none' },
          ],
          { duration: 180, easing: 'ease-out' },
        );
    }
  };

  const category = (item: Occurrence) =>
    categories.find((value) => value.id === item.fields.categoryId);
  const body = (item: Occurrence) => (
    <div className="event-body">
      <p className="event-repeat">
        {reminderLabels[item.fields.reminder]}
        {item.event.repeat !== 'none' ? ` · ${repeatLabels[item.event.repeat]}` : ''}
      </p>
      {item.fields.location && (
        <p className="event-location">
          {item.fields.location.startsWith('https://') ||
          item.fields.location.startsWith('http://') ? (
            <a href={item.fields.location} target="_blank" rel="noreferrer">
              打开通知中的链接
            </a>
          ) : (
            item.fields.location
          )}
        </p>
      )}
      {item.fields.note && <p className="event-note">{item.fields.note}</p>}
      {photos
        .filter(
          (photo) => photo.eventId === item.event.id && photo.occurrenceDate === item.originalDate,
        )
        .map((photo) => (
          <PhotoAttachment key={photo.id} photo={photo} repository={repository} />
        ))}
      <label className="check-line">
        <input
          type="checkbox"
          checked={completed.includes(item.key)}
          onChange={() => onToggle(item)}
          disabled={busy}
        />
        标记本次完成
      </label>
      <div className="event-actions">
        <button type="button" className="text-button" disabled={busy} onClick={() => onEdit(item)}>
          <Pencil />
          编辑
        </button>
        <button
          type="button"
          className="text-button danger"
          disabled={busy}
          onClick={() => {
            if (
              window.confirm(
                item.event.repeat !== 'none'
                  ? '仅删除这一次事项？其他重复日期会保留。'
                  : '删除这件事及其附件？',
              )
            )
              onDelete(item, 'one');
          }}
        >
          <Trash2 />
          删除本次
        </button>
        {item.event.repeat !== 'none' && (
          <button
            type="button"
            className="text-button danger"
            disabled={busy}
            onClick={() => {
              if (window.confirm('删除整个重复系列及其附件？')) onDelete(item, 'series');
            }}
          >
            删除整个系列
          </button>
        )}
      </div>
    </div>
  );
  const summary = (item: Occurrence) => (
    <>
      <span className="glass-topline">
        <span className="category-label">{category(item)?.name ?? '未分类'}</span>
        <span className="event-time">
          {item.fields.time
            ? `${item.fields.time}${item.fields.endTime ? `–${item.fields.endTime}` : ''}`
            : '全天'}
        </span>
      </span>
      <span className="glass-title">{item.fields.title}</span>
      <span className="glass-bottomline">
        <span>
          {completed.includes(item.key) ? '✓ 本次已完成' : item.fields.location || '已记在这一天'}
        </span>
        <span className="detail-label">
          详情 <ArrowUpRight />
        </span>
      </span>
    </>
  );

  if (!selected)
    return (
      <div className="empty-state glass-empty">
        <span className="empty-flower" aria-hidden="true">
          ✳
        </span>
        <h3>把想到的事，先记下来。</h3>
        <p>面试、截止日期，或生活中的一个小约定。</p>
        <button type="button" className="primary-button" onClick={onAdd}>
          记下第一件事
        </button>
      </div>
    );

  return (
    <div className="event-deck-region">
      {expanded ? (
        <div className="flat-events">
          {items.map((item) => (
            <details className="flat-event" key={item.key} style={categoryStyle(category(item))}>
              <summary className="glass-summary">{summary(item)}</summary>
              {body(item)}
            </details>
          ))}
        </div>
      ) : (
        <div className="glass-deck" ref={frame}>
          <div className="deck-atmosphere" aria-hidden="true" />
          {items.length > 2 && <div className="glass-back-layer" aria-hidden="true" />}
          {items.length > 1 && behind && (
            <div
              className="glass-preview"
              ref={preview}
              aria-hidden="true"
              style={categoryStyle(category(behind))}
            >
              {summary(behind)}
            </div>
          )}
          <div className="glass-card" ref={front} style={categoryStyle(category(selected))}>
            <button
              type="button"
              className="glass-summary"
              aria-expanded={open}
              aria-label={`${selected.fields.title}，${open ? '收起' : '查看'}详情`}
              onPointerDown={pointerStart}
              onPointerMove={pointerMove}
              onPointerUp={pointerEnd}
              onPointerCancel={(event) => pointerEnd(event, true)}
              onClick={() => {
                if (Date.now() >= clickUntil.current) setOpen(!open);
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                  event.preventDefault();
                  void switchCard(event.key === 'ArrowRight' ? 1 : -1);
                }
              }}
            >
              {summary(selected)}
            </button>
            {open && body(selected)}
          </div>
        </div>
      )}
      {items.length > 1 && (
        <div className="stack-controls">
          <div className="stack-stepper">
            {!expanded && (
              <>
                <button
                  type="button"
                  className="round-button"
                  data-card-action="previous"
                  aria-label="上一件事项"
                  onClick={() => void switchCard(-1)}
                >
                  <ChevronLeft />
                </button>
                <span className="stack-counter" aria-live="polite">
                  {(index % items.length) + 1}
                  <span> / {items.length}</span>
                </span>
                <button
                  type="button"
                  className="round-button"
                  data-card-action="next"
                  aria-label="下一件事项"
                  onClick={() => void switchCard(1)}
                >
                  <ChevronRight />
                </button>
              </>
            )}
          </div>
          <button
            type="button"
            className="text-button"
            aria-expanded={expanded}
            onClick={() => {
              motion.current.token++;
              motion.current.busy = false;
              for (const animation of motion.current.animations) animation.cancel();
              clearDrag();
              setExpanded(!expanded);
            }}
          >
            {expanded ? '收起成叠卡 ↑' : '展开全部 ↗'}
          </button>
        </div>
      )}
    </div>
  );
}
