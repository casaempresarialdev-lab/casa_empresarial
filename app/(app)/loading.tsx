import { PageLoader } from '@/components/layout/page-loader'

// Pré-loader enquanto a página carrega além do tempo mínimo (ver components/layout/page-transition.tsx)
export default function Loading() {
  return <PageLoader />
}
