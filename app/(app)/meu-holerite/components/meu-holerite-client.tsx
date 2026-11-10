'use client'

import { useState } from 'react'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { baixarHolerite } from '@/components/modules/folha/baixar-holerite'
import { ListEmpty, ListItem } from '@/components/ui/list-item'
import type { DocumentoHolerite } from '@/lib/folha/holerite'
import { toast } from '@/lib/toast'
import type { Company } from '../../empresa/queries'
import { urlMeuHoleriteAction } from '../actions'

/** Holerite mensal, recibo (férias ou 13º) ou PDF enviado pela contabilidade */
export type ItemHolerite = {
  chave: string
  /** Para ordenar: o mais recente primeiro */
  ordem: string
  titulo: string
  subtitulo: string
  liquido: number | null
  documento: DocumentoHolerite | null
  arquivoId: string | null
  arquivo: string
}

const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function MeuHoleriteClient({ itens, bloqueio, company, employee, responsavel, fonte }: {
  itens: ItemHolerite[]
  bloqueio: string | null
  company: Company | null
  employee: { nome: string; cpf: string | null; cargo: string | null } | null
  responsavel: 'sistema' | 'contabilidade'
  fonte: 'sistema' | 'arquivo'
}) {
  const [baixando, setBaixando] = useState(false)

  async function baixar(item: ItemHolerite) {
    if (!employee || baixando) return
    setBaixando(true)
    try {
      if (item.arquivoId) {
        const r = await urlMeuHoleriteAction(item.arquivoId)
        if ('error' in r) toast.error(r.error ?? 'Não foi possível abrir.')
        else window.open(r.url, '_blank', 'noopener')
      } else if (item.documento) {
        await toast.promise(baixarHolerite({ company, employee, competencia: item.titulo, documento: item.documento, responsavel }, item.arquivo), {
          loading: 'Gerando o PDF…',
          success: 'PDF baixado.',
          error: 'Não foi possível gerar o PDF.',
        })
      }
    } catch {
      // A mensagem de erro já apareceu
    }
    setBaixando(false)
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>Meu holerite</h1>
        <Breadcrumb />
      </div>

      <div className="app-card p-5">
        {bloqueio ? (
          <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>{bloqueio}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {itens.length === 0 && <ListEmpty>{fonte === 'arquivo' ? 'Nenhum holerite enviado ainda.' : 'Nenhuma folha fechada ainda. Os recibos de férias e do 13º também aparecem aqui.'}</ListEmpty>}
            {itens.map((item) => (
              <ListItem
                key={item.chave}
                icon="file"
                title={item.titulo}
                subtitle={item.subtitulo}
                aside={item.liquido !== null ? <span className="text-sm font-bold tabular-nums whitespace-nowrap" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>{moeda(item.liquido)}</span> : undefined}
                onClick={() => baixar(item)}
                actionsLabel={item.titulo}
                actions={[{ icon: item.arquivoId ? 'eye' : 'download', label: item.arquivoId ? 'Abrir PDF' : 'Baixar PDF', onClick: () => baixar(item) }]}
              />
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
