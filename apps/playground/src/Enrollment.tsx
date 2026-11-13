import { useEffect, useRef, useState } from 'react'
import { EmbeddingSpeakerVerifier, EnrollmentAudioError } from '@kibotalk/speaker'
import type { Speaker } from '@kibotalk/conversation'
import {
  Badge,
  Button,
  Input,
  Separator,
  toast,
} from '@kibotalk/ui'
import {
  ArrowRightIcon,
  ImportIcon,
  LoaderIcon,
  MicrophoneIcon,
  RestartIcon,
  StopIcon,
  TrashBinTrashIcon,
} from '@kibotalk/ui/icons'
import {
  AudioSource,
  createWorkerEmbedAudio,
  PASSPHRASE_BY_LANG,
} from '@kibotalk/app-shared'
import { concatPcm, decodeMonoAudio } from './audio-file'
import { useConfig } from './config-store'
import { ThresholdSlider } from './components/ConfigFields'
import { playgroundVoiceprint } from './local-settings'

type Mode = 'enroll' | 'verify'
type WizardStep = 'intro' | 'record' | 'done'

export default function Enrollment({
  onEnrolled,
  onGoLive,
}: {
  onEnrolled?: () => void
  onGoLive?: () => void
}) {
  const [step, setStep] = useState<WizardStep>('intro')
  const [recording, setRecording] = useState<Mode | null>(null)
  const [working, setWorking] = useState<'saving' | 'busy' | null>(null)
  const [error, setError] = useState('')
  const [enrolled, setEnrolled] = useState(false)
  const [verifyView, setVerifyView] = useState<{ speaker: Speaker; similarity: number } | null>(null)
  const speakerThreshold = useConfig((s) => s.speakerThreshold)
  const conversationLang = useConfig((s) => s.conversationLang)
  const passphrase = PASSPHRASE_BY_LANG[conversationLang]
  const verifierRef = useRef<EmbeddingSpeakerVerifier | null>(null)
  const audioRef = useRef<AudioSource | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const chunksRef = useRef<Float32Array[]>([])

  function verifier() {
    return (verifierRef.current ??= new EmbeddingSpeakerVerifier({
      embedAudio: createWorkerEmbedAudio(),
      storage: playgroundVoiceprint,
      threshold: useConfig.getState().speakerThreshold,
    }))
  }

  function fail(message: string) {
    setError(message)
    toast.error(message)
  }

  useEffect(() => {
    void verifier()
      .loadEmbedding()
      .then((e) => {
        const ok = !!e
        setEnrolled(ok)
        if (ok) setStep('done')
      })
      .catch((e) => fail(String(e)))
    return () => {
      audioRef.current?.stop()
      audioRef.current = null
    }
  }, [])

  useEffect(() => {
    verifierRef.current?.setThreshold(speakerThreshold)
    setVerifyView((prev) =>
      prev
        ? { ...prev, speaker: prev.similarity >= speakerThreshold ? 'user' : 'other' }
        : prev,
    )
  }, [speakerThreshold])

  async function start(mode: Mode) {
    setError('')
    setVerifyView(null)
    chunksRef.current = []
    setWorking('busy')
    const audio = new AudioSource()
    audioRef.current = audio
    try {
      await audio.start((chunk) => chunksRef.current.push(chunk))
      if (audioRef.current !== audio) {
        audio.stop()
        return
      }
      setRecording(mode)
    } catch (e) {
      fail((e as Error).message)
      audio.stop()
      audioRef.current = null
    } finally {
      setWorking(null)
    }
  }

  async function stop() {
    const mode = recording
    if (!mode) return
    const pcm = concatPcm(chunksRef.current)
    chunksRef.current = []
    audioRef.current?.stop()
    audioRef.current = null
    setRecording(null)

    if (pcm.length === 0) {
      fail('没有录到音频，请重试')
      return
    }

    await processAudio(mode, () => pcm, passphrase)
  }

  async function processAudio(mode: Mode, read: () => Float32Array | Promise<Float32Array>, phrase = '') {
    setError('')
    setWorking(mode === 'enroll' ? 'saving' : 'busy')
    try {
      const pcm = await read()
      const v = verifier()
      v.setThreshold(useConfig.getState().speakerThreshold)
      if (mode === 'enroll') {
        await v.enroll((async function* () { yield pcm.buffer as ArrayBuffer })(), phrase)
        setVerifyView(null)
        setEnrolled(true)
        setStep('done')
        onEnrolled?.()
      } else {
        const embedding = await v.loadEmbedding()
        if (!embedding) throw new Error('本设备尚无声纹，请先录入')
        const r = await v.verify(pcm.buffer as ArrayBuffer, embedding)
        setVerifyView({ speaker: r.speaker, similarity: r.similarity })
      }
    } catch (cause) {
      if (cause instanceof EnrollmentAudioError) {
        fail(cause.code === 'too-short' ? '请提供至少 2.5 秒清晰的单人语音。' : '音频中的人声太轻，请换一段清晰的单人语音。')
      } else {
        fail(cause instanceof Error ? cause.message : String(cause))
      }
    } finally {
      setWorking(null)
    }
  }

  async function clearVoiceprint() {
    setError('')
    setWorking('busy')
    try {
      await playgroundVoiceprint.clear()
      setEnrolled(false)
      setVerifyView(null)
      setStep('intro')
      onEnrolled?.()
    } catch (cause) {
      fail(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setWorking(null)
    }
  }

  const busy = recording !== null || working !== null
  const importButton = (
    <Button variant="outline" onClick={() => fileInput.current?.click()} disabled={busy}>
      <ImportIcon />
      导入音频
    </Button>
  )

  return (
    <div className="space-y-5">
      <section className="space-y-3" aria-label="声纹录入">
        <Input
          ref={fileInput}
          type="file"
          accept="audio/*"
          className="hidden"
          aria-label="导入声纹音频"
          disabled={busy}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ''
            if (file) void processAudio('enroll', async () => (await decodeMonoAudio(file)).samples)
          }}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">声纹录入</h3>
          <Badge variant="secondary">{enrolled ? '已录入' : '未录入'}</Badge>
        </div>

        {step === 'intro' && (
          <>
            <p className="text-sm text-muted-foreground">用麦克风录音或导入一段单人语音。声纹仅保存在此设备。</p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setStep('record')} disabled={busy}>
                <MicrophoneIcon />
                开始录入
              </Button>
              {importButton}
            </div>
          </>
        )}

        {step === 'record' && (
          <>
            <div className="space-y-1 rounded-md border bg-muted/40 p-4">
              <p className="text-sm text-muted-foreground">请朗读</p>
              <p className="font-medium leading-relaxed">{passphrase}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {recording === 'enroll' ? (
                <Button variant="destructive" onClick={() => void stop()}>
                  <StopIcon />
                  结束录音
                </Button>
              ) : (
                <Button onClick={() => void start('enroll')} disabled={busy}>
                  <MicrophoneIcon />
                  开始录音
                </Button>
              )}
              <Button variant="outline" onClick={() => setStep(enrolled ? 'done' : 'intro')} disabled={busy}>取消</Button>
            </div>
          </>
        )}

        {step === 'done' && (
          <div className="flex flex-wrap gap-2">
            {onGoLive && (
              <Button onClick={onGoLive} disabled={busy}>
                <ArrowRightIcon />
                返回会话
              </Button>
            )}
            <Button variant="outline" onClick={() => setStep('record')} disabled={busy}>
              <RestartIcon />
              重新录制
            </Button>
            {importButton}
            <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => void clearVoiceprint()} disabled={busy}>
              <TrashBinTrashIcon />
              清除声纹
            </Button>
          </div>
        )}
        {working === 'saving' && (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderIcon className="size-4 animate-spin" />
            正在保存声纹…
          </p>
        )}
      </section>

      {enrolled && step === 'done' && (
        <>
          <Separator />
          <section className="space-y-3" aria-label="声纹校验">
            <h3 className="text-sm font-semibold">声纹校验</h3>
            <ThresholdSlider
              label="匹配阈值"
              hint="相似度达到阈值时，判为同一人。"
              value={speakerThreshold}
              disabled={busy}
              onChange={(value) => useConfig.getState().patch({ speakerThreshold: value })}
            />
            {recording === 'verify' ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="destructive" onClick={() => void stop()}><StopIcon />结束校验</Button>
                <p role="status" className="text-sm text-muted-foreground">随便说一句，说完点结束。</p>
              </div>
            ) : (
              <Button variant="outline" onClick={() => void start('verify')} disabled={busy}>
                <MicrophoneIcon />
                开始校验
              </Button>
            )}
            {verifyView && (
              <p role="status" className="text-sm text-muted-foreground">
                {verifyView.speaker === 'user' ? '声纹匹配' : '声纹未匹配'}
                {' · '}相似度 {verifyView.similarity.toFixed(3)}
              </p>
            )}
          </section>
        </>
      )}

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
