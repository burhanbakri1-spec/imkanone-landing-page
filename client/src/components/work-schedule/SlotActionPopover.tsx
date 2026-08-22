import { useEffect, useRef } from "react";

type Props = {
  x: number;
  y: number;
  onEdit: () => void;
  onRemove: () => void;
  onClose: () => void;
};

/** Popover that appears when clicking a time slot — Edit / Remove (Wix behavior). */
export function SlotActionPopover({ x, y, onEdit, onRemove, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="ws-slot-pop"
      style={{ left: Math.min(x, window.innerWidth - 180), top: y }}
      role="menu"
    >
      <button type="button" role="menuitem" onClick={onEdit}>
        Edit
      </button>
      <button type="button" role="menuitem" className="is-danger" onClick={onRemove}>
        Remove
      </button>
    </div>
  );
}
