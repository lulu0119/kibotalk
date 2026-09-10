<script setup lang="ts">
type Segment = {
  surface: string
  role?: 'content' | 'particle' | 'punct'
  reading?: string
}

type Candidate = {
  meaning: string
  segments: Segment[]
}

const latest: Candidate[] = [
  {
    meaning: '不好意思，那个多少钱？',
    segments: [
      { surface: 'すみません、それ' },
      { surface: 'は', role: 'particle' },
      { surface: 'いくらです' },
      { surface: 'か', role: 'particle' },
      { surface: '？', role: 'punct' },
    ],
  },
  {
    meaning: '好的，麻烦您了。',
    segments: [
      { surface: 'はい、' },
      { surface: 'お願い', reading: 'おねが' },
      { surface: 'いします' },
      { surface: '。', role: 'punct' },
    ],
  },
  {
    meaning: '请稍等一下。',
    segments: [
      { surface: '少々', reading: 'しょうしょう' },
      { surface: 'お' },
      { surface: '待', reading: 'ま' },
      { surface: 'ちください' },
      { surface: '。', role: 'punct' },
    ],
  },
]
</script>

<template>
  <div class="desktop-island-stack">
    <div class="glass-chip desktop-transcript">
      <strong>我</strong>
      <span>「すみません、それは……」</span>
    </div>

    <section class="sticky-note desktop-latest" aria-label="本轮建议">
      <div class="suggestion-meta">
        <span>本轮建议</span>
        <span>刚刚</span>
      </div>
      <ol>
        <li v-for="(candidate, index) in latest" :key="index">
          <div class="candidate-target">
            <template v-for="(segment, segmentIndex) in candidate.segments" :key="segmentIndex">
              <ruby v-if="segment.reading">
                {{ segment.surface }}
                <rt>{{ segment.reading }}</rt>
              </ruby>
              <span
                v-else
                :class="{
                  particle: segment.role === 'particle',
                  punct: segment.role === 'punct',
                }"
              >{{ segment.surface }}</span>
            </template>
          </div>
          <div class="candidate-meaning">{{ candidate.meaning }}</div>
        </li>
      </ol>
    </section>

    <div class="island-bar desktop-island-bar" role="toolbar" aria-label="悬浮岛">
      <div class="island-status">
        <span class="island-dot" />
        <span>转写中</span>
      </div>
      <span class="island-separator" />
      <button type="button" class="island-toggle is-on" aria-label="暂停">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="14" y="3" width="5" height="18" rx="1" /><rect x="5" y="3" width="5" height="18" rx="1" /></svg>
      </button>
      <button type="button" class="island-nav" aria-label="停止并保存">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" /></svg>
      </button>
      <button type="button" class="island-toggle is-on" aria-label="AI 建议">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" /><path d="M20 2v4" /><path d="M22 4h-4" /></svg>
      </button>
      <span class="island-separator" />
      <button type="button" class="island-nav" aria-label="拖动">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20" /><path d="m15 19-3 3-3-3" /><path d="m19 9 3 3-3 3" /><path d="M2 12h20" /><path d="m5 9-3 3 3 3" /><path d="m9 5 3-3 3 3" /></svg>
      </button>
      <button type="button" class="island-nav" aria-label="更多">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></svg>
      </button>
    </div>
  </div>
</template>
