import styles from './jarvisStream.module.css';

/** Guidance stays separate from measured data and analysis cards. */
export function JarvisHelp() {
  return <>
    <section className={styles.block}>
      <h2>GUIDE / 화면 안내</h2>
      <p>왼쪽에서 연결 상태와 음성 설정을 확인하고, 오른쪽에서 생산·공정·품질·에너지 분석을 살펴보세요.</p>
      <p>분석 카드의 버튼을 누르면 해당 상세 연출로 이동합니다. 하단의 메인 메뉴 버튼으로 돌아올 수 있습니다.</p>
    </section>
    <section className={styles.block}>
      <h2>HELP / 조작 도움말</h2>
      <p>흐르는 카드에 마우스를 올리거나 키보드 초점을 두면 이동이 잠시 멈춥니다. 직접 스크롤하거나 상단 정지 버튼으로 멈춰 두세요.</p>
      <p>START로 대화를 시작하고 STOP으로 종료합니다. 글로만 질문하려면 중앙 입력창을 사용하세요.</p>
      <p>중앙 배경은 기존 스타일과 네온 HUD 중 선택할 수 있습니다. 카메라 영상은 중앙의 연결 버튼으로 켜고 끕니다.</p>
    </section>
  </>;
}
