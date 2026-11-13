import type { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@kibotalk/ui'

export function StageShell({
  stage,
  debug,
  debugTitle = '调试',
}: {
  stage: ReactNode
  debug: ReactNode
  debugTitle?: string
}) {
  return (
    <div className="grid min-w-0 items-start gap-4 lg:grid-cols-5">
      <Card className="min-w-0 overflow-hidden py-0 lg:col-span-3">{stage}</Card>
      <Card className="min-w-0 lg:col-span-2">
        <CardHeader><CardTitle>{debugTitle}</CardTitle></CardHeader>
        <CardContent>{debug}</CardContent>
      </Card>
    </div>
  )
}
