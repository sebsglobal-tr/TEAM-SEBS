import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'worktrack_onboarding_done';

const STEPS = [
  { key: 'dashboard', title: '👋 Hoş Geldiniz!', text: 'Dashboard\'dan anlık çalışma durumunuzu, görevlerinizi ve istatistiklerinizi görebilirsiniz.' },
  { key: 'timer', title: '⏱ Çalışma Sayacı', text: 'Çalışmaya başlamak için "Çalışmayı Başlat" butonuna tıklayın. Mola verebilir, duraklatabilir ve bitirebilirsiniz.' },
  { key: 'tasks', title: '📋 Görevler', text: 'Size atanan görevleri görüntüleyin, durum güncellemeleri yapın ve dosya yükleyin.' },
  { key: 'reports', title: '📝 Raporlar', text: 'Gün sonu raporlarınızı yükleyin ve yöneticinizin geri bildirimlerini takip edin.' },
  { key: 'messages', title: '💬 Mesajlar', text: 'Yöneticiniz ve ekip arkadaşlarınızla iletişim kurabilirsiniz.' },
];

export function useOnboarding(role: string) {
  const [showTour, setShowTour] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [completed, setCompleted] = useState(() => {
    return localStorage.getItem(`${STORAGE_KEY}_${role}`) === 'true';
  });

  const startTour = useCallback(() => {
    setShowTour(true);
    setCurrentStep(0);
  }, []);

  const nextStep = useCallback(() => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      setShowTour(false);
      setCompleted(true);
      localStorage.setItem(`${STORAGE_KEY}_${role}`, 'true');
    }
  }, [currentStep, role]);

  const skipTour = useCallback(() => {
    setShowTour(false);
    setCompleted(true);
    localStorage.setItem(`${STORAGE_KEY}_${role}`, 'true');
  }, [role]);

  const step = STEPS[currentStep];

  return { showTour, step, currentStep, totalSteps: STEPS.length, startTour, nextStep, skipTour, completed };
}
