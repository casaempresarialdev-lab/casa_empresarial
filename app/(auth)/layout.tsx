export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--color-brand-light) 0%, var(--color-bg-default) 100%)' }}>
      <div className="w-full px-4 py-8">
        {children}
      </div>
    </div>
  )
}
