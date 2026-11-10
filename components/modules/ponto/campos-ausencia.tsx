'use client'

import { FileDropZone } from '@/components/ui/file-drop-zone'
import { Input } from '@/components/ui/input'
import { ASO_MAX_BYTES } from '@/lib/validations/admissao'
import { Select } from '@/components/ui/select'
import { TIPOS_AUSENCIA, ausenciaSchema } from '@/lib/validations/ausencias'

export type ValorAusencia = { tipo: string; data_inicio: string; data_fim: string; motivo: string; anexo: File | null }

export const AUSENCIA_VAZIA: ValorAusencia = { tipo: '', data_inicio: '', data_fim: '', motivo: '', anexo: null }

/** Mesma regra do servidor (ausenciaSchema), para avisar antes de enviar */
export function erroAusencia(v: ValorAusencia): string | null {
  const r = ausenciaSchema.safeParse({ tipo: v.tipo || undefined, data_inicio: v.data_inicio, data_fim: v.data_fim || v.data_inicio, motivo: v.motivo.trim() })
  return r.success ? null : r.error.issues[0].message
}

export function ausenciaParaFormData(v: ValorAusencia) {
  const fd = new FormData()
  fd.set('tipo', v.tipo)
  fd.set('data_inicio', v.data_inicio)
  fd.set('data_fim', v.data_fim || v.data_inicio)
  fd.set('motivo', v.motivo)
  if (v.anexo) fd.set('anexo', v.anexo)
  return fd
}

/** Campos do atestado ou ausência: usados pelo colaborador e por quem lança na área de Pessoas */
export function CamposAusencia({ valor, onChange }: { valor: ValorAusencia; onChange: (v: ValorAusencia) => void }) {
  const mudar = (campo: Partial<ValorAusencia>) => onChange({ ...valor, ...campo })
  return (
    <div className="flex flex-col gap-4">
      <Select label="Tipo *" placeholder="Selecionar..." options={TIPOS_AUSENCIA.map((t) => ({ value: t.value, label: t.label }))} value={valor.tipo} onChange={(e) => mudar({ tipo: e.target.value })} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="De *" type="date" value={valor.data_inicio} onChange={(e) => mudar({ data_inicio: e.target.value })} />
        <Input label="Até" type="date" min={valor.data_inicio} value={valor.data_fim} onChange={(e) => mudar({ data_fim: e.target.value })} hint="Em branco, é um dia só." />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="ausencia-motivo" className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>{valor.tipo === 'outro' ? 'Observação *' : 'Observação'}</label>
        <textarea
          id="ausencia-motivo"
          rows={2}
          maxLength={500}
          value={valor.motivo}
          placeholder={valor.tipo === 'outro' ? 'Explique o motivo da ausência' : undefined}
          onChange={(e) => mudar({ motivo: e.target.value })}
          className="w-full rounded-lg border px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
          style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: '#fff' }}
        />
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Anexo</span>
          {valor.anexo && (
            <button type="button" onClick={() => mudar({ anexo: null })} className="text-xs font-semibold cursor-pointer hover:underline" style={{ color: 'var(--color-text-muted)' }}>
              Remover arquivo
            </button>
          )}
        </div>
        <FileDropZone file={valor.anexo} onFile={(anexo) => mudar({ anexo })} maxBytes={ASO_MAX_BYTES} accept=".pdf,.jpg,.jpeg,.png" hint="PDF, JPG ou PNG" />
      </div>
    </div>
  )
}
