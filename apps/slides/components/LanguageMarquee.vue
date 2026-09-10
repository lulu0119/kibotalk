<script setup lang="ts">
const phrases = [
  '今天过得怎么样？',
  'How was your day today?',
  '今日はどんな一日でしたか？',
  '最近在听什么歌呢？',
  'What music are you listening to lately?',
  '最近どんな音楽を聴いてますか？',
  '你好呀，初次见面',
  'Nice to meet you!',
  'こんにちは、はじめまして！',
  '聊聊旅行中的趣事吧~',
  'Let’s share fun travel stories.',
  '旅行の面白い話をしよう。',
]

const emojis = ['🎵', '🌟', '✈️', '😊']

function rowItems(offset: number) {
  return Array.from({ length: 8 }, (_, index) => {
    const phrase = phrases[(index + offset) % phrases.length]
    const emoji = emojis[(index + offset) % emojis.length]
    return `${phrase}  ${emoji}`
  })
}

const rows = [
  { duration: 46, reverse: false, opacity: 0.32, items: rowItems(0) },
  { duration: 38, reverse: true, opacity: 0.42, items: rowItems(3) },
  { duration: 52, reverse: false, opacity: 0.55, items: rowItems(6) },
  { duration: 34, reverse: true, opacity: 0.4, items: rowItems(9) },
  { duration: 44, reverse: false, opacity: 0.3, items: rowItems(1) },
]
</script>

<template>
  <div class="language-marquee" aria-hidden="true">
    <div
      v-for="(row, rowIndex) in rows"
      :key="rowIndex"
      class="language-marquee-row"
      :class="{ reverse: row.reverse }"
      :style="{
        '--marquee-duration': `${row.duration}s`,
        '--marquee-opacity': row.opacity,
      }"
    >
      <div class="language-marquee-track">
        <span v-for="copy in 2" :key="copy" class="language-marquee-chunk">
          <span v-for="(item, itemIndex) in row.items" :key="`${copy}-${itemIndex}`" class="language-marquee-item">
            {{ item }}
          </span>
        </span>
      </div>
    </div>
  </div>
</template>
