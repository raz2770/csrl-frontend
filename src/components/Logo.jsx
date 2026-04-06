/** CSRL logo — matches standalone prototype SVG */
export default function Logo({ size = 56 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="60" cy="60" r="58" fill="#1a4fa0" />
      <path
        d="M20 60 Q30 30 60 25 Q90 30 100 60"
        fill="none"
        stroke="#f5a623"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M18 65 Q25 90 60 100 Q95 90 102 65"
        fill="none"
        stroke="#f5a623"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="55" cy="42" r="7" fill="#fff" />
      <line x1="55" y1="49" x2="55" y2="68" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="55" y1="55" x2="45" y2="62" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <line x1="55" y1="55" x2="65" y2="60" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <line x1="55" y1="68" x2="49" y2="78" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <line x1="55" y1="68" x2="61" y2="78" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <circle cx="43" cy="55" r="5" fill="#fff" opacity=".7" />
      <line x1="43" y1="60" x2="43" y2="72" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <line x1="43" y1="72" x2="38" y2="80" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="43" y1="72" x2="48" y2="80" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
      <polygon points="75,20 78,28 86,28 80,33 82,41 75,36 68,41 70,33 64,28 72,28" fill="#f5a623" />
    </svg>
  );
}
