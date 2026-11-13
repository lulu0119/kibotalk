import {
  ArrowRightUpIcon,
  CheckIcon,
  DownloadIcon,
  PauseDuotoneIcon,
  SparklesDuotoneIcon,
  StopDuotoneIcon,
  TranslateIcon,
} from '@kibotalk/ui/icons'
import {
  Badge,
  Button,
  Card,
  CardContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  IslandBar,
  IslandNavButton,
  IslandSeparator,
  IslandStatus,
  IslandToggleButton,
  PillTag,
  StickyNoteCard,
} from '@kibotalk/ui'
import { copy, locales, type Locale } from './copy'
import { HeroMarquee } from './HeroMarquee'

const githubRepoUrl = 'https://github.com/lulu0119/kibotalk'
const siteBase = import.meta.env.BASE_URL
const webUrl = `${siteBase}app/`
const playgroundUrl = `${siteBase}playground/`
const macSetupUrl = `${githubRepoUrl}#run-locally`
const adventurexUrl = 'https://adventure-x.org/'
const lingguangUrl =
  'https://www.lingguang.com/share/FLASH_APP-47cf7a20-7033-463d-a975-eacb0b0e6c1764'

const localeShortLabel: Record<Locale, string> = {
  zh: '中',
  ja: '日',
  en: 'EN',
}

function LanguageMenu({ locale }: { locale: Locale }) {
  const content = copy[locale]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label={content.localeName}>
          <TranslateIcon aria-hidden />
          <span>{localeShortLabel[locale]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((option) => (
          <DropdownMenuItem key={option} asChild>
            <a
              className="flex items-center justify-between gap-5"
              href={`${siteBase}${option}/${window.location.hash}`}
              hrefLang={option}
            >
              {copy[option].localeName}
              {option === locale ? <CheckIcon aria-hidden /> : null}
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Header({ locale }: { locale: Locale }) {
  const content = copy[locale]

  return (
    <header className="site-header">
      <div className="page-shell flex h-19 items-center justify-between gap-5">
        <a href={`${siteBase}${locale}/`} aria-label="KiboTalk">
          <img
            className="h-auto w-35 sm:w-40"
            src={`${siteBase}assets/kibotalk-wordmark.svg`}
            alt="KiboTalk"
          />
        </a>

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary">
          <a className="header-link" href="#scenes">
            {content.nav.scenes}
          </a>
          <a className="header-link" href="#product">
            {content.nav.product}
          </a>
          <a className="header-link" href="#story">
            {content.nav.story}
          </a>
          <a className="header-link" href="#mission">
            {content.nav.mission}
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <LanguageMenu locale={locale} />
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <a href={webUrl}>
              {content.actions.web}
              <ArrowRightUpIcon aria-hidden />
            </a>
          </Button>
        </div>
      </div>
    </header>
  )
}

function Hero({ locale }: { locale: Locale }) {
  const { hero, actions } = copy[locale]

  return (
    <section className="hero-section" aria-labelledby="hero-title">
      <HeroMarquee pauseLabel={hero.pauseAnimation} resumeLabel={hero.resumeAnimation} />
      <div className="page-shell hero-copy">
        <h1 id="hero-title" className="hero-title hero-enter">
          <span>{hero.titleLead}</span>
          <mark>{hero.titleMark}</mark>
        </h1>
        <p className="hero-statement hero-enter hero-enter-delay-1">
          {hero.statementLead}
          <strong>{hero.statementStrong}</strong>
        </p>
        <div className="hero-actions hero-enter hero-enter-delay-2">
          <Button asChild variant="outline" size="lg">
            <a href={webUrl}>
              {actions.web}
              <ArrowRightUpIcon aria-hidden />
            </a>
          </Button>
          <Button asChild variant="outline" size="lg">
            <a href={macSetupUrl} target="_blank" rel="noreferrer">
              {actions.mac}
              <ArrowRightUpIcon aria-hidden />
            </a>
          </Button>
          <Button asChild variant="outline" size="lg">
            <a href={playgroundUrl}>
              {actions.playground}
              <ArrowRightUpIcon aria-hidden />
            </a>
          </Button>
        </div>
      </div>
    </section>
  )
}

function SceneMap({ locale }: { locale: Locale }) {
  const { scenes } = copy[locale]

  return (
    <section id="scenes" className="scenes-section">
      <div className="page-shell scene-layout">
        <div className="scene-heading">
          <p className="section-kicker">{scenes.eyebrow}</p>
          <h2 className="section-title">
            {scenes.titleLead}
            <mark>{scenes.titleMark}</mark>
          </h2>
        </div>

        <div className="scene-map">
          <img
            className="map-image"
            src={`${siteBase}assets/japan-scenes-map.png`}
            alt={scenes.ariaLabel}
          />
        </div>
      </div>
    </section>
  )
}

function ProductDemo({ locale }: { locale: Locale }) {
  const { product } = copy[locale]
  const candidates = product.candidates.map((candidate, index) => ({
    id: `landing-${index}`,
    ...candidate,
  }))

  return (
    <div className="product-demo" aria-label="KiboTalk live reply interface">
      <div className="transcript-strip">
        <strong>{product.transcriptSpeaker}</strong>
        <span>{product.transcript}</span>
      </div>
      <div className="suggestion-meta">
        <span>{product.suggestionLabel}</span>
        <span>{product.now}</span>
      </div>
      <StickyNoteCard candidates={candidates} className="!w-full !max-w-none" />
      <IslandBar className="mx-auto mt-5 w-fit max-w-full">
        <IslandStatus label={product.listening} toneClassName="bg-primary-soft-strong" pulse />
        <IslandSeparator />
        <IslandToggleButton on label="Pause">
          <PauseDuotoneIcon />
        </IslandToggleButton>
        <IslandNavButton label="Stop">
          <StopDuotoneIcon />
        </IslandNavButton>
        <IslandToggleButton on label="AI suggestions">
          <SparklesDuotoneIcon />
        </IslandToggleButton>
      </IslandBar>
    </div>
  )
}

function ProductSection({ locale }: { locale: Locale }) {
  const { product } = copy[locale]

  return (
    <section id="product" className="product-section">
      <div className="page-shell product-layout">
        <div className="product-copy">
          <p className="section-kicker">{product.eyebrow}</p>
          <h2 className="section-title">
            {product.titleLead}
            <mark>{product.titleMark}</mark>
          </h2>
          <p className="section-body">{product.body}</p>
        </div>
        <ProductDemo locale={locale} />
      </div>
    </section>
  )
}

function StorySection({ locale }: { locale: Locale }) {
  const { story, actions } = copy[locale]

  return (
    <section id="story" className="story-section">
      <div className="page-shell">
        <div className="story-heading">
          <p className="section-kicker">{story.eyebrow}</p>
          <h2 className="section-title">{story.title}</h2>
          <p className="section-body">{story.body}</p>
        </div>

        <div className="story-grid">
          <Card className="story-card production-card">
            <CardContent>
              <div className="story-card-topline">
                <Badge>{story.productionLabel}</Badge>
              </div>
              <img
                className="production-wordmark"
                src={`${siteBase}assets/kibotalk-wordmark-no-border.svg`}
                alt="KiboTalk"
              />
              <h3>{story.productionTitle}</h3>
              <p>{story.productionBody}</p>
              <div className="capability-list">
                {story.capabilities.map((capability) => (
                  <PillTag key={capability}>
                    <CheckIcon aria-hidden />
                    {capability}
                  </PillTag>
                ))}
              </div>
              <Button asChild>
                <a href={webUrl}>
                  {actions.web}
                  <ArrowRightUpIcon aria-hidden />
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}

function MissionSection({ locale }: { locale: Locale }) {
  const { mission, actions } = copy[locale]

  return (
    <section id="mission" className="mission-section">
      <div className="page-shell mission-layout">
        <div>
          <p className="section-kicker">{mission.eyebrow}</p>
          <h2 className="section-title">
            {mission.titleLead}
            <mark>{mission.titleMark}</mark>
          </h2>
          <p className="section-body">{mission.body}</p>
        </div>

        <div className="mission-actions">
          <div>
            <Button asChild size="lg">
              <a href={webUrl}>
                {actions.web}
                <ArrowRightUpIcon aria-hidden />
              </a>
            </Button>
          </div>
          <div className="desktop-download">
            <Button asChild variant="soft" size="lg">
              <a href={macSetupUrl} target="_blank" rel="noreferrer">
                <DownloadIcon aria-hidden />
                {actions.mac}
              </a>
            </Button>
            <p>{mission.compatibility}</p>
            <p>{mission.gatekeeper}</p>
          </div>
        </div>
      </div>
    </section>
  )
}

function Footer({ locale }: { locale: Locale }) {
  const { footer, actions } = copy[locale]

  return (
    <footer className="site-footer">
      <div className="page-shell footer-layout">
        <div>
          <img
            className="footer-wordmark"
            src={`${siteBase}assets/kibotalk-wordmark.svg`}
            alt="KiboTalk"
          />
          <p>{footer.statement}</p>
        </div>
        <div className="footer-links">
          <a href={playgroundUrl}>{actions.playground}</a>
          <a href={githubRepoUrl} target="_blank" rel="noreferrer">
            {footer.github}
            <ArrowRightUpIcon aria-hidden />
          </a>
          <a href={adventurexUrl} target="_blank" rel="noreferrer">
            {footer.adventurex}
            <ArrowRightUpIcon aria-hidden />
          </a>
          <a href={lingguangUrl} target="_blank" rel="noreferrer">
            {footer.original}
            <ArrowRightUpIcon aria-hidden />
          </a>
          <a href="#top">{actions.top}</a>
        </div>
      </div>
    </footer>
  )
}

export function LandingPage({ locale }: { locale: Locale }) {
  return (
    <div id="top" className="landing-page">
      <Header locale={locale} />
      <main>
        <Hero locale={locale} />
        <SceneMap locale={locale} />
        <ProductSection locale={locale} />
        <StorySection locale={locale} />
        <MissionSection locale={locale} />
      </main>
      <Footer locale={locale} />
    </div>
  )
}
