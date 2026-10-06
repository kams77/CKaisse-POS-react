import React, { useMemo } from 'react';
import { encodeQr, qrSvgPath } from '../utils/qrcode';

interface SvgQrCodeProps {
  value: string;
  size?: number;
  className?: string;
  label?: string;
}

/** QR code réel (norme ISO/IEC 18004), lisible par tout téléphone et par le portique. */
export const SvgQrCode: React.FC<SvgQrCodeProps> = ({ value, size = 140, className = '', label }) => {
  const { path, viewBox } = useMemo(() => {
    try {
      return qrSvgPath(encodeQr(value || ' ', 'M'));
    } catch {
      return { path: '', viewBox: 29 };
    }
  }, [value]);

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <svg
        viewBox={`0 0 ${viewBox} ${viewBox}`}
        width={size}
        height={size}
        role="img"
        aria-label={label ? `QR code ${label}` : 'QR code du billet'}
        className="bg-white rounded-md shadow-2xs"
        style={{ shapeRendering: 'crispEdges' }}
      >
        <rect width={viewBox} height={viewBox} fill="#ffffff" />
        <path d={path} fill="#000000" />
      </svg>
      {label && (
        <span className="mt-1 text-[11px] font-mono font-bold tracking-wider text-slate-800 uppercase">
          {label}
        </span>
      )}
    </div>
  );
};
