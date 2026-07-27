'use client'

import type { Survey, SurveyResponse, SurveyQuestion } from '../../../queries'

interface Props {
  survey: Survey
  responses: SurveyResponse[]
}

export function ResultadosClient({ survey, responses }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {survey.perguntas.map((q, idx) => (
        <QuestionCard
          key={q.id}
          question={q}
          index={idx + 1}
          responses={responses}
        />
      ))}
    </div>
  )
}

function QuestionCard({
  question,
  index,
  responses,
}: {
  question: SurveyQuestion
  index: number
  responses: SurveyResponse[]
}) {
  const allAnswers = responses.map(r => r.respostas[question.id]).filter(a => a !== undefined && a !== null && a !== '')

  return (
    <div style={{
      background: 'white', border: '1px solid #E5E7EB', borderRadius: 10, padding: '1.25rem',
    }}>
      <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#9CA3AF', marginBottom: '0.4rem' }}>
        Pergunta {index}
      </p>
      <p style={{ fontSize: '0.95rem', fontWeight: 700, color: '#111827', fontFamily: 'Manrope', marginBottom: '1rem', lineHeight: 1.35 }}>
        {question.texto}
      </p>

      <p style={{ fontSize: '0.7rem', color: '#9CA3AF', marginBottom: '0.75rem' }}>
        {allAnswers.length} resposta{allAnswers.length !== 1 ? 's' : ''}
      </p>

      {question.tipo === 'escala' && (
        <ScalaResult answers={allAnswers as number[]} />
      )}
      {(question.tipo === 'escolha' || question.tipo === 'multipla') && (
        <ChoiceResult question={question} answers={allAnswers} />
      )}
      {question.tipo === 'texto' && (
        <TextResult answers={allAnswers as string[]} />
      )}
    </div>
  )
}

// ── Escala (1-5) ──────────────────────────────────────────────────────────────

function ScalaResult({ answers }: { answers: number[] }) {
  if (answers.length === 0) return <Empty />

  const avg = answers.reduce((s, n) => s + n, 0) / answers.length
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  answers.forEach(n => { if (n >= 1 && n <= 5) counts[n]++ })
  const max = Math.max(...Object.values(counts), 1)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginBottom: '1rem' }}>
        <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-primary-darker,#A67B5B)', fontFamily: 'Manrope' }}>
          {avg.toFixed(1)}
        </span>
        <span style={{ fontSize: '0.8rem', color: '#9CA3AF' }}>/ 5 (média)</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {[1, 2, 3, 4, 5].map(n => (
          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#6B7280', width: 14, textAlign: 'right', flexShrink: 0 }}>{n}</span>
            <div style={{ flex: 1, height: 8, background: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${(counts[n] / max) * 100}%`,
                background: 'var(--color-primary-darker,#A67B5B)',
                borderRadius: 4,
                transition: 'width 0.4s ease',
              }} />
            </div>
            <span style={{ fontSize: '0.7rem', color: '#9CA3AF', width: 24, flexShrink: 0 }}>{counts[n]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Escolha única / Múltipla ──────────────────────────────────────────────────

function ChoiceResult({ question, answers }: { question: SurveyQuestion, answers: (string | string[] | number)[] }) {
  const opcoes = question.opcoes ?? []
  if (opcoes.length === 0) return <Empty />

  const countMap: Record<string, number> = {}
  opcoes.forEach(o => { countMap[o] = 0 })
  answers.forEach(a => {
    if (Array.isArray(a)) {
      a.forEach(v => { if (typeof v === 'string' && countMap[v] !== undefined) countMap[v]++ })
    } else if (typeof a === 'string') {
      if (countMap[a] !== undefined) countMap[a]++
    }
  })

  const totalVotes = Object.values(countMap).reduce((s, n) => s + n, 0)
  const max = Math.max(...Object.values(countMap), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {opcoes.map(opt => {
        const count = countMap[opt] ?? 0
        const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
        return (
          <div key={opt}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
              <span style={{ fontSize: '0.8rem', color: '#374151' }}>{opt}</span>
              <span style={{ fontSize: '0.7rem', color: '#9CA3AF' }}>{count} ({pct}%)</span>
            </div>
            <div style={{ height: 7, background: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${(count / max) * 100}%`,
                background: 'var(--color-primary-darker,#A67B5B)',
                borderRadius: 4,
                transition: 'width 0.4s ease',
              }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Texto aberto ──────────────────────────────────────────────────────────────

function TextResult({ answers }: { answers: string[] }) {
  if (answers.length === 0) return <Empty />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {answers.map((text, i) => (
        <div key={i} style={{
          background: '#F9FAFB', borderRadius: 6, padding: '0.6rem 0.75rem',
          fontSize: '0.82rem', color: '#374151', lineHeight: 1.6,
          borderLeft: '2px solid #E5E7EB',
        }}>
          {text}
        </div>
      ))}
    </div>
  )
}

function Empty() {
  return <p style={{ fontSize: '0.8rem', color: '#9CA3AF', fontStyle: 'italic' }}>Sem respostas para esta pergunta.</p>
}
