export default function Embleme({ taille = 44 }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#0E6B43" />
      <path d="M14 18h36a6 6 0 0 1 6 6v16a6 6 0 0 1-6 6H30l-10 8v-8h-6a6 6 0 0 1-6-6V24a6 6 0 0 1 6-6z" fill="#F6C21C" />
      <path d="M32 23l2.6 5.6 6.1.6-4.6 4 1.4 6-5.5-3.2-5.5 3.2 1.4-6-4.6-4 6.1-.6z" fill="#D62631" />
    </svg>
  );
}
