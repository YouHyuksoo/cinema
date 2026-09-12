import type { CSSProperties } from 'react';
import styles from './jarvisConversationTrail.module.css';
import { pad2 } from './filmMath';

interface TrailMessage { id?: string; role: 'user' | 'assistant'; content: string }

/** Readable earlier messages; the latest reply remains in the dialogue. */
export function JarvisConversationTrail({ messages }: { messages: readonly TrailMessage[] }) {
  const history = messages.slice(0, -1).filter(message => message.content.trim()).slice(-12);
  if (!history.length) return null;
  const duration = Math.max(36, history.length * 9);
  return <div className={styles.field} role="region" aria-label="이전 대화 메시지" tabIndex={0} data-conversation-trail>
    <div className={styles.depth}>
      <div className={styles.viewport}>
        <div className={styles.track} style={{ '--trail-duration': `${duration}s` } as CSSProperties}>
          {[0, 1].map(copy => <div className={styles.sequence} key={copy} aria-hidden={copy === 1 ? true : undefined}>
            {history.map((message, index) => <div className={styles.entry} data-role={message.role} key={message.id ?? index}>
              <span className={styles.marker}>{pad2(index + 1)}</span>
              <div><small>{message.role === 'user' ? 'OPERATOR / INPUT' : 'HATCHERY / RESPONSE'}</small>
                <p>{message.content}</p></div>
            </div>)}
          </div>)}
        </div>
      </div>
    </div>
  </div>;
}
