type ExclamationHexagonIconProps = {
  size?: number | string;
  color?: string;
  strokeWidth?: number;
  background?: string;
  opacity?: number;
  rotation?: number;
  shadow?: number;
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  padding?: number;
  className?: string;
};

function ExclamationHexagonIcon({
  size,
  color,
  strokeWidth = 2,
  background = 'transparent',
  opacity = 1,
  rotation = 0,
  shadow = 0,
  flipHorizontal = false,
  flipVertical = false,
  padding = 0,
  className,
}: ExclamationHexagonIconProps) {
  const transforms: string[] = [];
  if (rotation !== 0) transforms.push(`rotate(${rotation}deg)`);
  if (flipHorizontal) transforms.push('scaleX(-1)');
  if (flipVertical) transforms.push('scaleY(-1)');

  const viewBoxSize = 24 + padding * 2;
  const viewBoxOffset = -padding;
  const viewBox = `${viewBoxOffset} ${viewBoxOffset} ${viewBoxSize} ${viewBoxSize}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{
        color: color ?? undefined,
        opacity,
        transform: transforms.join(' ') || undefined,
        filter: shadow > 0 ? `drop-shadow(0 ${shadow}px ${shadow * 2}px rgba(0,0,0,0.3))` : undefined,
        backgroundColor: background !== 'transparent' ? background : undefined,
      }}
    >
      <path d="M3.701 15.734V8.266a1.79 1.79 0 0 1 .89-1.542l6.52-3.734a1.77 1.77 0 0 1 1.778 0l6.473 3.734a1.79 1.79 0 0 1 .937 1.542v7.468a1.79 1.79 0 0 1-.89 1.542l-6.52 3.734a1.77 1.77 0 0 1-1.778 0l-6.473-3.735a1.79 1.79 0 0 1-.937-1.54m8.294-8.995v6.319" />
      <path d="M12.044 16.553h-.01" />
    </svg>
  );
}

export default ExclamationHexagonIcon;
