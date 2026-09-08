import { useState } from 'react';
import styles from './jarvis.module.css';

/** Page long replies instead of growing or scrolling the voice stage. Remount for each new reply. */
export function JarvisDialogue({ text, source }: { text: string; source: string }) {
  const [page, setPage] = useState(0);
  const characters = Array.from(text.replace(/\s+/g, ' ').trim());
  const pages = Math.max(1, Math.ceil(characters.length / 72));
  return <div className={styles.dialogue}>
    <div className={styles.replyHeading}><small>HATCHERY <span>{source}</span></small>
      {pages > 1 && <nav aria-label="응답 페이지">
        <button type="button" aria-label="이전 응답 페이지" disabled={page === 0} onClick={() => setPage(n => n - 1)}>‹</button>
        <span>{page + 1} / {pages}</span>
        <button type="button" aria-label="다음 응답 페이지" disabled={page === pages - 1} onClick={() => setPage(n => n + 1)}>›</button>
      </nav>}
    </div>
    <p aria-live="polite">{characters.slice(page * 72, (page + 1) * 72).join('')}</p>
  </div>;
}
