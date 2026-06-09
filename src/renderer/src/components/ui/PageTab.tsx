export function PageTab({
  id,
  active,
  onClick,
  children,
}: {
  id: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      id={id}
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        padding: "6px 16px",
        fontSize: "13px",
        fontWeight: active ? 600 : 400,
        border: "none",
        borderRadius: "6px",
        background: active ? "var(--accent-blue)" : "transparent",
        color: active ? "var(--text-on-accent)" : "var(--text-secondary)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
      }}
    >
      {children}
    </button>
  );
}
