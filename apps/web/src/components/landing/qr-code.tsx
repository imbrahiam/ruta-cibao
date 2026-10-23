"use client";

import { QRCodeSVG } from "qrcode.react";

/**
 * A QR code drawn locally as SVG: the address never leaves the page, and there
 * is no image service to fail or to learn who scanned what. Ink on white at
 * every theme, because scanners need the contrast.
 */
export function QrCode({ value, label }: { value: string; label: string }) {
  return (
    <QRCodeSVG
      value={value}
      size={168}
      marginSize={2}
      level="M"
      bgColor="#ffffff"
      fgColor="#121211"
      role="img"
      aria-label={label}
      className="size-[168px] rounded-xl"
    />
  );
}
