export const locales = ['zh', 'ja', 'en'] as const

export type Locale = (typeof locales)[number]

type LandingCopy = {
  localeName: string
  nav: {
    scenes: string
    product: string
    story: string
    mission: string
  }
  actions: {
    web: string
    mac: string
    playground: string
    top: string
  }
  hero: {
    eyebrow: string
    titleLead: string
    titleMark: string
    statementLead: string
    statementStrong: string
    tagline: string
    macNote: string
  }
  scenes: {
    eyebrow: string
    titleLead: string
    titleMark: string
    ariaLabel: string
  }
  product: {
    eyebrow: string
    titleLead: string
    titleMark: string
    body: string
    transcriptSpeaker: string
    transcript: string
    suggestionLabel: string
    now: string
    listening: string
    candidates: Array<{
      targetText: string
      meaning: string
      reading?: string
    }>
  }
  story: {
    eyebrow: string
    title: string
    body: string
    productionLabel: string
    productionTitle: string
    productionBody: string
    capabilities: string[]
  }
  mission: {
    eyebrow: string
    titleLead: string
    titleMark: string
    body: string
    compatibility: string
    gatekeeper: string
  }
  footer: {
    statement: string
    github: string
    adventurex: string
    original: string
  }
}

export const copy: Record<Locale, LandingCopy> = {
  zh: {
    localeName: '中文',
    nav: {
      scenes: '真实场景',
      product: '如何工作',
      story: '开发故事',
      mission: '我们的使命',
    },
    actions: {
      web: '打开网页版',
      mac: 'macOS 版安装说明',
      playground: '打开 Playground',
      top: '回到顶部',
    },
    hero: {
      eyebrow: 'REAL LIFE, REAL VOICE',
      titleLead: '听懂了，',
      titleMark: '却答不上来？',
      statementLead: '翻译让你听懂，',
      statementStrong: 'KiboTalk 让你答得上来。',
      tagline: 'AI 提示，你开口。',
      macNote: 'Apple Silicon · macOS 13+',
    },
    scenes: {
      eyebrow: 'REAL LIFE, REAL VOICE',
      titleLead: '每一次开口，',
      titleMark: '都在真实世界。',
      ariaLabel: '日本真实生活场景地图',
    },
    product: {
      eyebrow: 'THE SOLUTION',
      titleLead: 'AI 给提示，',
      titleMark: '你自己开口。',
      body: 'KiboTalk 听取真实对话，在你卡壳时给出三句贴合语境的表达。选择权与声音始终属于你。',
      transcriptSpeaker: '我',
      transcript: '「すみません、それは……」',
      suggestionLabel: '本轮建议',
      now: '刚刚',
      listening: '转写中',
      candidates: [
        {
          targetText: 'すみません、それはいくらですか？',
          meaning: '不好意思，那个多少钱？',
          reading: 'Sumimasen, sore wa ikura desu ka?',
        },
        {
          targetText: 'はい、お願いします。',
          meaning: '好的，麻烦您了。',
          reading: 'Hai, onegai shimasu.',
        },
        {
          targetText: '少々お待ちください。',
          meaning: '请稍等一下。',
          reading: 'Shōshō omachi kudasai.',
        },
      ],
    },
    story: {
      eyebrow: 'FROM VALIDATION TO PRODUCTION',
      title: '把现场能说出口的下一句，做成真正可用的产品。',
      body: '人们缺的往往不是翻译，而是对话现场能说出口的下一句。KiboTalk 会在对话进行时给出可以直接开口的建议。',
      productionLabel: '现在的产品',
      productionTitle: 'KiboTalk 自研栈',
      productionBody: '转写在设备上完成，回复建议使用你配置的模型服务。',
      capabilities: ['语音活动检测', '声纹验证', '实时转写', '会话历史', 'Web / PWA / 桌面端'],
    },
    mission: {
      eyebrow: 'READY FOR THE REAL CONVERSATION',
      titleLead: '下一次卡壳前，',
      titleMark: '让 KiboTalk 在场。',
      body: '我们希望技术退到背景，让每个人在真实世界的对话里，都能更从容地说出下一句。',
      compatibility: '桌面版支持 Apple Silicon、macOS 13 及以上版本。',
      gatekeeper: '当前版本为未公证测试版，首次打开需在系统“隐私与安全性”中确认。',
    },
    footer: {
      statement: 'AI 提示，你开口。',
      github: 'GitHub',
      adventurex: 'AdventureX',
      original: '灵光闪应用',
    },
  },
  ja: {
    localeName: '日本語',
    nav: {
      scenes: 'リアルな場面',
      product: '使い方',
      story: '開発ストーリー',
      mission: '私たちの使命',
    },
    actions: {
      web: 'Web版を開く',
      mac: 'macOS版のセットアップ',
      playground: 'Playgroundを開く',
      top: 'ページ上部へ',
    },
    hero: {
      eyebrow: 'REAL LIFE, REAL VOICE',
      titleLead: '聞き取れた。',
      titleMark: 'なのに、返せない？',
      statementLead: '翻訳は理解を助ける。',
      statementStrong: 'KiboTalkは返事を助ける。',
      tagline: 'AIがヒントを。話すのは、あなた。',
      macNote: 'Apple Silicon · macOS 13以降',
    },
    scenes: {
      eyebrow: 'REAL LIFE, REAL VOICE',
      titleLead: '話すたびに、',
      titleMark: 'そこは本当の世界。',
      ariaLabel: '日本でのリアルな生活場面',
    },
    product: {
      eyebrow: 'THE SOLUTION',
      titleLead: 'AIがヒントを。',
      titleMark: '話すのは、あなた。',
      body: 'KiboTalkは実際の会話を聞き、言葉に詰まった瞬間に、その場に合う3つの表現を提案します。選ぶのも、声にするのもあなたです。',
      transcriptSpeaker: '自分',
      transcript: '「すみません、それは……」',
      suggestionLabel: '今回の提案',
      now: 'たった今',
      listening: '文字起こし中',
      candidates: [
        {
          targetText: 'すみません、それはいくらですか？',
          meaning: 'Excuse me, how much is that?',
          reading: 'Sumimasen, sore wa ikura desu ka?',
        },
        {
          targetText: 'はい、お願いします。',
          meaning: 'Yes, please.',
          reading: 'Hai, onegai shimasu.',
        },
        {
          targetText: '少々お待ちください。',
          meaning: 'Please wait a moment.',
          reading: 'Shōshō omachi kudasai.',
        },
      ],
    },
    story: {
      eyebrow: 'FROM VALIDATION TO PRODUCTION',
      title: '会話の現場で口にできる次の一言を、長く使えるプロダクトへ。',
      body: '必要なのは翻訳だけではなく、会話の現場で口にできる「次の一言」。KiboTalkは会話中に、その場で言える返事を提案します。',
      productionLabel: '現在のプロダクト',
      productionTitle: 'KiboTalk 自社開発スタック',
      productionBody: '文字起こしは端末上で行い、返信候補には設定したモデルサービスを使います。',
      capabilities: ['音声区間検出', '話者照合', 'リアルタイム文字起こし', '会話履歴', 'Web / PWA / デスクトップ'],
    },
    mission: {
      eyebrow: 'READY FOR THE REAL CONVERSATION',
      titleLead: '次に言葉に詰まる前に、',
      titleMark: 'KiboTalkをそばに。',
      body: 'テクノロジーは背景へ。誰もが現実の会話で、次の一言をもっと自然に口にできる世界を目指します。',
      compatibility: 'デスクトップ版はApple Silicon、macOS 13以降に対応しています。',
      gatekeeper: '現在は未公証のテスト版です。初回起動時に「プライバシーとセキュリティ」で許可してください。',
    },
    footer: {
      statement: 'AIがヒントを。話すのは、あなた。',
      github: 'GitHub',
      adventurex: 'AdventureX',
      original: '灵光 Flash App',
    },
  },
  en: {
    localeName: 'English',
    nav: {
      scenes: 'Real moments',
      product: 'How it works',
      story: 'Our build story',
      mission: 'Our mission',
    },
    actions: {
      web: 'Open the Web app',
      mac: 'Set up on macOS',
      playground: 'Open Playground',
      top: 'Back to top',
    },
    hero: {
      eyebrow: 'REAL LIFE, REAL VOICE',
      titleLead: 'You understood.',
      titleMark: "But couldn't reply?",
      statementLead: 'Translation helps you understand. ',
      statementStrong: 'KiboTalk helps you answer.',
      tagline: 'AI gives the cue. You speak.',
      macNote: 'Apple Silicon · macOS 13+',
    },
    scenes: {
      eyebrow: 'REAL LIFE, REAL VOICE',
      titleLead: 'Every time you speak,',
      titleMark: "it's in the real world.",
      ariaLabel: 'Map of real-life situations in Japan',
    },
    product: {
      eyebrow: 'THE SOLUTION',
      titleLead: 'AI gives the cue. ',
      titleMark: 'You say it yourself.',
      body: 'KiboTalk listens to the real conversation and offers three natural replies when you get stuck. The choice—and the voice—stay yours.',
      transcriptSpeaker: 'You',
      transcript: '「すみません、それは……」',
      suggestionLabel: 'Reply ideas',
      now: 'Just now',
      listening: 'Transcribing',
      candidates: [
        {
          targetText: 'すみません、それはいくらですか？',
          meaning: 'Excuse me, how much is that?',
          reading: 'Sumimasen, sore wa ikura desu ka?',
        },
        {
          targetText: 'はい、お願いします。',
          meaning: 'Yes, please.',
          reading: 'Hai, onegai shimasu.',
        },
        {
          targetText: '少々お待ちください。',
          meaning: 'Please wait a moment.',
          reading: 'Shōshō omachi kudasai.',
        },
      ],
    },
    story: {
      eyebrow: 'FROM VALIDATION TO PRODUCTION',
      title: 'The next sentence you can actually say, built for real life.',
      body: 'KiboTalk suggests lines you can say while the conversation is still happening.',
      productionLabel: 'The product today',
      productionTitle: 'The KiboTalk stack',
      productionBody: 'Transcription runs on your device. Reply suggestions use the model service you configure.',
      capabilities: ['Voice activity detection', 'Speaker verification', 'Live transcription', 'Session history', 'Web / PWA / desktop'],
    },
    mission: {
      eyebrow: 'READY FOR THE REAL CONVERSATION',
      titleLead: 'Before the next stuck moment,',
      titleMark: 'have KiboTalk there.',
      body: 'We want the technology to fade into the background, so anyone can say the next thing with more confidence in a real conversation.',
      compatibility: 'The desktop app supports Apple Silicon and macOS 13 or later.',
      gatekeeper: 'This is currently an unnotarized test build. On first launch, approve it in Privacy & Security.',
    },
    footer: {
      statement: 'AI gives the cue. You speak.',
      github: 'GitHub',
      adventurex: 'AdventureX',
      original: 'Lingguang Flash App',
    },
  },
}

export function localeFromPath(pathname: string): Locale {
  const segment = pathname.split('/').filter(Boolean)[0]
  return locales.includes(segment as Locale) ? (segment as Locale) : 'en'
}
