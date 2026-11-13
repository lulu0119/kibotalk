import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { MoonIcon, PulseIcon, SettingsIcon, SoundwaveIcon, SunIcon } from '@kibotalk/ui/icons'
import { defaultProductPrefs, I18nProvider } from '@kibotalk/app-shared'
import { ReplyModelSettings, TranscriptionModelSettings } from '@kibotalk/pages'
import {
  Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle,
  Separator, Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
  Tabs, TabsContent, TabsList, TabsTrigger, cn,
} from '@kibotalk/ui'
import LiveSession from './LiveSession'
import { useConfig } from './config-store'
import { LanguagePrefsFields } from './components/ConfigFields'
import { TraceDialog } from './components/TraceDialog'
import { playgroundReplyModel, playgroundVoiceprint } from './local-settings'

const DirectApi = lazy(() => import('./DirectApi'))
const Enrollment = lazy(() => import('./Enrollment'))
const VadPanel = lazy(() => import('./VadPanel'))
const SpeakerTracks = lazy(() => import('./SpeakerTracks'))
const THEME_KEY = 'kibotalk.playground.theme'

export default function App() {
  const [activePage, setActivePage] = useState('session')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState('language')
  const [hasEmbedding, setHasEmbedding] = useState(false)
  const [replyReady, setReplyReady] = useState(false)
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem(THEME_KEY) === 'dark' } catch { return false }
  })
  const running = useConfig((s) => s.liveSessionRunning)
  const conversationLang = useConfig((s) => s.conversationLang)
  const level = useConfig((s) => s.level)

  const refreshReply = useCallback(async () => {
    const settings = await playgroundReplyModel.settings.load()
    setReplyReady(Boolean(settings.model.trim() && settings.baseURL.trim()))
  }, [])
  const refreshVoiceprint = useCallback(async () => {
    const embedding = await playgroundVoiceprint.load().catch(() => null)
    setHasEmbedding(Boolean(embedding))
  }, [])
  useEffect(() => {
    void refreshReply()
    void refreshVoiceprint()
  }, [refreshReply, refreshVoiceprint])
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try { localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light') } catch { /* storage unavailable */ }
  }, [dark])

  function openModelSettings() {
    setSettingsTab('models')
    setSettingsOpen(true)
  }

  return (
    <main className={cn("mx-auto flex min-h-dvh w-full max-w-7xl flex-col px-4 py-6 sm:px-6", activePage === 'session' && 'lg:h-dvh')}>
      <I18nProvider value={{ ...defaultProductPrefs, conversationLang, level, uiLang: 'zh', theme: dark ? 'dark' : 'light' }}>
        <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
          <Tabs value={activePage} onValueChange={setActivePage} className="flex min-h-0 min-w-0 flex-1 flex-col">
            <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
              <h1 className="text-xl font-semibold tracking-tight">KiboTalk Playground</h1>
              <div className="flex flex-wrap items-center gap-2">
                <TabsList aria-label="Playground 页面">
                  <TabsTrigger value="session">会话{running && <span className="ml-1 size-2 rounded-full bg-emerald-600" aria-label="进行中" />}</TabsTrigger>
                  <TabsTrigger value="analysis">分析</TabsTrigger>
                </TabsList>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="设置" title="设置"><SettingsIcon /></Button>
                </SheetTrigger>
                <Button variant="ghost" size="icon" onClick={() => setDark(!dark)} aria-label={dark ? '切换浅色' : '切换深色'}>
                  {dark ? <SunIcon /> : <MoonIcon />}
                </Button>
              </div>
            </header>
            <TabsContent value="session" forceMount className="flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
              <LiveSession hasEmbedding={hasEmbedding} replyReady={replyReady} onConfigureReply={openModelSettings} />
            </TabsContent>
            <TabsContent value="analysis">
              <Tabs defaultValue="trace" className="space-y-4">
                <TabsList aria-label="分析工具" className="h-auto max-w-full flex-wrap justify-start">
                  <TabsTrigger value="trace">Trace</TabsTrigger>
                  <TabsTrigger value="speakers">声纹轨道</TabsTrigger>
                  <TabsTrigger value="vad">VAD 检测</TabsTrigger>
                  <TabsTrigger value="reply">回复测速</TabsTrigger>
                </TabsList>
                <TabsContent value="trace">
                  <Card>
                    <CardContent className="flex flex-wrap gap-2 pt-6">
                      <TraceDialog><Button><PulseIcon />打开会话 Trace</Button></TraceDialog>
                      <TraceDialog sample><Button variant="outline">查看示例 Trace</Button></TraceDialog>
                    </CardContent>
                  </Card>
                </TabsContent>
                <TabsContent value="speakers">
                  <Suspense fallback={<Badge variant="secondary"><SoundwaveIcon />正在加载声纹轨道</Badge>}><SpeakerTracks /></Suspense>
                </TabsContent>
                <TabsContent value="vad">
                  <Suspense fallback={<p role="status" className="text-sm text-muted-foreground">正在加载 VAD…</p>}><VadPanel /></Suspense>
                </TabsContent>
                <TabsContent value="reply">
                  <Suspense fallback={<p role="status" className="text-sm text-muted-foreground">正在加载回复测速…</p>}>
                    {replyReady ? <DirectApi /> : (
                      <Card>
                        <CardHeader><CardTitle>回复测速</CardTitle><CardDescription>保存回复模型后，即可用示例对话测试响应时间。</CardDescription></CardHeader>
                        <CardContent><Button onClick={openModelSettings}>配置回复模型</Button></CardContent>
                      </Card>
                    )}
                  </Suspense>
                </TabsContent>
              </Tabs>
            </TabsContent>
          </Tabs>
          <SheetContent className="w-full overflow-auto sm:max-w-2xl" aria-describedby={undefined}>
            <SheetHeader className="text-left"><SheetTitle>设置</SheetTitle></SheetHeader>
            <Tabs value={settingsTab} onValueChange={setSettingsTab} className="mt-4 space-y-4">
              <TabsList aria-label="设置项目">
                <TabsTrigger value="language">语言</TabsTrigger>
                <TabsTrigger value="models">模型</TabsTrigger>
                <TabsTrigger value="voiceprint">声纹</TabsTrigger>
              </TabsList>
              <TabsContent value="language">
                <LanguagePrefsFields disabled={running} />
              </TabsContent>
              <TabsContent value="models" className="space-y-5">
                <TranscriptionModelSettings language={conversationLang} locked={running} />
                <Separator />
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">回复模型</h3>
                  <ReplyModelSettings store={playgroundReplyModel.settings} onSaved={refreshReply} />
                </div>
              </TabsContent>
              <TabsContent value="voiceprint">
                <Suspense fallback={<p role="status" className="text-sm text-muted-foreground">正在加载声纹录入…</p>}>
                  <Enrollment onEnrolled={refreshVoiceprint} onGoLive={() => {
                    setActivePage('session')
                    setSettingsOpen(false)
                  }} />
                </Suspense>
              </TabsContent>
            </Tabs>
          </SheetContent>
        </Sheet>
      </I18nProvider>
    </main>
  )
}
