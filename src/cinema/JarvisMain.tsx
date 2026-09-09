'use client';

import { useState } from 'react';
import { useJarvisVoice } from './useJarvisVoice';
import { JarvisWave } from './JarvisWave';
import { JarvisConversationTrail } from './JarvisConversationTrail';
import { JarvisIgnition } from './JarvisIgnition';
import { JarvisMainHeader } from './JarvisMainHeader';
import { JarvisCenterLayout } from './JarvisCenterLayout';
import { JarvisAiStatus } from './JarvisAiStatus';
import { JarvisTemperatureAlerts } from './JarvisTemperatureAlerts';
import { JarvisStream } from './JarvisStream';
import { JarvisHelp } from './JarvisHelp';
import { JarvisOperations, JarvisQualityEnergy } from './JarvisOperations';
import { JarvisChannelDials } from './JarvisChannelDials';
import { JarvisVoiceSettings } from './JarvisVoiceSettings';
import { JarvisAiVoiceSettings } from './JarvisAiVoiceSettings';
import { JarvisVoiceModeToggle } from './JarvisVoiceModeToggle';
import { JarvisDialogue } from './JarvisDialogue';
import { jarvisOverview } from './jarvisCommands';
import { JARVIS_PHASE_LABELS } from './jarvisAudio';
import type { FilmCamera } from './useFilmCamera';
import type { FilmId } from './filmProgram';
import type { MachineSubject } from './machinePresentation';
import type { HatcheryActions } from './hatcheryTargets';
import styles from './jarvis.module.css';
import streamStyles from './jarvisStream.module.css';

const overview = jarvisOverview();
export function JarvisMain({ camera, onChapter, actions }: { camera: FilmCamera; onChapter: (id: FilmId, subject?: MachineSubject) => void; actions?: HatcheryActions }) {
  const voice = useJarvisVoice(onChapter, actions);
  const [input, setInput] = useState('');
  const busy = voice.phase === 'thinking' || voice.phase === 'speaking';
  const answer = voice.messages.filter(m => m.role === 'assistant').at(-1);
  const reply = answer?.content || '준비됐습니다. 생산 흐름·품질·에너지와 주요 알림을 함께 살피고, 원하는 연출을 불러드릴게요.';
  return <section className={styles.main} aria-label="HATCHERY 메인 메뉴">
    <JarvisMainHeader />
    <div className={styles.body}>
    <JarvisStream title="HELP / SETTINGS" label="좌측 설명 및 설정" speed={15}>
    <section className={styles.left}>
      <div className={styles.sectionTitle}>SESSION / CONNECTIONS</div>
      <dl className={styles.connections}><dt>음성 입력</dt><dd>{voice.active ? '연결 중' : '꺼짐'}</dd>
        <dt>음성 인식</dt><dd>{voice.realtime ? 'OpenAI Realtime' : voice.supported === null ? '확인 중' : voice.supported ? '브라우저' : '미지원'}</dd>
        <dt>현장 명령</dt><dd>사용 가능</dd><dt>자유 대화 AI</dt><dd>{voice.configured === null ? '확인 중' : voice.configured ? `${voice.providerLabel ?? 'AI'} 설정됨` : '미연결'}</dd><dt>현장 데이터</dt><dd>시연 모드</dd></dl>
    </section>
    <section className={styles.left}>
      <div className={styles.sectionTitle}>VOICE / 대화 설정</div>
      {voice.configured && <JarvisVoiceModeToggle mode={voice.voiceMode} realtimeAvailable={voice.realtimeAvailable} busy={voice.active || voice.switching}
        onChange={mode => void voice.setVoiceMode(mode)} />}
      {voice.realtime ? <JarvisAiVoiceSettings voice={voice.realtimeVoice} active={voice.active} effect={voice.robotVoice}
        onVoice={voice.setRealtimeVoice} onEffect={voice.setRobotVoice} /> : <JarvisVoiceSettings profile={voice.speechProfile} />}
      <p className={styles.notice}>{voice.realtime ? '대화 시작을 누르면 AI 음성으로 듣고 답합니다. 답변 중에도 말을 걸어 끼어들 수 있습니다. 입력창만 사용하면 글로 답합니다.' : voice.configured ? '대화 시작을 누르면 브라우저 음성으로 듣고, 텍스트 모델의 답을 브라우저 목소리로 읽어 줍니다.' : '대화 시작을 누르고 HATCHERY에게 말을 걸어보세요.'}</p>
      <p className={styles.notice}>최근 질문: {voice.transcript || '아직 입력한 질문이 없습니다.'}</p>
      {(voice.error || voice.statusError || camera.error) && <p className={styles.error} role="alert">{voice.error || voice.statusError || camera.error}</p>}
      <div className={styles.quick}>{['현장 요약', '살아 있는 공정망 보여줘', '에너지 보여줘', 'SPC 분석 보여줘'].map(q =>
        <button key={q} disabled={busy} onClick={() => void voice.ask(q)}>{q}</button>)}</div>
      <p className={styles.notice}>{voice.realtime ? 'AI 생성 음성입니다. 대화 중 마이크 음성·질문·시연 정보가 OpenAI로 전송되며 사용량에 따라 과금됩니다. 세션은 최대 10분이며 종료·화면 이탈 시 연결을 닫습니다. 카메라는 화면에만 표시합니다.' : voice.configured ? `카메라는 화면에만 표시합니다. 음성 인식·합성은 브라우저 서비스를 이용하고, 질문 텍스트와 시연 정보만 ${voice.providerLabel ?? 'AI'}로 전송됩니다.` : '카메라는 화면에만 표시합니다. 음성 인식은 브라우저 서비스를 이용합니다. 자유 대화 AI는 미연결 상태입니다.'}</p>
    </section>
    <JarvisHelp />
    </JarvisStream>
    <JarvisCenterLayout camera={camera} aiStatus={<JarvisAiStatus connection={voice.aiConnection} />} ignition={
      <JarvisIgnition compact active={voice.active} phase={voice.phase} disabled={voice.configured === null}
        onInterrupt={voice.stopReply} onToggle={() => {
          if (voice.active) { voice.stop(); camera.stop(); }
          else { void voice.start(); void camera.start(); }
        }} />
    } heading={
      <div className={styles.voiceHeading}><h1>{JARVIS_PHASE_LABELS[voice.phase]}</h1><span data-active={voice.active}>{voice.active ? '● SESSION ON' : '○ STANDBY'}{voice.configured ? ` · ${voice.realtime ? 'REALTIME' : 'BROWSER VOICE'}` : ''}</span></div>
    } visual={
      <div className={styles.wave}>
        <JarvisConversationTrail messages={voice.messages} />
        <JarvisWave audio={voice.audioRef} />
      </div>
    } form={
      <form className={styles.input} onSubmit={event => { event.preventDefault(); void voice.ask(input); setInput(''); }}>
        <label className={styles.srOnly} htmlFor="jarvis-message">HATCHERY에게 질문</label>
        <input id="jarvis-message" placeholder="HATCHERY에게 질문 또는 명령 입력" maxLength={1200} value={input} onChange={e => setInput(e.target.value)} />
        <button type="submit" disabled={busy || !input.trim()}>보내기 ↗</button>
      </form>
    }>
      <JarvisDialogue key={reply} text={reply} source={voice.source} />
    </JarvisCenterLayout>
    <JarvisStream title="DATA / ANALYSIS" label="우측 분석 정보" speed={19} side="right">
      <section className={streamStyles.block}><h2>CHANNELS / 현장 게이지</h2><JarvisChannelDials /></section>
      <JarvisOperations onChapter={onChapter} />
      <JarvisQualityEnergy onChapter={onChapter} />
      <JarvisTemperatureAlerts zones={overview.zones} onDetails={() => onChapter('wave')} />
    </JarvisStream>
    </div>
  </section>;
}
