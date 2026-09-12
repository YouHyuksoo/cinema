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
      <p>터빈의 AI 대화는 모델과 음성으로 대화합니다. 입력창 마이크는 받아쓰기만 하며, 보내기를 눌러야 명령을 실행합니다.</p>
      <p>“구체형 메뉴 열어줘”, “색상 테마 블루로 바꿔줘”, “재생 속도 1.5로 바꿔줘”처럼 말하거나 입력하세요. “현재 설정 알려줘”로 화면 설정을 확인할 수 있습니다.</p>
      <p>중앙 배경은 연출설정에서 7종의 HUD 템플릿 중 선택할 수 있습니다. 영상 연결 버튼으로 팝업을 열어 카메라를 켜고 끕니다. 팝업을 닫으면 연결도 종료됩니다.</p>
    </section>
  </>;
}
