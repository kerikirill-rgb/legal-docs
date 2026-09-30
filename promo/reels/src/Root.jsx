import { Composition, continueRender, delayRender, staticFile } from 'remotion'
import { Reel } from './Reel'
import { REEL_DURATION } from './scenes'

const fontHandle = delayRender('Loading Inter')
Promise.all(
  [
    ['Regular', 400],
    ['Medium', 500],
    ['SemiBold', 600],
    ['Bold', 700],
  ].map(([name, weight]) =>
    new FontFace('Inter', `url(${staticFile(`fonts/Inter-${name}.ttf`)})`, { weight: String(weight) })
      .load()
      .then((face) => document.fonts.add(face)),
  ),
).then(() => continueRender(fontHandle))

export const RemotionRoot = () => (
  <Composition
    id="LegalDocsReel"
    component={Reel}
    durationInFrames={REEL_DURATION}
    fps={30}
    width={1080}
    height={1920}
  />
)
