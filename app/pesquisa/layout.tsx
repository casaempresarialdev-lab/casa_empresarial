import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pesquisa',
  robots: 'noindex',
}

// Página pública da pesquisa: tela cheia, com a troca de perguntas animada
export default function PesquisaLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        html, body { height: 100%; overflow: hidden; }

        @keyframes sInUp   { from { opacity:0; transform:translateY(28px) } to { opacity:1; transform:translateY(0) } }
        @keyframes sOutUp  { from { opacity:1; transform:translateY(0) } to { opacity:0; transform:translateY(-24px) } }
        @keyframes sInDown { from { opacity:0; transform:translateY(-28px) } to { opacity:1; transform:translateY(0) } }
        @keyframes sOutDown{ from { opacity:1; transform:translateY(0) } to { opacity:0; transform:translateY(24px) } }

        .s-enter-fwd  { animation: sInUp    0.32s cubic-bezier(0.22,1,0.36,1) both }
        .s-exit-fwd   { animation: sOutUp   0.2s ease-in both }
        .s-enter-back { animation: sInDown  0.32s cubic-bezier(0.22,1,0.36,1) both }
        .s-exit-back  { animation: sOutDown 0.2s ease-in both }

        @media (prefers-reduced-motion: reduce) {
          .s-enter-fwd, .s-exit-fwd, .s-enter-back, .s-exit-back { animation: none }
        }
      `}</style>
      {children}
    </>
  )
}
