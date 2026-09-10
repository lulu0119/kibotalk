<script setup lang="ts">
import LanguageMarquee from './LanguageMarquee.vue'
</script>

<template>
  <div class="cover-page">
    <header class="cover-header">
      <img class="cover-wordmark" src="/assets/kibotalk-wordmark.svg" alt="KiboTalk" />
      <span class="cover-cta">立即体验</span>
    </header>

    <LanguageMarquee />

    <div class="cover-fade" />

    <section class="cover-hero">
      <p class="kicker hero-enter">REAL LIFE, REAL VOICE</p>
      <h1 class="cover-title hero-enter hero-enter-delay-1">
        <span>听懂了，</span>
        <mark>却答不上来？</mark>
      </h1>
      <p class="cover-statement hero-enter hero-enter-delay-2">
        翻译让你听懂，<strong>KiboTalk 让你答得上来。</strong>
      </p>
      <p class="cover-tagline hero-enter hero-enter-delay-3">AI 提示，你开口。</p>
    </section>
  </div>
</template>
