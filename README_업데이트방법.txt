Forge Master KR v4 업데이트 방법

1. 이 ZIP을 PC에서 압축 해제합니다.
2. GitHub 저장소 taeju1201/forge-master-kr 에서 Add file → Upload files를 누릅니다.
3. 압축을 푼 폴더 안의 파일/폴더를 전부 올립니다. assets 폴더도 꼭 포함합니다.
4. Commit changes를 누릅니다.
5. 1~3분 뒤 https://taeju1201.github.io/forge-master-kr/ 를 엽니다.
6. 예전 화면이면 PC는 Ctrl+F5, 휴대폰/카톡은 창을 완전히 닫고 다시 열어주세요. v4 서비스워커는 이전 캐시를 삭제하도록 되어 있습니다.

v4 핵심 변경
- 요청한 불필요 전투 보정 항목 제외
- 대장간 Lv.1~35, 35=MAX
- 승천 메뉴 삭제: 대장간/스킬/펫/탈것 각각 화면 안에 통합
- 펫과 알 같은 화면
- 기술트리 1~5티어 전부 표시, 트리 연결/선행조건/-1/+1/+5/MAX
- 신성/지하세계 시대 이미지 교정
- 무기 이름 옆 개별 이미지 + 선딜/공격주기
- 탈것 이미지 contain/여백 처리
- 리그 언랭크~다이아몬드 III + 승급/유지/강등 + 전체 순위보상
- 클랜 E~S+++ + 승/패 티어포인트
- 던전 1-1~40-10 전체 표시
- 외부 실시간 JSON fetch 없음

참고 구조: Doraemon TechPlanner / 1vcian FM Helper. 코드는 v4용으로 새로 작성했습니다.
