import { JarvisDialogue } from './JarvisDialogue';
import styles from './filmBriefing.module.css';

/** Shared text output only: opening a scene never triggers an AI request. */
export function FilmBriefing({ text, source }: { text: string; source: string }) {
  const reply = text.trim() || '브리핑 대기 중입니다. 왼쪽 터빈 메뉴에서 브리핑을 선택하면 현장 요약을 확인할 수 있습니다.';
  return <section className={styles.panel} aria-label="텍스트 브리핑">
    <header><span>TEXT / BRIEFING</span><span>텍스트 브리핑</span></header>
    <JarvisDialogue key={reply} text={reply} source={source || '브리핑 대기'} />
  </section>;
}
