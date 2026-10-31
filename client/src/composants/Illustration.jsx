export default function Illustration() {
  return (
    <svg className="illustration" viewBox="0 0 420 300" role="img" aria-label="Deux agents échangent des messages protégés par un cadenas">
      <circle cx="210" cy="150" r="128" fill="#0A5234" />
      <circle cx="210" cy="150" r="96" fill="none" stroke="#F6C21C" strokeWidth="2" strokeDasharray="4 10" />

      <g transform="translate(60 72)">
        <rect width="128" height="62" rx="18" fill="#FFFFFF" />
        <path d="M24 62l-6 20 24-20z" fill="#FFFFFF" />
        <rect x="18" y="18" width="70" height="8" rx="4" fill="#0E6B43" />
        <rect x="18" y="34" width="92" height="8" rx="4" fill="#BFD8C9" />
      </g>

      <g transform="translate(236 170)">
        <rect width="128" height="62" rx="18" fill="#F6C21C" />
        <path d="M104 62l6 20-24-20z" fill="#F6C21C" />
        <rect x="18" y="18" width="92" height="8" rx="4" fill="#5A3E00" />
        <rect x="18" y="34" width="56" height="8" rx="4" fill="#9C7400" />
      </g>

      <g transform="translate(176 112)">
        <rect x="6" y="30" width="56" height="46" rx="10" fill="#D62631" />
        <path d="M16 30v-10a18 18 0 0 1 36 0v10" fill="none" stroke="#D62631" strokeWidth="8" strokeLinecap="round" />
        <path d="M34 44l3 6.5 7 .7-5.3 4.6 1.6 6.9-6.3-3.7-6.3 3.7 1.6-6.9-5.3-4.6 7-.7z" fill="#F6C21C" />
      </g>

      <circle cx="96" cy="222" r="22" fill="#F6C21C" />
      <rect x="74" y="246" width="44" height="30" rx="14" fill="#F6C21C" />
      <circle cx="330" cy="88" r="22" fill="#FFFFFF" />
      <rect x="308" y="112" width="44" height="30" rx="14" fill="#FFFFFF" />
    </svg>
  );
}
