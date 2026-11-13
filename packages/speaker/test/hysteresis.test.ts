import { describe, expect, it } from 'vitest'
import { classifySpeaker, stabilizeSpeaker } from '../src/hysteresis'

describe('speaker decision hysteresis', () => {
  it('leaves a preview unassigned inside the decision margin', () => {
    expect(classifySpeaker(0.64, 0.6)).toBeNull()
    expect(classifySpeaker(0.56, 0.6)).toBeNull()
    expect(classifySpeaker(0.67, 0.6)).toBe('user')
    expect(classifySpeaker(0.53, 0.6)).toBe('other')
  })

  it('requires strong user evidence before switching from other', () => {
    expect(stabilizeSpeaker(0.82, 'other', 0.8)).toBe('other')
    expect(stabilizeSpeaker(0.86, 'other', 0.8)).toBe('user')
  })

  it('requires strong non-target evidence before switching from user', () => {
    expect(stabilizeSpeaker(0.78, 'user', 0.8)).toBe('user')
    expect(stabilizeSpeaker(0.74, 'user', 0.8)).toBe('other')
  })

  it('uses the configured margin around the model threshold', () => {
    expect(stabilizeSpeaker(0.83, 'other', 0.8, 0.02)).toBe('user')
  })
})
