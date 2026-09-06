export function Logo() {
  return (
    <>
      <svg
        aria-hidden="true"
        focusable="false"
        width="16"
        height="16"
        viewBox="0 0 32 32"
        style={{ flexShrink: 0 }}
      >
        <mask id="pf-logo-cut">
          <rect width="32" height="32" fill="#fff" />
          <g fill="none" stroke="#000" strokeWidth="6" strokeLinecap="round">
            <circle cx="22" cy="21" r="5.5" />
            <path d="M25.9 24.9 28.5 27.5" />
          </g>
        </mask>
        <path fill="var(--folder)" mask="url(#pf-logo-cut)" d="M2 4h10l2 4h12v16H2z" />
        <g fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round">
          <path d="M25.9 24.9 28.5 27.5" />
          <circle cx="22" cy="21" r="5.5" />
        </g>
      </svg>
      <span className="logo-word">partyfinder</span>
    </>
  );
}
