export const SCENES = [
  { id: 'hook', dur: 120 },
  { id: 'problem', dur: 210 },
  { id: 'reveal', dur: 120 },
  { id: 'flow', dur: 510 },
  { id: 'result', dur: 210 },
  { id: 'stats', dur: 150 },
  { id: 'cta', dur: 120 },
].map((scene, i, all) => ({ ...scene, from: all.slice(0, i).reduce((sum, s) => sum + s.dur, 0) }))

export const REEL_DURATION = SCENES.reduce((sum, s) => sum + s.dur, 0)
