import { useState, type CSSProperties } from 'react'
import { Button } from '../components/ui/button'
import { PauseIcon, PlayIcon } from '../icons'
import { languageMarqueeRows } from './language-marquee'
import './language-marquee.css'

export const brandWordmark = new URL('./kibotalk-wordmark.svg', import.meta.url).href

export function LanguageMarquee({ pauseLabel, resumeLabel, className, controlsClassName }: {
  pauseLabel: string
  resumeLabel: string
  className?: string
  controlsClassName?: string
}) {
  const [paused, setPaused] = useState(false)
  const label = paused ? resumeLabel : pauseLabel

  return (
    <div className={className}>
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
      <div className={controlsClassName}>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-9 rounded-full motion-reduce:hidden"
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
