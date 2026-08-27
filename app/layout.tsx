import type { Metadata } from 'next';
import './globals.css';

const assetBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const siteUrl = process.env.SITE_URL ?? 'https://mulpa-dataset.sp-raible.chatgpt.site';
const socialImage = `${assetBasePath}/og.png?v=20260827`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'MULPA — Multiple-paradigm fNIRS dataset',
  description:
    'Explore the participants, near-whole-head montage, short channels, physiology, and tasks included in the MULPA dataset.',
  openGraph: {
    title: 'MULPA dataset',
    description: 'Near-whole-head fNIRS · short channels · systemic physiology',
    images: [{ url: socialImage, width: 1200, height: 630, alt: 'MULPA dataset montage and physiology preview' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MULPA dataset',
    description: 'Near-whole-head fNIRS · short channels · systemic physiology',
    images: [socialImage],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
