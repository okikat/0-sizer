import { useEffect, useState } from 'react'

const LINES = [
  '私もこのアプリを作り始めた時は、',
  'シンセサイザーに触ったこともありませんでした。',
  'だから、キミにもできます。',
  'このチュートリアルを終えた頃には、',
  'キミの手で、キミの曲を作れるようになります。',
]

interface Props {
  onDone: () => void
}

/** イントロ：メッセージを1文ずつフェードインで見せる。タップで全文を即表示。 */
export function IntroScreen({ onDone }: Props) {
  const [n, setN] = useState(0)

  useEffect(() => {
    if (n >= LINES.length) return
    const t = setTimeout(() => setN(n + 1), n === 0 ? 500 : 1600)
    return () => clearTimeout(t)
  }, [n])

  const done = n >= LINES.length

  return (
    <div className="screen intro-screen" onClick={() => !done && setN(LINES.length)}>
      <div className="intro-lines">
        {LINES.slice(0, n).map((l, i) => (
          <p key={i} className="intro-line fade-up">
            {l}
          </p>
        ))}
      </div>
      <button className={'cta intro-next' + (done ? ' show' : '')} onClick={onDone}>
        次へ
      </button>
    </div>
  )
}
