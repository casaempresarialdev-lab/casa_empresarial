'use client'

import { AREA_KEYS, AREA_LABELS, type AreaPermissions, type AreaPermissionLevel } from '@/lib/auth/area-permissions'

const PERMISSION_LEVELS: { value: AreaPermissionLevel; label: string }[] = [
  { value: 'nenhum', label: 'Sem acesso' },
  { value: 'ver', label: 'Ver' },
  { value: 'editar', label: 'Editar' },
]

interface Props {
  value: AreaPermissions
  onChange: (next: AreaPermissions) => void
  title?: string
}

export function AreaPermissionGrid({ value, onChange, title = 'Permissão por área' }: Props) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-muted)' }}>
        {title}
      </p>
      <div className="space-y-2">
        {AREA_KEYS.map((key) => (
          <div key={key} className="flex items-center justify-between gap-2">
            <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{AREA_LABELS[key]}</span>
            <div className="flex rounded-lg p-0.5" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
              {PERMISSION_LEVELS.map((lvl) => (
                <button
                  key={lvl.value}
                  type="button"
                  onClick={() => onChange({ ...value, [key]: lvl.value })}
                  className="px-2.5 py-1 text-xs rounded-md transition-all font-medium"
                  style={value[key] === lvl.value
                    ? { backgroundColor: 'white', color: 'var(--color-text-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
                    : { color: 'var(--color-text-muted)' }
                  }
                >
                  {lvl.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
