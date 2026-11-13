import type { ReplyTextStream } from '@kibotalk/llm'

export const streamDesktopReply: ReplyTextStream = async function* (input, signal) {
  signal.throwIfAborted()
  let cancel: (() => void) | undefined
  const onAbort = () => {
    cancel?.()
    streamController.error(signal.reason)
  }
  let streamController: ReadableStreamDefaultController<string>
  const stream = new ReadableStream<string>({
    start(controller) {
      streamController = controller
      cancel = window.kibotalk.replyModel.stream(input, (message) => {
        switch (message.type) {
          case 'token':
            controller.enqueue(message.text)
            break
          case 'error':
            controller.error(new Error(message.message))
            break
          case 'done':
            controller.close()
            break
        }
      })
      signal.addEventListener('abort', onAbort, { once: true })
    },
  })
  const reader = stream.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      yield value
    }
  } finally {
    signal.removeEventListener('abort', onAbort)
    cancel?.()
    reader.releaseLock()
  }
}
