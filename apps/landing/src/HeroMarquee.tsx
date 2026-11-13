import { useState, type CSSProperties } from 'react'
import { Button } from '@kibotalk/ui'
import { PauseIcon, PlayIcon } from '@kibotalk/ui/icons'
import { languageMarqueeRows } from '../../../packages/ui/src/marketing/language-marquee'
import '../../../packages/ui/src/marketing/language-marquee.css'

export function HeroMarquee({ pauseLabel, resumeLabel }: {
  pauseLabel: string
  resumeLabel: string
}) {
  const [paused, setPaused] = useState(false)
  const label = paused ? resumeLabel : pauseLabel

  return (
    <div className="hero-language-band">
      <div className="language-marquee" data-paused={paused} aria-hidden="true">
        {languageMarqueeRows.map(({ duration, reverse, opacity, items }) => (
          <div
            key={duration}
            className={reverse ? 'language-marquee-row reverse' : 'language-marquee-row'}
            style={{ '--marquee-duration': `${duration}s`, '--marquee-opacity': opacity } as CSSProperties}
          >
            <div className="language-marquee-track">
              {[0, 1].map((copy) => (
                <div key={copy} className="language-marquee-chunk">
                  {items.map((phrase) => <span key={phrase} className="language-marquee-item">{phrase}</span>)}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="page-shell hero-marquee-controls">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-9 rounded-full"
          onClick={() => setPaused(!paused)}
          title={label}
          aria-label={label}
        >
          {paused ? <PlayIcon /> : <PauseIcon />}
        </Button>
      </div>
    </div>
  )
}
