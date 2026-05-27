import { describe, it, expect } from 'vitest'
import { LESSONS, FRAME_TITLE, FRAME_HELP, ALL_FRAMES, lessonForFrame, type FrameId } from './lessons'

// レッスン定義の整合性を守る。FrameId を増やしたが LESSONS／FRAME_HELP の
// どちらかを更新し忘れる、といったミスをここで検知する。
describe('lessons', () => {
  it('LESSONS は 1 つ以上ある', () => {
    expect(LESSONS.length).toBeGreaterThan(0)
  })

  it('LESSONS の id は全てユニーク', () => {
    const ids = LESSONS.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('LESSONS.id は LESSONS.realizes に含まれる', () => {
    for (const l of LESSONS) {
      expect(l.realizes, l.id).toContain(l.id)
    }
  })

  it('ALL_FRAMES は全 LESSON.realizes をフラット化したもの（重複なし）', () => {
    const flat = LESSONS.flatMap((l) => l.realizes)
    expect(ALL_FRAMES).toEqual(flat)
    expect(new Set(ALL_FRAMES).size).toBe(ALL_FRAMES.length)
  })

  it('FRAME_TITLE は全 FrameId（= ALL_FRAMES）をカバー', () => {
    for (const f of ALL_FRAMES) {
      expect(FRAME_TITLE[f], f).toBeDefined()
      expect(FRAME_TITLE[f].length).toBeGreaterThan(0)
    }
  })

  it('FRAME_HELP は全 FrameId をカバーし、title と段落 ≥ 1 を持つ', () => {
    for (const f of ALL_FRAMES) {
      const h = FRAME_HELP[f]
      expect(h, f).toBeDefined()
      expect(h.title.length).toBeGreaterThan(0)
      expect(h.paragraphs.length).toBeGreaterThan(0)
      for (const p of h.paragraphs) {
        expect(p.length).toBeGreaterThan(0)
      }
    }
  })

  it('全 LESSON.popup は 1 段落以上、空文字なし', () => {
    for (const l of LESSONS) {
      expect(l.popup.length).toBeGreaterThan(0)
      for (const p of l.popup) {
        expect(p.length).toBeGreaterThan(0)
      }
    }
  })

  it('stageTitle は全 LESSON で非空', () => {
    for (const l of LESSONS) {
      expect(l.stageTitle.length).toBeGreaterThan(0)
    }
  })

  describe('lessonForFrame', () => {
    it('全 FrameId について lesson を返す（解説の再表示で undefined にならない）', () => {
      for (const f of ALL_FRAMES) {
        const l = lessonForFrame(f)
        expect(l, f).toBeDefined()
        expect(l.realizes).toContain(f)
      }
    })

    it('id 自身についても lesson を返す', () => {
      for (const l of LESSONS) {
        expect(lessonForFrame(l.id).id).toBe(l.id)
      }
    })
  })

  it('全 LESSON.id は FrameId に含まれる（=ALL_FRAMES に居る）', () => {
    const setAll = new Set<FrameId>(ALL_FRAMES)
    for (const l of LESSONS) {
      expect(setAll.has(l.id), l.id).toBe(true)
    }
  })
})
