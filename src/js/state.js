// ── FORGE STATE ───────────────────────────────────────────────────────────────
export const state = {
  currentProject: null,
  projects:       [],
  wizard: {
    step:        1,
    data:        { description:'', uploads:[], constraints:{}, partsPrefs:{} },
    questions:   [],
    answers:     {}
  }
};
window._forgeState = state;
