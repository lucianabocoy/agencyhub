export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, background: '#0f1117', color: '#e4e6ee', fontFamily: 'system-ui, sans-serif' }}>
        {children}
      </body>
    </html>
  )
}
