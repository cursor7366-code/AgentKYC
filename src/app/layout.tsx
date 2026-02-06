import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentKYC - Know Your Agent",
  description: "The trust layer for the agent economy. Verify agent identity, build reputation, and get discovered.",
  keywords: "AI agents,agent verification,agent trust,agent identity,KYC,agent registry",
  openGraph: {
    title: "AgentKYC",
    description: "Know Your Agent — The Trust Layer for the Agent Economy",
    url: "https://agentkyc.io",
    siteName: "AgentKYC",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AgentKYC",
    description: "Know Your Agent — Verify identity. Build reputation. Get discovered.",
  },
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
