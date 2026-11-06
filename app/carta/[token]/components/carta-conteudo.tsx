import { RespostaCarta } from './resposta-carta'

// A carta para leitura e a resposta do candidato
export function CartaConteudo({ token, empresa, conteudo }: { token: string; empresa: string; conteudo: string }) {
  return (
    <>
      <article className="app-card p-6 sm:p-8">
        {/* Texto puro: o que a empresa escreveu aparece como está, sem interpretar HTML */}
        <p className="text-[15px] leading-7 whitespace-pre-wrap break-words" style={{ color: 'var(--color-text-secondary)' }}>{conteudo}</p>
      </article>
      <section className="app-card p-6 sm:p-8" aria-label="Sua resposta" style={{ animationDelay: '220ms' }}>
        <RespostaCarta token={token} empresa={empresa} />
      </section>
    </>
  )
}
