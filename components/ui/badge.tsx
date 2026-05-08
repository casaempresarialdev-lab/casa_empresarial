import { cn } from '@/lib/utils'

const roleConfig: Record<string, { label: string; className: string }> = {
  owner:      { label: 'Proprietário',  className: 'bg-amber-100 text-amber-800' },
  admin:      { label: 'Administrador', className: 'bg-blue-100 text-blue-800' },
  member:     { label: 'Membro',        className: 'bg-gray-100 text-gray-700' },
  accountant: { label: 'Contador',      className: 'bg-purple-100 text-purple-800' },
}

const statusConfig: Record<string, { label: string; className: string }> = {
  active:   { label: 'Ativo',    className: 'bg-green-100 text-green-800' },
  inactive: { label: 'Inativo',  className: 'bg-red-100 text-red-800' },
  pending:  { label: 'Pendente', className: 'bg-yellow-100 text-yellow-800' },
}

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', className)}>
      {label}
    </span>
  )
}

export function RoleBadge({ role }: { role: string }) {
  const config = roleConfig[role] ?? { label: role, className: 'bg-gray-100 text-gray-700' }
  return <Badge {...config} />
}

export function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] ?? { label: status, className: 'bg-gray-100 text-gray-700' }
  return <Badge {...config} />
}
