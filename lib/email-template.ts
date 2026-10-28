import { createAdminClient } from '@/lib/supabase/server'
import { deriveThemeColors, DEFAULT_BRAND_COLOR } from '@/lib/theme'

// Modelo dos e-mails do sistema com a identidade visual da empresa (Configurações › Identidade visual):
// logo, cor principal e cor de fundo. HTML em tabelas e estilos inline, que é o que os clientes de e-mail aceitam.

export type EmailBranding = {
  nome: string
  /** Logo em formato que os clientes de e-mail exibem (PNG/JPG/WEBP/GIF); SVG não aparece no Gmail/Outlook */
  logoUrl: string | null
  cor: string
  corClara: string
  corFundo: string
}

const HEX = /^#[0-9a-fA-F]{6}$/

const PADRAO: EmailBranding = {
  nome: 'Casa Empresarial',
  logoUrl: null,
  cor: DEFAULT_BRAND_COLOR,
  corClara: deriveThemeColors(null).brandLight,
  corFundo: '#F4F4F5',
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

/** Identidade visual da empresa para e-mails (sem empresa, usa a marca Casa Empresarial) */
export async function getEmailBranding(companyId?: string | null): Promise<EmailBranding> {
  if (!companyId) return PADRAO
  const admin = createAdminClient()
  // select('*'): colunas opcionais de identidade visual podem ainda não existir no banco
  const { data } = await admin.from('companies').select('*').eq('id', companyId).maybeSingle()
  if (!data) return PADRAO
  const row = data as {
    razao_social?: string; nome_fantasia?: string | null
    logo_url?: string | null; logo_reduzida_url?: string | null
    cor_primaria?: string | null; cor_fundo?: string | null
  }
  const tema = deriveThemeColors(row.cor_primaria ?? null)
  const logo = [row.logo_url, row.logo_reduzida_url].find((u) => u && !/\.svg(\?|$)/i.test(u)) ?? null
  return {
    nome: row.nome_fantasia || row.razao_social || PADRAO.nome,
    logoUrl: logo,
    cor: tema.brand,
    corClara: tema.brandLight,
    corFundo: row.cor_fundo && HEX.test(row.cor_fundo) ? row.cor_fundo : PADRAO.corFundo,
  }
}

type Bloco =
  | { tipo: 'texto'; html: string }
  | { tipo: 'botao'; texto: string; url: string }
  | { tipo: 'codigo'; codigo: string }
  | { tipo: 'nota'; html: string }

interface Opcoes {
  branding: EmailBranding
  /** Texto curto que aparece na prévia da caixa de entrada */
  previa: string
  titulo: string
  blocos: Bloco[]
}

/** Monta o HTML completo do e-mail. Textos em `html` devem vir já escapados (use escapeHtml em dados de usuário). */
export function layoutEmail({ branding: b, previa, titulo, blocos }: Opcoes) {
  const fonte = `font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif`
  const cabecalho = b.logoUrl
    ? `<img src="${escapeHtml(b.logoUrl)}" alt="${escapeHtml(b.nome)}" height="48" style="display:block;max-height:48px;max-width:220px;height:auto;border:0;outline:none">`
    : `<span style="${fonte};font-size:22px;font-weight:800;color:${b.cor};letter-spacing:-0.3px">${escapeHtml(b.nome)}</span>`

  const corpo = blocos.map((bl) => {
    switch (bl.tipo) {
      case 'texto':
        return `<p style="${fonte};margin:0 0 16px;font-size:15px;line-height:24px;color:#333333">${bl.html}</p>`
      case 'nota':
        return `<p style="${fonte};margin:0 0 12px;font-size:13px;line-height:20px;color:#747474">${bl.html}</p>`
      case 'codigo':
        return `<div style="margin:8px 0 24px;padding:18px 0;background:${b.corClara};border-radius:12px;text-align:center">
          <span style="${fonte};font-size:34px;font-weight:800;letter-spacing:10px;color:${b.cor}">${escapeHtml(bl.codigo)}</span>
        </div>`
      case 'botao':
        return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px"><tr>
          <td style="border-radius:10px;background:${b.cor}">
            <a href="${escapeHtml(bl.url)}" target="_blank" style="${fonte};display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px">${escapeHtml(bl.texto)}</a>
          </td></tr></table>
          <p style="${fonte};margin:0 0 16px;font-size:12px;line-height:18px;color:#9a9a9a;word-break:break-all">Se o botão não funcionar, copie e cole este endereço no navegador:<br><a href="${escapeHtml(bl.url)}" style="color:${b.cor}">${escapeHtml(bl.url)}</a></p>`
    }
  }).join('\n')

  return `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(titulo)}</title></head>
<body style="margin:0;padding:0;background:${b.corFundo}">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(previa)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${b.corFundo}">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid #ececec;border-radius:16px;overflow:hidden">
        <tr><td style="height:6px;background:${b.cor};font-size:0;line-height:0">&nbsp;</td></tr>
        <tr><td style="padding:32px 36px 8px">${cabecalho}</td></tr>
        <tr><td style="padding:16px 36px 8px">
          <h1 style="${fonte};margin:0 0 16px;font-size:22px;line-height:30px;font-weight:800;color:#111111">${escapeHtml(titulo)}</h1>
          ${corpo}
        </td></tr>
        <tr><td style="padding:20px 36px 28px;border-top:1px solid #eeeeee">
          <p style="${fonte};margin:0;font-size:12px;line-height:18px;color:#9a9a9a">
            Enviado por <strong style="color:${b.cor}">${escapeHtml(b.nome)}</strong> pela Casa Empresarial. Este é um e-mail automático, não responda.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
