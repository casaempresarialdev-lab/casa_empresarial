// Layout próprio do PDV — fullscreen, sem sidebar principal
export default function PDVLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-default)' }}>
      {children}
    </div>
  )
}
