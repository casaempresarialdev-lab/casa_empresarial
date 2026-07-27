import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pesquisa',
  robots: 'noindex',
}

export default function PesquisaLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        html, body { height: 100%; overflow: hidden; }

        @keyframes sInUp   { from { opacity:0; transform:translateY(44px)  } to { opacity:1; transform:translateY(0) } }
        @keyframes sOutUp  { from { opacity:1; transform:translateY(0)      } to { opacity:0; transform:translateY(-38px) } }
        @keyframes sInDown { from { opacity:0; transform:translateY(-44px) } to { opacity:1; transform:translateY(0) } }
        @keyframes sOutDown{ from { opacity:1; transform:translateY(0)      } to { opacity:0; transform:translateY(38px) } }

        .s-enter-fwd  { animation: sInUp    0.34s cubic-bezier(0.22,1,0.36,1) both }
        .s-exit-fwd   { animation: sOutUp   0.22s ease-in both }
        .s-enter-back { animation: sInDown  0.34s cubic-bezier(0.22,1,0.36,1) both }
        .s-exit-back  { animation: sOutDown 0.22s ease-in both }

        .survey-opt {
          display:flex; align-items:center; gap:0.75rem;
          width:100%; text-align:left; padding:0.75rem 1rem;
          border:1px solid #E5E7EB; border-radius:8px;
          background:white; cursor:pointer;
          transition:border-color 0.14s, background 0.14s;
          font-family:inherit; color:#111827;
        }
        .survey-opt:hover   { border-color: var(--color-primary-darker,#A67B5B); background:#FAFAF9; }
        .survey-opt.selected { border-color: var(--color-primary-darker,#A67B5B); background: var(--color-primary,#EED9C4); }

        .survey-scale-dot {
          width:42px; height:42px; border-radius:50%;
          border:1px solid #E5E7EB; background:white;
          display:flex; align-items:center; justify-content:center;
          font-size:0.85rem; font-weight:600; color:#6B7280;
          cursor:pointer; transition:all 0.13s; flex-shrink:0;
        }
        .survey-scale-dot:hover   { border-color:var(--color-primary-darker,#A67B5B); color:var(--color-primary-darker,#A67B5B); }
        .survey-scale-dot.selected { background:var(--color-primary-darker,#A67B5B); border-color:var(--color-primary-darker,#A67B5B); color:white; }

        .survey-btn {
          display:inline-flex; align-items:center; gap:0.5rem;
          background:var(--color-primary-darker,#A67B5B); color:white;
          font-weight:600; font-size:0.85rem;
          padding:0.75rem 1.6rem; border:none; border-radius:8px;
          cursor:pointer; transition:opacity 0.14s, transform 0.1s;
        }
        .survey-btn:hover:not(:disabled) { opacity:0.87; transform:translateY(-1px); }
        .survey-btn:disabled { opacity:0.35; cursor:default; }

        .survey-textarea {
          width:100%; background:transparent; border:none; border-bottom:2px solid #E5E7EB;
          outline:none; font-family:inherit; font-size:1rem; color:#111827;
          resize:none; line-height:1.7; min-height:80px; padding-bottom:0.5rem;
          transition:border-color 0.2s;
        }
        .survey-textarea:focus { border-color:var(--color-primary-darker,#A67B5B); }
        .survey-textarea::placeholder { color:#9CA3AF; }
      `}</style>
      {children}
    </>
  )
}
