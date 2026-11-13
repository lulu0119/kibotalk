<script setup lang="ts">
import { languageMarqueeRows } from '../../../packages/ui/src/marketing/language-marquee'
import '../../../packages/ui/src/marketing/language-marquee.css'
</script>

<template>
  <div class="language-marquee" aria-hidden="true">
    <div
      v-for="(row, rowIndex) in languageMarqueeRows"
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
