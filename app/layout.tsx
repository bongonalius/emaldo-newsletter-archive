import './globals.css'
import React from 'react'

export const metadata = {
  title: 'Emaldo® Newsletter Archive',
  description: 'Internal archive of Klaviyo campaigns'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">{children}</body>
    </html>
  )
}
