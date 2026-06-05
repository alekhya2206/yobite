// The YoBite logo mark: magnifier over a healthy bowl with a green check —
// "look closely, eat well, you're good." Colors bound to CSS vars so it adapts
// to dark mode. ids are suffixed to stay unique when rendered more than once.

let counter = 0;

export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  const id = `lm-${counter++}`;
  return (
    <svg
      className={`logo-mark${className ? ` ${className}` : ""}`}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
    >
      <line x1="40" y1="40" x2="53" y2="53" stroke="var(--green)" strokeWidth="7.5" strokeLinecap="round" />
      <circle cx="27" cy="27" r="17" fill="var(--surface)" />
      <clipPath id={id}>
        <circle cx="27" cy="27" r="14.5" />
      </clipPath>
      <g clipPath={`url(#${id})`}>
        <path d="M17 30 a10 7 0 0 0 20 0 Z" fill="var(--terra)" />
        <path d="M18 30 a9 8 0 0 1 18 0 Z" fill="var(--green)" />
        <path d="M27 21 C22.5 21 20.5 17.5 21.5 13 C26 13 28.5 16.5 27 21 Z" fill="#6BBE92" />
      </g>
      <circle cx="27" cy="27" r="17" fill="none" stroke="var(--green)" strokeWidth="5.5" />
      <circle cx="49" cy="16" r="11.5" fill="var(--paper)" />
      <circle cx="49" cy="16" r="9" fill="var(--green)" />
      <path d="M44.5 16.2 l3 3 l6 -6.6" fill="none" stroke="var(--paper)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark({ size = 24 }: { size?: number }) {
  return (
    <span
      style={{ fontFamily: "var(--display)", fontWeight: 600, fontSize: size, letterSpacing: "-.01em", color: "var(--ink)" }}
    >
      Yo<b style={{ fontWeight: 600, color: "var(--green)" }}>Bite</b>
    </span>
  );
}
