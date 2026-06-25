import { ArrowRight, X } from 'lucide-react';

interface OnboardingTourProps {
  show: boolean;
  step: { title: string; text: string; key: string };
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onSkip: () => void;
}

export function OnboardingTour({ show, step, currentStep, totalSteps, onNext, onSkip }: OnboardingTourProps) {
  if (!show) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 2000,
      maxWidth: 380, width: '100%',
      background: 'var(--bg-secondary)', borderRadius: 16,
      border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      overflow: 'hidden', animation: 'fadeInUp 0.3s ease',
    }}>
      <div style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>{step.title}</h3>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onSkip} style={{ padding: 2 }}>
            <X size={16} />
          </button>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
          {step.text}
        </p>
      </div>
      <div style={{
        padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'var(--bg-primary)',
      }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} style={{
              width: 8, height: 8, borderRadius: '50%',
              background: i === currentStep ? 'var(--accent)' : 'var(--border)',
              transition: 'background 0.2s',
            }} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-ghost btn-sm" onClick={onSkip}>
            {currentStep === totalSteps - 1 ? 'Kapat' : 'Atla'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={onNext}>
            {currentStep < totalSteps - 1 ? 'İleri' : 'Başla!'} <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
