'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { IconButton } from '@/components/ui/icon-button'
import { ListItem, ListEmpty } from '@/components/ui/list-item'
import { AddButton } from '@/components/ui/add-button'
import { ModalPinConfirmacao, ModalSemPin } from '@/components/ui/modal-pin'
import { triggerDownload } from '@/components/ui/file-viewer'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { toast } from '@/lib/toast'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { ModalCertificado } from './modal-certificado'
import { deleteCertificateAction, getCertificateDownloadUrlAction, revealCertificatePasswordAction } from '../actions'
import type { Certificate } from '../queries'

function formatDate(iso: string) {
  const [year, month, day] = iso.split('T')[0].split('-')
  return `${day}/${month}/${year}`
}

interface Props {
  certificates: Certificate[]
  /** Erro ao ler a lista (ex.: tabela ainda não criada no banco) */
  loadError: string | null
  companyId: string
  /** Baixar, editar e remover exigem o PIN de segurança */
  temPin: boolean
}

// Ação que pede o PIN antes de executar
type AcaoPin = { tipo: 'baixar' | 'remover'; cert: Certificate }

export function CertificadosClient({ certificates, loadError, companyId, temPin }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Certificate | null>(null)
  const [search, setSearch] = useState('')
  const [acaoPin, setAcaoPin] = useState<AcaoPin | null>(null)
  const [semPinOpen, setSemPinOpen] = useState(false)
  const [revealingId, setRevealingId] = useState<string | null>(null)
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({})

  const filtered = certificates.filter((c) => {
    const q = search.toLowerCase()
    return c.identificacao.toLowerCase().includes(q) || c.nome_arquivo.toLowerCase().includes(q)
  })

  function openAdd() { setEditing(null); setModalOpen(true) }
  // Sem PIN cadastrado: avisa e leva ao perfil
  function exigirPin(acao: () => void) {
    if (!temPin) { setSemPinOpen(true); return }
    acao()
  }

  // Editar pede o PIN ao salvar (no modal)
  function openEdit(c: Certificate) { exigirPin(() => { setEditing(c); setModalOpen(true) }) }

  async function handleReveal(c: Certificate) {
    if (revealedPasswords[c.id]) {
      setRevealedPasswords((prev) => { const n = { ...prev }; delete n[c.id]; return n })
      return
    }
    setRevealingId(c.id)
    const result = await revealCertificatePasswordAction(c.id, companyId)
    setRevealingId(null)
    if (result.error || result.password === undefined) toast.error(result.error ?? 'Erro ao revelar a senha.')
    else setRevealedPasswords((prev) => ({ ...prev, [c.id]: result.password! }))
  }

  // Baixar ou remover, depois do PIN conferido no servidor (erro de PIN aparece no próprio campo)
  async function confirmarComPin(pin: string) {
    if (!acaoPin) return
    const { tipo, cert } = acaoPin
    if (tipo === 'baixar') {
      const r = await getCertificateDownloadUrlAction(cert.id, companyId, pin)
      if (r.error || !r.url) return { error: r.error ?? 'Não foi possível baixar o certificado.' }
      const url = r.url
      // Depois do PIN, o modal mostra o arquivo com o botão de baixar (o clique do usuário dispara o download)
      return {
        concluido: (
          <div className="flex flex-col items-center text-center gap-3">
            <span className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}>
              <Icon name="shield" size={26} />
            </span>
            <div className="min-w-0">
              <p className="font-semibold break-all" style={{ color: 'var(--color-text-primary)' }}>{cert.nome_arquivo}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>O link para baixar vale por 5 minutos.</p>
            </div>
            <Button type="button" className="w-full" onClick={() => triggerDownload(url, cert.nome_arquivo)}>
              <Icon name="download" size={16} /> Baixar certificado
            </Button>
          </div>
        ),
      }
    }
    const r = await deleteCertificateAction(cert.id, companyId, pin)
    if ('error' in r && r.error) return { error: r.error }
    toast(`${cert.identificacao} foi removido dos certificados.`)
    setAcaoPin(null)
    router.refresh()
  }

  return (
    <>
      <div className="mb-6">
        {/* Título e breadcrumb na mesma linha */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>
            Certificado digital
          </h1>
          <Breadcrumb />
        </div>
        <p className="text-sm mt-1 animate-enter" style={{ color: 'var(--color-text-muted)', animationDelay: '60ms' }}>
          Certificados da empresa, com as senhas guardadas com criptografia
        </p>
      </div>

      <div className="app-card p-5 flex flex-col gap-4">
        {loadError && (
          <p className="text-sm p-4 rounded-lg" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
            Os certificados ainda não estão disponíveis: {loadError}
          </p>
        )}

        {/* Barra do box: resumo + busca + adicionar */}
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold shrink-0" style={{ color: 'var(--color-sidebar-text)' }}>
            {certificates.length} {certificates.length === 1 ? 'certificado' : 'certificados'}
          </p>
          <div className="flex-1 min-w-[200px] flex items-center gap-2 h-9 px-3 rounded-lg border" style={{ borderColor: 'var(--color-card-border)' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0" style={{ color: 'var(--color-text-muted)' }}>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Pesquisar por identificação ou arquivo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-0 bg-transparent text-sm outline-none"
              style={{ color: 'var(--color-text-primary)' }}
            />
          </div>
          <AddButton onClick={openAdd} />
        </div>

        <ul className="flex flex-col gap-3">
          {filtered.length === 0 && (
            <ListEmpty>{search ? 'Nenhum certificado encontrado para essa pesquisa.' : 'Nenhum certificado cadastrado.'}</ListEmpty>
          )}
          {filtered.map((c) => {
            const revealed = revealedPasswords[c.id]
            return (
              <ListItem
                key={c.id}
                icon="shield"
                title={c.identificacao}
                subtitle={`${c.nome_arquivo} · Cadastrado em ${formatDate(c.created_at)}`}
                aside={c.tem_senha ? (
                  // Senha escondida, com o olho para mostrar
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-xs min-w-20 text-right" style={{ color: 'var(--color-text-secondary)' }}>
                      {revealed ?? '••••••••'}
                    </span>
                    <IconButton
                      icon={revealed ? 'eye-off' : 'eye'}
                      label={revealed ? 'Ocultar senha' : 'Ver senha'}
                      onClick={() => handleReveal(c)}
                      disabled={revealingId === c.id}
                    />
                  </div>
                ) : (
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Sem senha</span>
                )}
                actionsLabel={c.identificacao}
                actions={[
                  { icon: 'download', label: 'Baixar', onClick: () => exigirPin(() => setAcaoPin({ tipo: 'baixar', cert: c })) },
                  { icon: 'pencil', label: 'Editar', onClick: () => openEdit(c) },
                  { icon: 'trash', label: 'Remover', tone: 'danger', onClick: () => exigirPin(() => setAcaoPin({ tipo: 'remover', cert: c })) },
                ]}
              />
            )
          })}
        </ul>
      </div>

      <ModalCertificado
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null) }}
        companyId={companyId}
        certificate={editing}
      />

      {/* Baixar / remover: confirmação com o PIN */}
      <ModalPinConfirmacao
        open={!!acaoPin}
        titulo={acaoPin?.tipo === 'remover' ? 'Remover certificado' : 'Baixar certificado'}
        subtitulo={acaoPin?.cert.identificacao}
        descricao={acaoPin?.tipo === 'remover'
          ? 'Informe o seu PIN de segurança para remover o certificado. O arquivo também será apagado.'
          : 'Informe o seu PIN de segurança para baixar o arquivo do certificado.'}
        acaoLabel={acaoPin?.tipo === 'remover' ? 'Remover certificado' : 'Baixar'}
        perigo={acaoPin?.tipo === 'remover'}
        onClose={() => setAcaoPin(null)}
        onConfirmar={confirmarComPin}
      />

      <ModalSemPin open={semPinOpen} onClose={() => setSemPinOpen(false)} motivo="baixar, editar ou remover certificados" />
    </>
  )
}
