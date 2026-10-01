export const SCENES = [
  { id: 'hook', dur: 135 },
  { id: 'problem', dur: 165 },
  { id: 'reveal', dur: 90 },
  { id: 'flow', dur: 390 },
  { id: 'features', dur: 225 },
  { id: 'result', dur: 120 },
  { id: 'cta', dur: 150 },
].map((scene, i, all) => ({ ...scene, from: all.slice(0, i).reduce((sum, s) => sum + s.dur, 0) }))

export const STORY_DURATION = SCENES.reduce((sum, s) => sum + s.dur, 0)
