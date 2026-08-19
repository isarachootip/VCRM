import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: "Monday CRM | Isarachootip's Team Global",
  description: 'Work OS & CRM Deals Pipeline Clone',
  icons: {
    icon: 'https://cdn.monday.com/favicon-monday-v4.png',
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
