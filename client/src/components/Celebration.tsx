import { useMemo } from "react";

const CONFETTI_COLORS = ["#D94F30", "#F5CB5C", "#1B4965", "#059669", "#E06B52", "#2A6F97"];

export const ConfettiCelebration = () => {
  const pieces = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        delay: `${Math.random() * 0.6}s`,
        size: 6 + Math.random() * 8,
        rotation: Math.random() * 360,
      })),
    [],
  );

  return (
    <div className="confetti-container">
      {pieces.map((piece) => (
        <div
          key={piece.id}
          className="confetti-piece"
          style={{
            left: piece.left,
            backgroundColor: piece.color,
            animationDelay: piece.delay,
            width: piece.size,
            height: piece.size,
            borderRadius: piece.size > 10 ? "50%" : "2px",
            transform: `rotate(${piece.rotation}deg)`,
          }}
        />
      ))}
    </div>
  );
};

export const StarIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="inline-block animate-star-burst">
    <path
      d="M24 4L29.5 17.5H44L32.5 26.5L36 40L24 32L12 40L15.5 26.5L4 17.5H18.5L24 4Z"
      fill="#F5CB5C"
      stroke="#E8B84B"
      strokeWidth="1.5"
    />
  </svg>
);

export const LockIcon = ({ size = 56 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className="mx-auto">
    <rect x="8" y="24" width="40" height="28" rx="4" fill="#E2DDD5" stroke="#C4BFB7" strokeWidth="2" />
    <path
      d="M16 24V18C16 11.4 21.4 6 28 6C34.6 6 40 11.4 40 18V24"
      stroke="#C4BFB7"
      strokeWidth="2.5"
      strokeLinecap="round"
      fill="none"
    />
    <circle cx="28" cy="38" r="3" fill="#C4BFB7" />
  </svg>
);

export const SmallStarIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path
      d="M7 1L8.5 5H13L9.5 7.5L10.5 11.5L7 9L3.5 11.5L4.5 7.5L1 5H5.5L7 1Z"
      fill="#F5CB5C"
      stroke="#E8B84B"
      strokeWidth="0.8"
    />
  </svg>
);
