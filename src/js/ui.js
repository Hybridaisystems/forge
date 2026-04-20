// ── UI UTILITIES ──────────────────────────────────────────────────────────────

// Toast notifications
window.forgeToast = function(msg, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if(!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); }, duration);
};

// Close wizard on overlay click
document.getElementById('wizard-overlay')?.addEventListener('click', function(e) {
  if(e.target === this) window.forge?.wizard?.close();
});

// Keyboard: Escape closes wizard
document.addEventListener('keydown', e => {
  if(e.key === 'Escape') window.forge?.wizard?.close();
});
