import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DomainGate — Custom domain verification",
  description: "Learn how DNS TXT challenges verify custom-domain control.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
