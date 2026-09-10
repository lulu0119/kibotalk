<script setup lang="ts">
import IslandStack from './IslandStack.vue'

const points = [
  { kicker: 'LISTEN', title: '本机声纹', body: '先分清是你还是对方。embedding 不出本机。' },
  { kicker: 'CUE', title: '三句下一句', body: '卡壳时给出可贴语境的表达，日语带读音和助词。' },
  { kicker: 'SPEAK', title: '你来开口', body: '不做代说。选择权与声音始终属于你。' },
]
</script>

<template>
  <div class="mac-desktop">
    <div class="mac-menubar">
      <div class="mac-menubar-left">
        <span class="mac-apple" aria-hidden="true"></span>
        <strong>KiboTalk</strong>
        <span>文件</span>
        <span>编辑</span>
        <span>显示</span>
        <span>窗口</span>
      </div>
      <div class="mac-menubar-right">
        <span>Tue 21:59</span>
      </div>
    </div>

    <div class="mac-wallpaper island-stage">
      <aside class="desktop-copy">
        <p class="kicker">THE SOLUTION</p>
        <h1 class="desktop-title">AI 给提示，<mark>你自己开口。</mark></h1>
        <ul class="desktop-points">
          <li v-for="point in points" :key="point.kicker">
            <span>{{ point.kicker }}</span>
            <strong>{{ point.title }}</strong>
            <p>{{ point.body }}</p>
          </li>
        </ul>
      </aside>
      <IslandStack />
    </div>
  </div>
</template>
