<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { createScope } from '@proj-airi/stream-kit'
import { createTraceViewReader, type TraceItemRef } from '@proj-airi/trace-kit/views'
import { buttonVariants } from '@kibotalk/ui'
import { formatDuration } from '@proj-airi/ui-timeline/headless'
import { TraceDetail, TraceEventLog, TraceMetrics, TraceTimeline, TraceToolbar, useTracerView } from '@proj-airi/ui-trace'
import { createSampleTrace, exportTrace, pauseTrace, resetTrace, startTrace, traceCollector, traceIsRecording, traceTick } from './trace'

const props = defineProps<{ sample: boolean }>()
const sample = props.sample ? createSampleTrace() : undefined
const scope = createScope()
const view = shallowRef(createTraceViewReader((sample ?? traceCollector()).traceClock))
const version = ref(0)
const recording = ref(!sample && traceIsRecording())
const following = ref(!sample)
const clock = ref(performance.now())
const now = () => clock.value
const cursor = ref<number>()
const selection = shallowRef<TraceItemRef>()
const timeline = ref<InstanceType<typeof TraceTimeline>>()
const tab = ref<'log' | 'metrics'>('log')
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
          :lanes="entities.lanes"
          :connectors="entities.connectors"
          :details="details"
          :selection="selection"
          :cursor="cursor"
          :follow="following && recording"
          :now="now"
          :hidden="hiddenTracks"
          @select="selection = $event"
          @cursor="cursor = $event"
          @unfollow="following = false"
          @toggle="toggleLane"
          @visibility="setVisibility"
        >
          <template #status>{{ formatDuration(summary.durationMs) }}</template>
        </TraceTimeline>
      </div>
      <div class="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md border border-border">
        <div class="flex shrink-0 flex-wrap gap-1 border-b border-border p-2" role="group" aria-label="Trace 检查器">
          <button type="button" :class="buttonVariants({ variant: !selection && tab === 'log' ? 'secondary' : 'ghost', size: 'sm' })" :aria-pressed="!selection && tab === 'log'" @click="selection = undefined; tab = 'log'">事件日志</button>
          <button type="button" :class="buttonVariants({ variant: !selection && tab === 'metrics' ? 'secondary' : 'ghost', size: 'sm' })" :aria-pressed="!selection && tab === 'metrics'" @click="selection = undefined; tab = 'metrics'">指标</button>
          <button v-if="selection" type="button" :class="buttonVariants({ variant: 'secondary', size: 'sm' })" aria-pressed="true" @click="selection = undefined">详情 ×</button>
        </div>
        <div class="min-h-0 min-w-0 flex-1 overflow-auto">
          <TraceDetail
            v-if="selection"
            :state="state"
            :indexes="view.reader.indexes"
            :version="version"
            :selection="selection"
            @select="selection = $event"
          />
          <TraceEventLog
            v-else-if="tab === 'log'"
            :log="view.eventLogView()"
            :version="version"
            :origin="Number.isFinite(state.start) ? state.start : 0"
            :late="state.counters.late"
            @select="selection = $event"
          />
          <TraceMetrics v-else :state="state" :samples="view.metricSamples()" :version="version" :locale="locale" />
        </div>
      </div>
    </div>
  </div>
</template>
