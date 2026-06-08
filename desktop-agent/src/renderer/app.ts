const STATUS_LABELS: Record<string, string> = {
  ONLINE_ACTIVE: 'Aktif Çalışıyor',
  ONLINE_IDLE: 'Boşta',
  SCREEN_LOCKED: 'Ekran Kilitli',
  ON_BREAK: 'Molada',
  OFFLINE: 'Çevrimdışı',
  WORK_SESSION_ENDED: 'Oturum Bitti',
};

function formatMinutes(seconds: number): string {
  const m = Math.floor(seconds / 60);
  return `${m}dk`;
}

let isSessionActive = false;
let isOnBreak = false;

const loginView = document.getElementById('login-view')!;
const mainView = document.getElementById('main-view')!;

document.getElementById('login-btn')?.addEventListener('click', () => {
  // Login handled via IPC in full implementation
  loginView.style.display = 'none';
  mainView.style.display = 'block';
});

document.getElementById('start-btn')?.addEventListener('click', () => {
  isSessionActive = true;
  updateUI();
});

document.getElementById('stop-btn')?.addEventListener('click', () => {
  isSessionActive = false;
  isOnBreak = false;
  updateUI();
});

document.getElementById('break-btn')?.addEventListener('click', () => {
  isOnBreak = true;
  updateUI();
});

document.getElementById('end-break-btn')?.addEventListener('click', () => {
  isOnBreak = false;
  updateUI();
});

function updateUI() {
  const statusEl = document.getElementById('current-status')!;
  const startBtn = document.getElementById('start-btn')!;
  const stopBtn = document.getElementById('stop-btn')!;
  const breakBtn = document.getElementById('break-btn')!;
  const endBreakBtn = document.getElementById('end-break-btn')!;

  if (!isSessionActive) {
    statusEl.textContent = 'Çevrimdışı';
    startBtn.style.display = 'block';
    stopBtn.style.display = 'none';
    breakBtn.style.display = 'none';
    endBreakBtn.style.display = 'none';
  } else if (isOnBreak) {
    statusEl.textContent = STATUS_LABELS.ON_BREAK;
    startBtn.style.display = 'none';
    stopBtn.style.display = 'block';
    breakBtn.style.display = 'none';
    endBreakBtn.style.display = 'block';
  } else {
    statusEl.textContent = STATUS_LABELS.ONLINE_ACTIVE;
    startBtn.style.display = 'none';
    stopBtn.style.display = 'block';
    breakBtn.style.display = 'block';
    endBreakBtn.style.display = 'none';
  }
}

// Listen for status updates from main process
declare global {
  interface Window {
    worktrack?: {
      onStatusUpdate: (cb: (status: {
        isSessionActive: boolean;
        isOnBreak: boolean;
        currentStatus: string;
        todayActive: number;
        todayIdle: number;
        todayBreak: number;
      }) => void) => void;
    };
  }
}

window.worktrack?.onStatusUpdate((status) => {
  isSessionActive = status.isSessionActive;
  isOnBreak = status.isOnBreak;
  document.getElementById('current-status')!.textContent =
    STATUS_LABELS[status.currentStatus] ?? status.currentStatus;
  document.getElementById('active-time')!.textContent = formatMinutes(status.todayActive);
  document.getElementById('idle-time')!.textContent = formatMinutes(status.todayIdle);
  document.getElementById('break-time')!.textContent = formatMinutes(status.todayBreak);
  updateUI();
});

updateUI();
