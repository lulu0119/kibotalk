import { useEffect, useRef } from 'react'
import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import TracePanel from './TracePanel.vue'

const messages = {
  'zh-Hans': {
    tamagotchi: {
      settings: {
        devtools: {
          pages: {
            'io-tracer': {
              actions: {
                pause: '暂停记录',
                record: '开始记录',
                'start-from-now': '从现在开始',
                'start-from-now-description': '清空已有记录，从现在开始跟随。',
                fit: '适应窗口',
                'clear-cursor': '清除游标',
                export: '导出 JSONL',
                show: '显示 {name}',
                hide: '隐藏 {name}',
              },
              toggles: { follow: '跟随' },
              view: { label: '视图', all: '全部轨道' },
            },
          },
        },
      },
    },
  },
}

type TracePlayback = { cursor: () => number | undefined; seek: (time: number) => void }

export function IoTracer({ sample, playback }: { sample: boolean; playback?: TracePlayback }) {
  const mount = useRef<HTMLDivElement>(null)
  const playbackRef = useRef(playback)
  playbackRef.current = playback
  useEffect(() => {
    if (!mount.current) return
    const app = createApp(TracePanel, {
      sample,
      playbackCursor: () => playbackRef.current?.cursor(),
      seekPlayback: (time: number) => playbackRef.current?.seek(time),
    })
    app.use(createI18n({ legacy: false, locale: 'zh-Hans', messages }))
    app.mount(mount.current)
    return () => app.unmount()
  }, [sample])
  return <div ref={mount} className="kibotalk-trace h-full min-h-0 min-w-0" />
}
