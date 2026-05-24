import { useState } from 'react'
import { useSynth } from './audio/useSynth'
import { Knob } from './components/Knob'
import { Keyboard } from './components/Keyboard'
import { Scope } from './components/Scope'
import { WaveformPicker } from './components/WaveformPicker'

export default function App() {
  const synth = useSynth()
  const [type, setType] = useState<OscillatorType>('sine')
  const [playing, setPlaying] = useState(false)

  const onWaveform = (t: OscillatorType) => {
    setType(t)
    synth.setWaveform(t)
  }
  const onNoteOn = (midi: number) => {
    setPlaying(true)
    synth.noteOn(midi)
  }
  const onNoteOff = () => {
    setPlaying(false)
    synth.noteOff()
  }

  return (
    <main>
      <h1>
        <span className="tag">0-sizer</span>
        &nbsp;Lesson 2
      </h1>
      <p className="lead">鍵盤で弾く（離散ドレミ）＋ ノブは TUNE に格上げ</p>

      <section className="card">
        <h2>① 前回のおさらい</h2>
        <p>
          レッスン1の連続ノブは「<b>音の高さ＝周波数</b>」を体で分かるための教材でした。でもメロディを弾くなら、区切られた
          <b>ドレミ（離散）</b>のほうがラク——その通りです。
        </p>
      </section>

      <section className="card">
        <h2>② 弾くのは鍵盤の仕事</h2>
        <p>
          鍵盤を押すと、その音の高さでオシレーターが鳴ります。これが「<b>弾く</b>」。押している間だけ音が出ます。
        </p>
        <Keyboard onNoteOn={onNoteOn} onNoteOff={onNoteOff} />
        <p className="small">鍵盤に書いてある英字キー（PC）でも弾けます。スマホは指で押す。</p>
      </section>

      <section className="card">
        <h2>③ 計器と音色</h2>
        <Scope type={type} playing={playing} />
        <WaveformPicker value={type} onChange={onWaveform} />
      </section>

      <section className="card">
        <h2>④ ノブの肩書き変更：TUNE</h2>
        <p>
          連続ノブは「音を選ぶ」係を鍵盤に譲り、<b>TUNE（チューニング）</b>になりました。弾いた音の全体を、連続で上下にズラします（移調・微調整）。
        </p>
        <p className="small">
          これが本物のシンセの役割分担：<b>ドレミ(離散)の鍵盤で弾く</b>／<b>連続のノブで調律・ベンド</b>。回しながら鍵盤を弾くと、全体の高さがズレるのが分かります。
        </p>

        <p style={{ marginTop: 12 }}>
          <b>なぜ音をズラすの？</b>
        </p>
        <p className="small">
          1. <b>移調</b>：歌い手や他の楽器の高さに全体を合わせる（カラオケのキー変更と同じ）。
          <br />
          2. <b>調律</b>：基準の高さ（A=440Hz）にきっちり合わせる。
          <br />
          3. <b>デチューン＝音を太く</b>：のちに2つ目のオシレーターを少しズラして重ねると、うねって太くなる。
          <br />
          4. <b>ベンド・表現</b>：演奏中にグイッと上げ下げして表情を付ける。
        </p>

        <div className="row">
          <Knob
            min={-12}
            max={12}
            defaultValue={0}
            label="TUNE（チューニング）"
            format={(v) => ({ main: `${v >= 0 ? '+' : ''}${v.toFixed(1)} 半音`, sub: '全体の高さ' })}
            onChange={(v) => synth.setTune(v)}
          />
        </div>
      </section>

      <p className="note">
        次のレッスン3は「エンベロープ」。いま鍵盤はパッと鳴ってパッと消えますが、押した瞬間の<b>立ち上がり</b>と離した後の<b>余韻</b>を作るツマミ（と計器）を足します。
      </p>
    </main>
  )
}
