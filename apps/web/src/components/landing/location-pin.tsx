export function LocationPin({ variant }: { variant: "classic" | "lollipop" }) {
  return (
    <svg
      viewBox={variant === "classic" ? "0 0 24 28" : "0 0 24 40"}
      data-pin={variant}
      fill="none"
      aria-hidden="true"
    >
      {variant === "classic" ? (
        <>
          <path
            d="M12 27s10-10.1 10-16A10 10 0 0 0 2 11c0 5.9 10 16 10 16Z"
            fill="currentColor"
          />
          <circle cx="12" cy="11" r="4" fill="#fffaf7" />
        </>
      ) : (
        <>
          <path
            d="M12 19v19"
            stroke="#969088"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <circle cx="12" cy="11" r="10" fill="currentColor" />
        </>
      )}
    </svg>
  );
}
