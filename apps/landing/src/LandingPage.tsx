import {
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  Languages,
  Pause,
  Sparkles,
  Square,
} from 'lucide-react'
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
  PillTag,
  StickyNoteCard,
} from '@kibotalk/ui'
import { copy, locales, type Locale } from './copy'

const githubRepoUrl = 'https://github.com/KiboAI/KiboTalk'
const webSetupUrl = `${githubRepoUrl}#web`
const macSetupUrl = `${githubRepoUrl}#macos`
const adventurexUrl = 'https://adventure-x.org/'
const lingguangUrl =
  'https://www.lingguang.com/share/FLASH_APP-47cf7a20-7033-463d-a975-eacb0b0e6c1764'

const localeShortLabel: Record<Locale, string> = {
  zh: '中',
  ja: '日',
  en: 'EN',
}

function rememberLocale(locale: Locale) {
  window.localStorage.setItem('kibotalk-landing-language', locale)
}

function LanguageMenu({ locale }: { locale: Locale }) {
  const content = copy[locale]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label={content.localeName}>
          <Languages aria-hidden />
          <span>{localeShortLabel[locale]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((option) => (
          <DropdownMenuItem key={option} asChild>
            <a
              className="flex items-center justify-between gap-5"
              href={`/${option}/${window.location.hash}`}
              hrefLang={option}
              onClick={() => rememberLocale(option)}
            >
              {copy[option].localeName}
              {option === locale ? <Check aria-hidden /> : null}
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
        <a href={`/${locale}/`} aria-label="KiboTalk">
          <img
            className="h-auto w-35 sm:w-40"
            src="/assets/kibotalk-wordmark.svg"
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
            <a href={webSetupUrl}>
              {content.actions.web}
              <ArrowUpRight aria-hidden />
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
    <section className="hero-section page-shell" aria-labelledby="hero-title">
      <p className="section-kicker hero-enter">{hero.eyebrow}</p>
      <h1 id="hero-title" className="hero-title hero-enter hero-enter-delay-1">
        <span>{hero.titleLead}</span>
        <mark>{hero.titleMark}</mark>
      </h1>
      <p className="hero-statement hero-enter hero-enter-delay-2">
        {hero.statementLead}
        <strong>{hero.statementStrong}</strong>
      </p>
      <p className="hero-tagline hero-enter hero-enter-delay-2">{hero.tagline}</p>

      <div className="hero-actions hero-enter hero-enter-delay-3">
        <div>
          <Button asChild size="lg">
            <a href={webSetupUrl}>
              {actions.web}
              <ArrowUpRight aria-hidden />
            </a>
          </Button>
          <p>{hero.webNote}</p>
        </div>
        <div>
          <Button asChild variant="soft" size="lg">
            <a href={macSetupUrl} target="_blank" rel="noreferrer">
              <ArrowDownToLine aria-hidden />
              {actions.mac}
            </a>
          </Button>
          <p>{hero.macNote}</p>
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
            src="/assets/japan-scenes-map.png"
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
        <IslandStatus label={product.listening} pulse />
        <IslandSeparator />
        <IslandNavButton label="Pause">
          <Pause aria-hidden />
        </IslandNavButton>
        <IslandNavButton label="Stop">
          <Square aria-hidden />
        </IslandNavButton>
        <IslandNavButton label="AI suggestions">
          <Sparkles aria-hidden />
        </IslandNavButton>
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
                src="/assets/kibotalk-wordmark-no-border.svg"
                alt="KiboTalk"
              />
              <h3>{story.productionTitle}</h3>
              <p>{story.productionBody}</p>
              <div className="capability-list">
                {story.capabilities.map((capability) => (
                  <PillTag key={capability}>
                    <Check aria-hidden />
                    {capability}
                  </PillTag>
                ))}
              </div>
              <Button asChild>
                <a href={webSetupUrl}>
                  {actions.web}
                  <ArrowUpRight aria-hidden />
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
              <a href={webSetupUrl}>
                {actions.web}
                <ArrowUpRight aria-hidden />
              </a>
            </Button>
          </div>
          <div className="desktop-download">
            <Button asChild variant="soft" size="lg">
              <a href={macSetupUrl} target="_blank" rel="noreferrer">
                <ArrowDownToLine aria-hidden />
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
            src="/assets/kibotalk-wordmark.svg"
            alt="KiboTalk"
          />
          <p>{footer.statement}</p>
        </div>
        <div className="footer-links">
          <a href={githubRepoUrl} target="_blank" rel="noreferrer">
            {footer.github}
            <ArrowUpRight aria-hidden />
          </a>
          <a href={adventurexUrl} target="_blank" rel="noreferrer">
            {footer.adventurex}
            <ArrowUpRight aria-hidden />
          </a>
          <a href={lingguangUrl} target="_blank" rel="noreferrer">
            {footer.original}
            <ArrowUpRight aria-hidden />
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
