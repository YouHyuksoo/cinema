# 중앙 음성 코어 교체

## 최종 사용자 교정: 회전 아크 리액터

- 아래 초기 구형 코어 기록은 이전 시안이다. 최종 구현은 유리 없는 금속 아크 리액터이며 육각 케이스 코드는 제거했다.
- 8개 넓은 코일·3개 지지대·두꺼운 금속 링이 기울어진 축으로 함께 회전한다. 상태 문구는 효과 아래 독립 행에 배치한다.
- 실제 음량에 따라 플라즈마 밝기·크기와 최대 5갈래 테슬라 스파크가 반응한다. 스파크는 코어와 바깥 코일에 붙어 같이 회전한다. 무음/비음성 상태/동작 줄이기에서는 발생하지 않는다.
- 최종 경로: jarvisVoiceCore.ts → voiceReactorGeometry.ts → components/drawVoiceReactor.ts → drawJarvisVoiceField.ts → JarvisWave.tsx. 배치: JarvisMain.tsx / JarvisCenterLayout.tsx / jarvisCenterLayout.module.css.
- 최종 타입 검사, 변경 TS/TSX 대상 ESLint, 전체 단위 테스트(83 파일 / 717 테스트) 통과. 회전 중 치수 보존·투영 경계·방전 부착 위치·무음 억제·동작 줄이기를 포함한다.
- 최종 npm run build 통과. 실행 중인 3010 메인 화면에서 데스크톱과 모바일 배치·유리 제거·코어 표시를 확인했다. 파일을 순차 교체하던 중 HMR에 일시적인 제거된 export 오류가 기록됐으나 최종 소스는 타입 검사·빌드를 통과했다. 실제 마이크/AI 음성 세션은 시작하지 않았으며 종단 오디오 반응은 미검증이다.

- 요청: 승인된 VOICE CORE 컨셉을 메인 메뉴 중앙 파동에 적용.
- 구현: 투명 구형 격자, 앞뒤 깊이가 다른 교차 궤도·반투명 리본, 빛 중심, 입자. 이미지 파일을 붙이는 대신 Canvas에서 3D 좌표를 투영해 애니메이션한다.
- 연결: 기존 JarvisAudioFrame의 phase / AnalyserNode 사용. 듣기와 말하기 RMS에 팽창·진폭이 반응하며 답변 준비는 응축·보라색으로 표시한다.
- 범위: JarvisWave.tsx, jarvisVoiceCore.ts, drawJarvisVoiceField.ts, jarvis.module.css, DESIGN.md. 중앙 상태 제목과 START·카메라·입력 동작은 유지.
- 접근성: prefers-reduced-motion에서 시간·음량 변형 정지. 페이지 숨김과 언마운트 시 RAF 해제. 추가 장치 접근이나 API 호출 없음.

## 검증

- npm run typecheck: 통과.
- npm run test:unit: 83 파일 / 717 테스트 통과. 새 코어 21개 사례는 듣기·말하기 입력 반응, 비음성 상태의 이전 샘플 무시, 동작 줄이기, 프레임률 독립 감쇠, 깊이 투영·경계·파형 이음새·컨텍스트 복원을 검증.
- 변경한 TS/TSX와 새 테스트 대상 ESLint: 통과.
- npm run build: 최종 통과. 샌드박스에서 발생한 spawn EPERM은 승인된 동일 명령 재실행으로 확인.
- 실행 중인 http://localhost:3010/에서 새 Canvas 접근성 이름과 실제 렌더를 확인. 데스크톱과 모바일 크기에서 구체·리본·상태 제목을 육안 확인.
- 모바일 viewport 390×844 요청, 브라우저 줌 반영 CSS viewport 약 354.5×767.3. 중앙 영역 높이 480px, Canvas 약 341.5×224.9px. 입력창은 중앙 영역 안에 유지. 검증 후 viewport override 해제.

## 남은 실사용 확인

- 실제 마이크와 OpenAI 음성 세션은 시작하지 않았다. 실제 발화·AI 출력까지의 종단 동작 및 실기기 성능은 미검증이며, 위 샘플 기반 테스트와 구분한다.
