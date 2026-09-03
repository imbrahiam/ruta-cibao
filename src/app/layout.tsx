import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ruta Cibao",
  description:
    "Civic map for the province of Santiago Rodriguez: places, businesses, ecotourism routes, traffic reports and citizen consultations.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-DO">
      <body>{children}</body>
    </html>
  );
}
