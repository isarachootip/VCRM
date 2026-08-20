import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: "VCRM | Enterprise CRM & Object Lists Engine",
  description: 'VCRM - OmniService CRM, Lists & Segments Management, and Sales Pipeline',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-[#f5f6f8] text-[#323338]">
        {children}
      </body>
    </html>
  );
}
