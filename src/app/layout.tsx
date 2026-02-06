import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ozzy Captions | $0.00 Auto-Captioning",
  description: "High-precision local transcription using Whisper AI and Remotion.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
