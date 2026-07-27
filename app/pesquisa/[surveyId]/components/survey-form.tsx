'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { submitSurveyResponseAction } from '../actions'
import type { Survey, SurveyQuestion } from '@/app/(app)/pessoas/pesquisas/queries'

type Phase = 'welcome' | 'questions' | 'thanks' | 'encerrada'
type Answer = string | string[] | number
type Direction = 'fwd' | 'back'

interface Props {
  survey: Survey
}

// Estimativa: 1 min por pergunta, mínimo 2 min
function estimatedMinutes(count: number) {
  return Math.max(2, Math.ceil(count * 0.8))
}

export function SurveyForm({ survey }: Props) {
  const questions = survey.perguntas

  const [phase, setPhase]       = useState<Phase>(survey.status === 'encerrado' ? 'encerrada' : 'welcome')
  const [qIdx, setQIdx]         = useState(0)
  const [answers, setAnswers]   = useState<Record<string, Answer>>({})
  const [direction, setDirection] = useState<Direction>('fwd')
  const [exiting, setExiting]   = useState(false)
  const [animKey, setAnimKey]   = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const currentQ: SurveyQuestion | undefined = questions[qIdx]
  const progress = phase === 'questions' ? ((qIdx + 1) / questions.length) * 100 : phase === 'thanks' ? 100 : 0

  // ── Navegação com animação ──────────────────────────────────────────────────
  const navigate = useCallback((action: () => void, dir: Direction = 'fwd') => {
    setDirection(dir)
    setExiting(true)
    setTimeout(() => {
      action()
      setAnimKey(k => k + 1)
      setExiting(false)
    }, 220)
  }, [])

  function advance(currentAnswer?: Answer) {
    if (currentAnswer !== undefined && currentQ) {
      setAnswers(prev => ({ ...prev, [currentQ.id]: currentAnswer }))
    }
    navigate(() => {
      if (qIdx >= questions.length - 1) {
        setPhase('thanks')
        handleSubmit({ ...answers, ...(currentAnswer !== undefined && currentQ ? { [currentQ.id]: currentAnswer } : {}) })
      } else {
        setQIdx(i => i + 1)
      }
    })
  }

  function goBack() {
    if (qIdx === 0) navigate(() => setPhase('welcome'), 'back')
    else navigate(() => setQIdx(i => i - 1), 'back')
  }

  async function handleSubmit(finalAnswers: Record<string, Answer>) {
    setSubmitting(true)
    await submitSurveyResponseAction(survey.id, finalAnswers)
    setSubmitting(false)
  }

  // ── Atalho de teclado ───────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'questions' || !currentQ) return

    function onKey(e: KeyboardEvent) {
      if (!currentQ) return
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'TEXTAREA' || tag === 'INPUT') return

      if (currentQ.tipo === 'escolha') {
        const map: Record<string, number> = { a:0,b:1,c:2,d:3,'1':0,'2':1,'3':2,'4':3 }
        const n = map[e.key.toLowerCase()]
        if (n !== undefined && currentQ.opcoes && n < currentQ.opcoes.length) {
          advance(currentQ.opcoes[n])
        }
      }
      if (currentQ.tipo === 'escala') {
        const n = parseInt(e.key)
        if (n >= 1 && n <= 5) advance(n)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, currentQ, qIdx, answers]) // eslint-disable-line react-hooks/exhaustive-deps

  const animClass = exiting
    ? (direction === 'fwd' ? 's-exit-fwd' : 's-exit-back')
    : (direction === 'fwd' ? 's-enter-fwd' : 's-enter-back')

  // ── Layout container ────────────────────────────────────────────────────────
  return (
    <div style={{ position:'fixed', inset:0, display:'flex', flexDirection:'column', backgroundColor:'#F7F8FA' }}>

      {/* Progress bar */}
      <div style={{ height:3, backgroundColor:'#E5E7EB', flexShrink:0 }}>
        <div style={{
          height:'100%',
          width: `${progress}%`,
          backgroundColor:'var(--color-primary-darker,#A67B5B)',
          transition:'width 0.4s ease',
        }} />
      </div>

      {/* Header */}
      <div style={{
        display:'flex', justifyContent:'space-between', alignItems:'center',
        padding:'0.9rem 1.5rem', flexShrink:0,
        borderBottom:'1px solid #F0F0F0', backgroundColor:'white',
      }}>
        <span style={{ fontFamily:'Manrope,sans-serif', fontWeight:700, fontSize:'0.8rem', color:'var(--color-primary-darker,#A67B5B)' }}>
          {survey.titulo}
        </span>
        {phase === 'questions' && (
          <span style={{ fontSize:'0.7rem', color:'#9CA3AF' }}>
            {qIdx + 1} / {questions.length}
          </span>
        )}
      </div>

      {/* Content area — scrollable if needed */}
      <div style={{ flex:1, overflow:'auto', display:'flex', alignItems:'center', justifyContent:'center', padding:'2.5rem 1.5rem' }}>
        <div key={animKey} className={animClass} style={{ width:'100%', maxWidth:600 }}>

          {/* ── ENCERRADA ── */}
          {phase === 'encerrada' && (
            <div style={{ textAlign:'center' }}>
              <p style={{ fontSize:'2.5rem', marginBottom:'1rem' }}>🔒</p>
              <h1 style={{ fontFamily:'Manrope,sans-serif', fontSize:'1.6rem', fontWeight:700, color:'#111827', marginBottom:'0.75rem' }}>
                Pesquisa encerrada
              </h1>
              <p style={{ fontSize:'0.9rem', color:'#6B7280', lineHeight:1.6 }}>
                Esta pesquisa não está mais aceitando respostas.
              </p>
            </div>
          )}

          {/* ── WELCOME ── */}
          {phase === 'welcome' && (
            <div style={{ textAlign:'center' }}>
              <p style={{ fontSize:'2.5rem', marginBottom:'1rem' }}>📋</p>
              <h1 style={{ fontFamily:'Manrope,sans-serif', fontSize:'clamp(1.5rem,4vw,2rem)', fontWeight:700, color:'#111827', marginBottom:'0.75rem', lineHeight:1.25 }}>
                {survey.titulo}
              </h1>
              {survey.descricao && (
                <p style={{ fontSize:'0.9rem', color:'#6B7280', lineHeight:1.7, marginBottom:'2rem', maxWidth:480, marginLeft:'auto', marginRight:'auto' }}>
                  {survey.descricao}
                </p>
              )}
              {questions.length === 0 ? (
                <p style={{ fontSize:'0.85rem', color:'#9CA3AF' }}>Esta pesquisa ainda não possui perguntas.</p>
              ) : (
                <>
                  <button
                    className="survey-btn"
                    onClick={() => navigate(() => { setPhase('questions'); setQIdx(0) })}
                  >
                    Começar →
                  </button>
                  <p style={{ marginTop:'0.75rem', fontSize:'0.7rem', color:'#9CA3AF' }}>
                    ⏱ Cerca de {estimatedMinutes(questions.length)} minutos · {questions.length} perguntas · Anônimo
                  </p>
                </>
              )}
            </div>
          )}

          {/* ── QUESTIONS ── */}
          {phase === 'questions' && currentQ && (
            <div>
              {/* Número da pergunta */}
              <p style={{ fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.2em', textTransform:'uppercase', color:'var(--color-primary-darker,#A67B5B)', marginBottom:'0.75rem' }}>
                PERGUNTA {qIdx + 1}
              </p>

              {/* Texto da pergunta */}
              <h2 style={{ fontFamily:'Manrope,sans-serif', fontSize:'clamp(1.15rem,3vw,1.5rem)', fontWeight:700, color:'#111827', marginBottom:'1.5rem', lineHeight:1.3 }}>
                {currentQ.texto || <span style={{ color:'#9CA3AF' }}>Sem texto</span>}
              </h2>

              {/* ── ESCOLHA ÚNICA ── */}
              {currentQ.tipo === 'escolha' && (
                <ChoiceQuestion
                  question={currentQ}
                  answer={answers[currentQ.id] as string | undefined}
                  onSelect={val => advance(val)}
                />
              )}

              {/* ── MÚLTIPLA ESCOLHA ── */}
              {currentQ.tipo === 'multipla' && (
                <MultiQuestion
                  question={currentQ}
                  answer={answers[currentQ.id] as string[] | undefined}
                  onChange={val => setAnswers(prev => ({ ...prev, [currentQ.id]: val }))}
                  onConfirm={() => advance()}
                />
              )}

              {/* ── ESCALA ── */}
              {currentQ.tipo === 'escala' && (
                <ScaleQuestion
                  answer={answers[currentQ.id] as number | undefined}
                  onSelect={val => advance(val)}
                />
              )}

              {/* ── TEXTO ABERTO ── */}
              {currentQ.tipo === 'texto' && (
                <TextQuestion
                  answer={answers[currentQ.id] as string | undefined}
                  onChange={val => setAnswers(prev => ({ ...prev, [currentQ.id]: val }))}
                  onConfirm={() => advance()}
                />
              )}

              {/* Voltar */}
              <div style={{ marginTop:'1.5rem' }}>
                <button
                  onClick={goBack}
                  style={{ background:'none', border:'none', fontSize:'0.75rem', color:'#9CA3AF', cursor:'pointer', padding:'0.3rem 0', display:'inline-flex', alignItems:'center', gap:'0.3rem' }}
                >
                  ← Voltar
                </button>
              </div>
            </div>
          )}

          {/* ── THANKS ── */}
          {phase === 'thanks' && (
            <div style={{ textAlign:'center' }}>
              <p style={{ fontSize:'2.5rem', marginBottom:'1rem' }}>🎉</p>
              <h1 style={{ fontFamily:'Manrope,sans-serif', fontSize:'1.6rem', fontWeight:700, color:'#111827', marginBottom:'0.75rem' }}>
                Obrigado pela sua resposta!
              </h1>
              <p style={{ fontSize:'0.9rem', color:'#6B7280', lineHeight:1.7 }}>
                Sua resposta foi enviada com sucesso.{' '}
                {submitting && <span style={{ color:'var(--color-primary-darker,#A67B5B)' }}>Salvando…</span>}
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ── Sub-componentes de tipo de pergunta ───────────────────────────────────────

function ChoiceQuestion({ question, answer, onSelect }: {
  question: SurveyQuestion
  answer: string | undefined
  onSelect: (val: string) => void
}) {
  const keys = ['A','B','C','D']
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
      {(question.opcoes ?? []).slice(0, 4).map((opt, i) => (
        <button
          key={i}
          className={`survey-opt ${answer === opt ? 'selected' : ''}`}
          onClick={() => onSelect(opt)}
        >
          <span style={{
            flexShrink:0, width:24, height:24, border:'1px solid #E5E7EB', borderRadius:4,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:'0.65rem', fontWeight:700, color:'#9CA3AF',
          }}>
            {keys[i]}
          </span>
          <span style={{ fontSize:'0.9rem', flex:1, textAlign:'left' }}>{opt}</span>
        </button>
      ))}
    </div>
  )
}

function MultiQuestion({ question, answer, onChange, onConfirm }: {
  question: SurveyQuestion
  answer: string[] | undefined
  onChange: (val: string[]) => void
  onConfirm: () => void
}) {
  const keys = ['A','B','C','D']
  const selected = answer ?? []

  function toggle(opt: string) {
    const next = selected.includes(opt)
      ? selected.filter(s => s !== opt)
      : [...selected, opt]
    onChange(next)
  }

  return (
    <div>
      <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem', marginBottom:'1.25rem' }}>
        {(question.opcoes ?? []).slice(0, 4).map((opt, i) => (
          <button
            key={i}
            className={`survey-opt ${selected.includes(opt) ? 'selected' : ''}`}
            onClick={() => toggle(opt)}
          >
            <span style={{
              flexShrink:0, width:24, height:24, border:'1px solid #E5E7EB', borderRadius:4,
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:'0.65rem', fontWeight:700, color:'#9CA3AF',
            }}>
              {keys[i]}
            </span>
            <span style={{ fontSize:'0.9rem', flex:1, textAlign:'left' }}>{opt}</span>
            {selected.includes(opt) && (
              <span style={{ color:'var(--color-primary-darker,#A67B5B)', fontWeight:700, fontSize:'0.8rem' }}>✓</span>
            )}
          </button>
        ))}
      </div>
      <p style={{ fontSize:'0.7rem', color:'#9CA3AF', marginBottom:'1rem' }}>Selecione todas que se aplicam</p>
      <button
        className="survey-btn"
        disabled={selected.length === 0}
        onClick={onConfirm}
      >
        Confirmar →
      </button>
    </div>
  )
}

function ScaleQuestion({ answer, onSelect }: {
  answer: number | undefined
  onSelect: (val: number) => void
}) {
  return (
    <div>
      <div style={{ display:'flex', gap:'0.5rem', marginBottom:'0.75rem', flexWrap:'wrap' }}>
        {[1,2,3,4,5].map(n => (
          <button
            key={n}
            className={`survey-scale-dot ${answer === n ? 'selected' : ''}`}
            onClick={() => onSelect(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.65rem', color:'#9CA3AF', maxWidth:250 }}>
        <span>Discordo totalmente</span>
        <span>Concordo totalmente</span>
      </div>
    </div>
  )
}

function TextQuestion({ answer, onChange, onConfirm }: {
  answer: string | undefined
  onChange: (val: string) => void
  onConfirm: () => void
}) {
  const [local, setLocal] = useState(answer ?? '')
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setTimeout(() => taRef.current?.focus(), 340)
  }, [])

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (local.trim()) { onChange(local.trim()); onConfirm() }
    }
  }

  return (
    <div>
      <textarea
        ref={taRef}
        className="survey-textarea"
        rows={4}
        placeholder="Escreva sua resposta aqui..."
        value={local}
        onChange={e => { setLocal(e.target.value); onChange(e.target.value) }}
        onKeyDown={handleKey}
      />
      <div style={{ marginTop:'1.25rem', display:'flex', flexDirection:'column', gap:'0.4rem' }}>
        <button
          className="survey-btn"
          disabled={!local.trim()}
          onClick={() => { onChange(local.trim()); onConfirm() }}
        >
          OK ✓
        </button>
        <p style={{ fontSize:'0.65rem', color:'#9CA3AF' }}>
          Pressione <kbd style={{ border:'1px solid #E5E7EB', borderRadius:3, padding:'0.05rem 0.3rem' }}>Enter ↵</kbd> para continuar
        </p>
      </div>
    </div>
  )
}
