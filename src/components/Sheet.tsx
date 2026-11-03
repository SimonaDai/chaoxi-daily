import { X } from 'lucide-react';
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react';

export function Sheet({
  title,
  children,
  onClose,
  footer,
  fullHeight = false,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  fullHeight?: boolean;
  onClose(): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [closing, setClosing] = useState(false);
  const [viewport, setViewport] = useState({ height: window.innerHeight, bottom: 0 });
  const closeTimer = useRef<number | undefined>(undefined);
  const requestClose = () => {
    if (closing) return;
    setClosing(true);
    closeTimer.current = window.setTimeout(
      () => {
        onClose();
        setClosing(false);
      },
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180,
    );
  };
  useEffect(() => {
    const target = dialog.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const update = () => {
      const visual = window.visualViewport;
      setViewport({
        height: visual?.height ?? window.innerHeight,
        bottom: Math.max(
          0,
          window.innerHeight - (visual?.height ?? window.innerHeight) - (visual?.offsetTop ?? 0),
        ),
      });
    };
    update();
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    target?.showModal();
    return () => {
      window.clearTimeout(closeTimer.current);
      document.body.style.overflow = overflow;
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      target?.close();
    };
  }, []);
  return (
    <dialog
      className={`sheet ${fullHeight ? 'sheet-full' : ''} ${closing ? 'is-closing' : ''}`}
      style={
        {
          '--sheet-viewport-height': `${viewport.height}px`,
          '--sheet-bottom': `${viewport.bottom}px`,
        } as CSSProperties
      }
      ref={dialog}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      aria-label={title}
    >
      <div className="sheet-handle" aria-hidden="true" />
      <header className="sheet-header">
        <h2>{title}</h2>
        <button type="button" className="icon-button" aria-label="关闭" onClick={requestClose}>
          <X />
        </button>
      </header>
      <div className="sheet-body">{children}</div>
      {footer && <div className="sheet-footer">{footer}</div>}
    </dialog>
  );
}
