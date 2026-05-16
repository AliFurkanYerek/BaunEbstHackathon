const LOGO_SRC = '/logo.png';

export default function AppLogo({
  className = 'h-12 w-16',
  alt = 'sahAI',
  showText = false,
  textClassName = 'font-bold text-lg leading-tight text-white',
  tagline,
  oval = true,
}) {
  const image = (
    <img
      src={LOGO_SRC}
      alt={alt}
      className={oval ? 'h-full w-full object-cover' : className}
    />
  );

  return (
    <div className="flex items-center gap-3">
      {oval ? (
        <div
          className={`shrink-0 overflow-hidden rounded-full ring-2 ring-white/15 shadow-lg shadow-black/30 ${className}`}
        >
          {image}
        </div>
      ) : (
        image
      )}
      {showText && (
        <div>
          <p className={textClassName}>sahAI</p>
          {tagline && (
            <p className="text-[10px] text-amber-200/50 uppercase tracking-widest">{tagline}</p>
          )}
        </div>
      )}
    </div>
  );
}
