import { type MouseEvent, type PointerEvent, useRef, useState } from 'react';

type Gesture = {
  id: number;
  x: number;
  y: number;
  lastY: number;
  time: number;
  velocity: number;
  axis: 'x' | 'y' | null;
  start: number;
  progress: number;
  travel: number;
};

/** 手势仅接管日期网格；表单、事项列表和卡片保持各自的滚动行为。 */
export function useCalendarGesture({
  expanded,
  getTravel,
  onExpand,
  onPage,
}: {
  expanded: boolean;
  getTravel(): number;
  onExpand(value: boolean): void;
  onPage(direction: number): void;
}) {
  const gesture = useRef<Gesture | null>(null);
  const suppressClick = useRef(false);
  const [drag, setDrag] = useState<{ progress: number; x: number } | null>(null);
  const cancel = () => {
    gesture.current = null;
    setDrag(null);
  };
  return {
    progress: drag?.progress ?? (expanded ? 1 : 0),
    offset: drag?.x ?? 0,
    dragging: drag !== null,
    handlers: {
      onPointerDown(event: PointerEvent<HTMLElement>) {
        if (!event.isPrimary) {
          cancel();
          return;
        }
        if (event.button !== 0) return;
        suppressClick.current = false;
        gesture.current = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          lastY: event.clientY,
          time: event.timeStamp,
          velocity: 0,
          axis: null,
          start: expanded ? 1 : 0,
          progress: expanded ? 1 : 0,
          travel: Math.max(1, getTravel()),
        };
      },
      onPointerMove(event: PointerEvent<HTMLElement>) {
        const current = gesture.current;
        if (!current || current.id !== event.pointerId) return;
        const dx = event.clientX - current.x;
        const dy = event.clientY - current.y;
        if (!current.axis && Math.hypot(dx, dy) < 10) return;
        if (!current.axis) {
          current.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        suppressClick.current = true;
        current.velocity =
          (event.clientY - current.lastY) / Math.max(1, event.timeStamp - current.time);
        current.lastY = event.clientY;
        current.time = event.timeStamp;
        current.progress = Math.max(0, Math.min(1, current.start + dy / current.travel));
        setDrag({
          progress: current.axis === 'y' ? current.progress : current.start,
          x: current.axis === 'x' ? dx * 0.65 : 0,
        });
      },
      onPointerUp(event: PointerEvent<HTMLElement>) {
        const current = gesture.current;
        if (!current || current.id !== event.pointerId) return;
        const dx = event.clientX - current.x;
        const dy = event.clientY - current.y;
        if (current.axis === 'y') {
          const fast =
            event.timeStamp - current.time < 100 &&
            Math.abs(current.velocity) > 0.45 &&
            Math.abs(dy) > 24;
          onExpand(fast ? current.velocity > 0 : current.progress >= 0.5);
        } else if (current.axis === 'x' && Math.abs(dx) >= 50) {
          onPage(dx < 0 ? 1 : -1);
        }
        cancel();
      },
      onPointerCancel: cancel,
      onLostPointerCapture(event: PointerEvent<HTMLElement>) {
        // 触摸按钮的隐式捕获转交给网格时，子按钮也会冒泡此事件。
        if (event.target === event.currentTarget) cancel();
      },
      onClickCapture(event: MouseEvent<HTMLElement>) {
        if (suppressClick.current && event.detail !== 0) {
          event.preventDefault();
          event.stopPropagation();
          suppressClick.current = false;
        }
      },
    },
  };
}
