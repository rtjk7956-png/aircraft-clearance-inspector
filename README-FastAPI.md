# AeroPipe FastAPI 실행 안내

기존 HTML 화면과 Python 계산 함수를 연결한 로컬 실행본입니다.
stitch_/home에 설치된 실행본입니다. 덮어쓴 원본은 _archive/backups/fastapi-install-*에 백업했습니다.

## 실행

1. 이 폴더의 `start.cmd` 또는 `웹_뷰어_시작.cmd`를 더블클릭합니다.
2. 첫 실행은 전용 `.venv`를 만들고 FastAPI/Uvicorn을 설치하므로 인터넷이 필요합니다.
3. 브라우저에서 http://127.0.0.1:8766/page2.html 을 엽니다.
4. 종료하려면 실행 창에서 Ctrl+C를 누릅니다.

기존 뷰어의 8765 포트와 구분하기 위해 8766을 사용합니다.
8766을 다른 프로그램이 사용하면 해당 서버를 종료한 뒤 실행하세요.
다른 PC에는 Python 3.10 이상이 필요합니다.
API 문서는 http://127.0.0.1:8766/docs 에 있습니다.
이 PC의 완성본에는 전용 가상환경 설치까지 완료되어 있습니다.

## CSV 수정과 재검사

- `data/specification_data.csv`: 적용 규격, 조건, 값, 단위, 출처
- `data/measurement_data.csv`: 부품명, 종류, 실측값, 조건, 기준 직경
- CSV를 UTF-8로 저장하고 page2의 **CSV 재검사**를 누르면 다시 읽습니다.
- 실행본은 이 폴더의 CSV를 사용합니다. 바탕 화면의 원본 CSV를 수정해도 자동 반영되지 않습니다.
- PASS 조건: 실측값 ≥ 최소 요구거리. 편차 = 실측값 − 최소 요구거리.
- 굽힘 규격에서는 `Clearance_mm` 열에 검사할 실제 굽힘 반경을 넣습니다.
- 규격 누락, 잘못된 숫자, 필요한 직경 누락은 **확인 필요**이며 합격으로 취급하지 않습니다.

## 구성

`backend/main.py`: FastAPI API와 HTML 제공

`backend/inspection.py`: 기존 `data/clearance_tool.py`의 계산 함수를 사용한 CSV 검사

`backend/specification_bridge.py`: 기존 부품 조합 규격 조회 연결

`inspection-results.js`: 검사 표, 편차 막대, 합계 표시

`data/workflow_agent.py`: 원본 보존본이며 규격 조회가 별칭 사전만 AST로 읽습니다. AI 코드를 실행하지 않습니다.

## API

- `GET /api/health`: 서버 상태
- `GET /api/specification?pair=...&condition=...&diameter=...`: 규격 조회
- `GET /api/inspections`: 현재 CSV 검사 결과
- `POST /api/inspections`: CSV 재검사

결과는 요청 시 계산합니다. 검사 이력 DB 저장 기능은 포함하지 않았습니다.

## STEP 미리보기와 범위

STEP 형상에서 거리를 직접 계산하지 않습니다. 검사값은 측정 CSV에서 읽습니다.
기존 STEP 미리보기는 유지했습니다. 브라우저 보관함은 주소별로 분리되므로
기존 8765 주소에서 저장한 STEP 파일은 8766의 index.html에서 다시 선택/저장해야 합니다.
3D 라이브러리와 스타일의 외부 CDN 사용은 기존 파일 그대로입니다.
page2 이외의 페이지는 원본 디자인/예시 화면이며 CSV 검사 결과와 연결되지 않았습니다.

## 수동 실행

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8766
```

구현 참고: [FastAPI 정적 파일 공식 문서](https://fastapi.tiangolo.com/tutorial/static-files/)

## 검증

API 테스트 5개 통과: 실제 CSV 결과, 단위/직경 배수 계산, 경계값,
잘못된 측정값/직경 누락, CSV 누락/열 오류/빈 파일, 내부 파일 비공개 확인.
브라우저에서 CSV 재검사와 한국어 부품 조합 규격 조회도 확인했습니다.

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest tests -q
```
