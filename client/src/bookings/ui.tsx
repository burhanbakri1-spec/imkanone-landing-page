import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";

export function PageHeader({
  title,
  count,
  subtitle,
  breadcrumb,
  actions,
}: {
  title: string;
  count?: number | string;
  subtitle?: ReactNode;
  breadcrumb?: { label: string; to?: string }[];
  actions?: ReactNode;
}) {
  return (
    <header className="bk-header">
      <div className="bk-header-text">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav className="bk-breadcrumb" aria-label="Breadcrumb">
            {breadcrumb.map((b, i) => (
              <span key={`${b.label}-${i}`}>
                {i > 0 && <span aria-hidden="true"> / </span>}
                {b.to ? <Link to={b.to}>{b.label}</Link> : <span>{b.label}</span>}
              </span>
            ))}
          </nav>
        )}
        <h1 className="bk-title">
          {title}
          {count !== undefined && (
            <span className="bk-title-count">{count}</span>
          )}
        </h1>
        {subtitle && <div className="bk-subtitle">{subtitle}</div>}
      </div>
      {actions && <div className="bk-header-actions">{actions}</div>}
    </header>
  );
}

export function ActionMenu({
  label,
  items,
  align = "right",
  variant = "secondary",
}: {
  label: string;
  items: { label: string; onClick?: () => void; to?: string; danger?: boolean }[];
  align?: "left" | "right";
  variant?: "primary" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const t = window.setTimeout(() => document.addEventListener("mousedown", close), 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", close);
    };
  }, [open]);

  return (
    <div className="bk-menu-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`bk-btn ${variant === "primary" ? "bk-btn-primary" : "bk-btn-secondary"}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        {label}
      </button>
      {open && (
        <div
          className="bk-menu"
          role="menu"
          style={align === "left" ? { left: 0, right: "auto" } : undefined}
        >
          {items.map((item) =>
            item.to ? (
              <Link
                key={item.label}
                role="menuitem"
                to={item.to}
                className={item.danger ? "bk-btn-danger" : undefined}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className={item.danger ? "bk-btn-danger" : undefined}
                onClick={() => {
                  setOpen(false);
                  item.onClick?.();
                }}
              >
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children?: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const titleId = useId();
  return (
    <div className="bk-modal-backdrop" onClick={onClose}>
      <div
        className={wide ? "bk-sheet" : "bk-modal"}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="bk-modal-close"
          aria-label="Close"
          onClick={onClose}
        >
          ×
        </button>
        <h2 id={titleId}>{title}</h2>
        {subtitle && <p className="bk-modal-sub">{subtitle}</p>}
        {children}
        {footer && <div className="bk-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className="bk-switch"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
    />
  );
}

export function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M11 5v5h5v1h-5v5h-1v-5H5v-1h5V5h1z"
      />
    </svg>
  );
}

export function PrimaryButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className, ...rest } = props;
  return (
    <button
      type="button"
      className={`bk-btn bk-btn-primary${className ? ` ${className}` : ""}`}
      {...rest}
    />
  );
}
