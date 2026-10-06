import React, { useMemo } from 'react';

interface SvgQrCodeProps {
  value: string;
  size?: number;
  className?: string;
  label?: string;
}

/**
 * Computes a deterministic 25x25 pseudo-QR pattern matrix
 * with authentic finder patterns, timing patterns, and data hash.
 */
function generateQrMatrix(text: string): boolean[][] {
  const N = 25;
  const matrix: boolean[][] = Array.from({ length: N }, () =>
    Array(N).fill(false)
  );

  // 1. Draw 3 Finder Patterns at corners (Top-Left, Top-Right, Bottom-Left)
  const drawFinder = (startX: number, startY: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        // Outer 7x7 square border or inner 3x3 filled square
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        matrix[startY + r][startX + c] = isBorder || isCenter;
      }
    }
  };

  drawFinder(0, 0); // Top-Left
  drawFinder(N - 7, 0); // Top-Right
  drawFinder(0, N - 7); // Bottom-Left

  // 2. Timing patterns (alternating dots between finders)
  for (let i = 8; i < N - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // 3. Simple deterministic hash of text to populate data cells
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }

  // Fill data cells excluding finder zones and timing lines
  let seed = Math.abs(hash);
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const inTopLeftFinder = r < 8 && c < 8;
      const inTopRightFinder = r < 8 && c >= N - 8;
      const inBottomLeftFinder = r >= N - 8 && c < 8;
      const onTimingLine = r === 6 || c === 6;

      if (
        !inTopLeftFinder &&
        !inTopRightFinder &&
        !inBottomLeftFinder &&
        !onTimingLine
      ) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        matrix[r][c] = (seed % 100) > 42;
      }
    }
  }

  return matrix;
}

export const SvgQrCode: React.FC<SvgQrCodeProps> = ({
  value,
  size = 140,
  className = '',
  label,
}) => {
  const matrix = useMemo(() => generateQrMatrix(value), [value]);
  const N = matrix.length;
  const cellSize = 10;
  const viewBoxSize = N * cellSize;

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <svg
        viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
        width={size}
        height={size}
        className="bg-white rounded-md p-1 shadow-2xs"
        style={{ shapeRendering: 'crispEdges' }}
      >
        <rect width={viewBoxSize} height={viewBoxSize} fill="#ffffff" />
        {matrix.map((row, r) =>
          row.map((filled, c) =>
            filled ? (
              <rect
                key={`${r}-${c}`}
                x={c * cellSize}
                y={r * cellSize}
                width={cellSize}
                height={cellSize}
                fill="#0f172a"
              />
            ) : null
          )
        )}
      </svg>
      {label && (
        <span className="mt-1 text-[11px] font-mono font-bold tracking-wider text-slate-800 uppercase">
          {label}
        </span>
      )}
    </div>
  );
};
