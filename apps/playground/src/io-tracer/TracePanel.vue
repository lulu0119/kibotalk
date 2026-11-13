<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import { createScope } from '@proj-airi/stream-kit'
import { createTraceViewReader, type TraceItemRef } from '@proj-airi/trace-kit/views'
import { VoiceTracks } from '@proj-airi/trace-kit/voice'
import { buttonVariants, cn, tabsStyles } from '@kibotalk/ui'
import { formatDuration } from '@proj-airi/ui-timeline/headless'
import { TraceDetail, TraceEventLog, TraceMetrics, TraceTimeline, TraceToolbar, useTracerView, type EntityLane } from '@proj-airi/ui-trace'
import { createSampleTrace, exportTrace, filePlaybackTrack, pauseTrace, resetTrace, startTrace, traceCollector, traceIsRecording, traceTick } from './trace'

const props = defineProps<{
  sample: boolean
  playbackCursor: () => number | undefined
  seekPlayback: (time: number) => void
}>()
const sample = props.sample ? createSampleTrace() : undefined
const scope = createScope()
const view = shallowRef(createTraceViewReader((sample ?? traceCollector()).traceClock))
const version = ref(0)
const recording = ref(!sample && traceIsRecording())
const following = ref(!sample)
const clock = ref(performance.now())
const now = () => clock.value
const cursor = ref<number>()
let previousPlaybackCursor: number | undefined
const selection = shallowRef<TraceItemRef>()
const timeline = ref<InstanceType<typeof TraceTimeline>>()
const inspectorTabs = [
  { value: 'log', label: '事件日志' },
  { value: 'metrics', label: '指标' },
]
const tab = ref<string | number>('log')
const panelClass = cn(tabsStyles.content, 'm-0 min-h-0 min-w-0 flex-1 overflow-auto focus-visible:ring-inset focus-visible:ring-offset-0')
const { locale } = useI18n()
const state = computed(() => {
  void version.value
  return view.value.timelineView()
})
const { entities, details, hiddenTracks, toggleLane, setVisibility, summary } = useTracerView({
  state,
  indexes: () => view.value.reader.indexes,
  version,
  locale,
})

const lanePresentation: Partial<Record<string, { label: string; order: number }>> = {
  'participant:user': { label: '我', order: 1 },
  'participant:other': { label: '对方', order: 2 },
  'participant:unknown': { label: '语音识别', order: 3 },
  'participant:assistant': { label: '助手', order: 4 },
  'conversation:live': { label: '会话', order: 5 },
}

function laneOrder(lane: EntityLane) {
  if (lane.tracks.some(track => track.path === filePlaybackTrack || track.definition?.path === VoiceTracks.Input)) return 0
  return lanePresentation[lane.key]?.order ?? 6
}

const lanes = computed(() => entities.value.lanes
  .map(lane => ({ ...lane, label: lanePresentation[lane.key]?.label ?? lane.label }))
  .sort((a, b) => laneOrder(a) - laneOrder(b)))

let unsubscribe: (() => void) | undefined
function connect() {
  unsubscribe?.()
  const collector = sample ?? traceCollector()
  const next = createTraceViewReader(collector.traceClock)
  view.value = next
  unsubscribe = collector.subscribe((message) => {
    next.reader.handle(message)
    version.value++
  }).unsubscribe
}
onMounted(() => {
  connect()
  scope.defer(() => unsubscribe?.())
  if (sample) {
    void nextTick(() => window.requestAnimationFrame(fit))
    return
  }
  const timer = window.setInterval(() => {
    traceTick()
    if (recording.value) clock.value = performance.now()
    const playbackCursor = props.playbackCursor()
    if (playbackCursor !== previousPlaybackCursor && playbackCursor !== undefined) cursor.value = playbackCursor
    previousPlaybackCursor = playbackCursor
  }, 250)
  scope.defer(() => window.clearInterval(timer))
})
onUnmounted(() => { void scope.close() })

function toggleRecording() {
  if (recording.value) pauseTrace()
  else startTrace()
  recording.value = traceIsRecording()
}
function startFromNow() {
  resetTrace()
  recording.value = true
  following.value = true
  selection.value = undefined
  cursor.value = undefined
  connect()
}
function download() {
  exportTrace(sample)
}
function fit() {
  following.value = false
  timeline.value?.fit()
}
function scrub(time: number | undefined) {
  cursor.value = time
  if (time !== undefined) props.seekPlayback(time)
}
</script>

<template>
  <div class="flex h-full min-h-0 w-full flex-col gap-3 overflow-hidden">
    <TraceToolbar
      v-if="!sample"
      :recording="recording"
      :following="following"
      :has-cursor="cursor !== undefined"
      @toggle-recording="toggleRecording"
      @start-from-now="startFromNow"
      @toggle-follow="following = !following"
      @fit="fit"
      @clear-cursor="cursor = undefined"
      @export="download"
    />
    <div v-else class="flex flex-wrap gap-2">
      <button type="button" :class="buttonVariants({ variant: 'outline', size: 'sm' })" @click="fit">适应窗口</button>
      <button type="button" :class="buttonVariants({ variant: 'outline', size: 'sm' })" @click="download">导出 JSONL</button>
    </div>
    <div class="grid min-h-0 min-w-0 flex-1 grid-rows-2 gap-3 lg:grid-cols-3 lg:grid-rows-1">
      <div class="flex min-h-0 min-w-0 overflow-hidden rounded-md border border-border lg:col-span-2">
        <TraceTimeline
          ref="timeline"
          :state="state"
          :indexes="view.reader.indexes"
          :version="version"
          :lanes="lanes"
          :connectors="entities.connectors"
          :details="details"
          :selection="selection"
          :cursor="cursor"
          :follow="following && recording"
          :now="now"
          :hidden="hiddenTracks"
          @select="selection = $event"
          @cursor="scrub"
          @unfollow="following = false"
          @toggle="toggleLane"
          @visibility="setVisibility"
        >
          <template #status>{{ formatDuration(summary.durationMs) }}</template>
        </TraceTimeline>
      </div>
      <TabsRoot
        v-model="tab"
        class="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md border border-border"
        @update:model-value="selection = undefined"
      >
        <div class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border p-2">
          <TabsList aria-label="Trace 检查器" :class="tabsStyles.list">
            <TabsTrigger
              v-for="{ value, label } in inspectorTabs"
              :key="value"
              :value="value"
              :class="tabsStyles.trigger"
              @click="selection = undefined"
            >{{ label }}</TabsTrigger>
          </TabsList>
          <button
            v-if="selection"
            type="button"
            :class="buttonVariants({ variant: 'ghost', size: 'sm' })"
            @click="selection = undefined"
          >关闭详情</button>
        </div>
        <TabsContent v-for="{ value } in inspectorTabs" :key="value" :value="value" :class="panelClass">
          <TraceEventLog
            v-if="value === 'log'"
            v-show="!selection"
            :log="view.eventLogView()"
            :version="version"
            :origin="Number.isFinite(state.start) ? state.start : 0"
            :late="state.counters.late"
            @select="selection = $event"
          />
          <TraceMetrics v-else v-show="!selection" :state="state" :samples="view.metricSamples()" :version="version" :locale="locale" />
          <TraceDetail
            v-if="selection && tab === value"
            :state="state"
            :indexes="view.reader.indexes"
            :version="version"
            :selection="selection"
            @select="selection = $event"
          />
        </TabsContent>
      </TabsRoot>
    </div>
  </div>
</template>
