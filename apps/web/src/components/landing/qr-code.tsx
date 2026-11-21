"use client";

import { QRCodeSVG } from "qrcode.react";

/**
 * A QR code drawn locally as SVG: the address never leaves the page, and there
 * is no image service to fail or to learn who scanned what. Ink on white by
 * default, at every theme, because scanners need the contrast.
 */
export function QrCode({
  value,
  label,
  size = 168,
  color = "#121211",
  background = "#ffffff",
  margin = 2,
}: {
  value: string;
  label: string;
  size?: number;
  /** Any dark ink works on a light ground; scanners need the contrast, not black. */
  color?: string;
  background?: string;
  /** The clear border around the code, in modules. */
  margin?: number;
}) {
  return (
    <QRCodeSVG
      value={value}
      size={size}
      marginSize={margin}
      level="M"
      bgColor={background}
      fgColor={color}
      role="img"
      aria-label={label}
      style={{ width: size, height: size }}
      className="rounded-xl"
    />
  );
}
