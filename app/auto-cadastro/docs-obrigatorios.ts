// Documentos exigidos do candidato; PJ e autônomo não têm carteira de trabalho
export function docsObrigatorios(tipoContrato: string | null | undefined) {
  const pj = tipoContrato === 'pj' || tipoContrato === 'autonomo'
  return [
    { key: 'cpf', label: 'CPF' },
    ...(pj ? [] : [{ key: 'ctps', label: 'Carteira de Trabalho' }]),
    { key: 'comprovante_residencia', label: 'Comprovante de Residência' },
  ]
}
