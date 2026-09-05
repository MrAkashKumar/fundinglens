import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'FundingLens — Private Wealth Portfolio Review',
  description:
    'Evidence-backed investment exceptions, portfolio reviews and RM-reviewed client alerts.',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
