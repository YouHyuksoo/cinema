import type { CSSProperties } from 'react';
import { CONNECTION_LABELS, type ScannerConnection } from './scannerConnectionStatus';
import styles from './scannerStatusOrbs.module.css';

/** Four camera-facing spheres travel around a tilted, genuinely depth-sorted orbital plane. */
export function ScannerStatusOrbs({ connections, still }: { connections:ScannerConnection[]; still:boolean }) {
  return <div className={styles.plane} data-status-orbits="true" data-still={still}>
    {connections.map((item,index)=><div key={item.id} className={styles.orbit} style={{ '--phase':`${-2-index*4}s` } as CSSProperties}>
      <div className={styles.carrier}>
        <div className={styles.satellite} data-status-orb={item.id} data-connection={item.id} data-state={item.state}
          title={`${item.label} ${CONNECTION_LABELS[item.state]} · ${item.detail}`}>
          <div className={styles.sphere}><i className={styles.equator}/><i className={styles.light}/></div>
          <span className={styles.caption}>{item.label}<small>{CONNECTION_LABELS[item.state]}</small></span>
        </div>
      </div>
    </div>)}
  </div>;
}
