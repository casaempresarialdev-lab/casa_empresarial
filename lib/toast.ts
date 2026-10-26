'use client'

import { useAppStore } from '@/store'

// Tempo mínimo girando, para o processamento ser percebido mesmo quando o servidor responde rápido
const MIN_LOADING_MS = 2000

type Message<T> = string | ((value: T) => string)

interface PromiseMessages<T> {
  loading: string
  success: Message<T>
  /** Usado quando a promise rejeita ou devolve { error } sem mensagem */
  error: Message<unknown>
}

const resolveMessage = <T,>(m: Message<T>, v: T) => (typeof m === 'function' ? m(v) : m)

/** Toast de confirmação imediato (✓), na cor principal. Use em Client Components. */
export function toast(message: string) {
  return useAppStore.getState().pushToast(message, 'success')
}

/** Toast de erro imediato (✕). */
toast.error = (message: string) => useAppStore.getState().pushToast(message, 'error')

/**
 * Toast de processo: gira enquanto a promise roda (no mínimo 2s) e vira ✓ ou ✕.
 * Resultados no formato das Server Actions do projeto — { error: string } — contam como falha,
 * e a mensagem de erro do servidor aparece no toast. Devolve o resultado da promise.
 */
toast.promise = async <T,>(promise: Promise<T>, messages: PromiseMessages<T>): Promise<T> => {
  const { pushToast, updateToast } = useAppStore.getState()
  const id = pushToast(messages.loading, 'loading')
  const started = Date.now()
  const waitMin = () => new Promise((r) => setTimeout(r, Math.max(0, MIN_LOADING_MS - (Date.now() - started))))

  try {
    const result = await promise
    await waitMin()
    const serverError = result && typeof result === 'object' && 'error' in result
      ? (result as { error?: unknown }).error
      : null
    if (serverError) {
      updateToast(id, {
        status: 'error',
        message: typeof serverError === 'string' ? serverError : resolveMessage(messages.error, result),
      })
    } else {
      updateToast(id, { status: 'success', message: resolveMessage(messages.success, result) })
    }
    return result
  } catch (err) {
    await waitMin()
    updateToast(id, { status: 'error', message: resolveMessage(messages.error, err) })
    throw err
  }
}
