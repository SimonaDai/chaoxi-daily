import { X } from 'lucide-react';
import { type ReactNode, useEffect, useRef } from 'react';

export function Sheet({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose(): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const target = dialog.current;
    target?.showModal();
    return () => target?.close();
  }, []);
  return (
    <dialog
      className="sheet"
      ref={dialog}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      aria-label={title}
    >
      <div className="sheet-handle" aria-hidden="true" />
      <header className="sheet-header">
        <h2>{title}</h2>
        <button type="button" className="icon-button" aria-label="关闭" onClick={onClose}>
          <X />
        </button>
      </header>
      {children}
    </dialog>
  );
}
