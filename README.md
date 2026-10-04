# Aircraft Clearance Inspector

항공기 계통 간 최소 이격거리 검사 및 AI 보고서·메일 초안 작성 프로그램입니다.

STEP 모델에서 두 부품의 최소 이격거리를 계산하거나, CATIA VBA가 생성한 CSV에서 실측값을 가져와 규격 데이터와 비교합니다. FAIL 항목을 바탕으로 로컬 AI가 원인 분석, 위험도 평가, 시정 조치 계획, 보고서와 메일 초안을 작성합니다.

## 주요 기능

### 1페이지 — 파일 관리

- CATIA 및 STEP 파일 업로드·보관
- 저장된 파일 검색·다운로드·삭제
- STEP/STP 모델 3D 미리보기

### 2페이지 — 최소 이격거리 검사

- 원본 부품 ID를 기준으로 부품 선택
- 유압·연료·환경제어·전기제어 계통 분류
- 선택한 두 부품 표면의 최소 이격거리 계산
- 측정 결과를 1~6번 검사 행에 반영
- Python 규격 데이터로 기준치·편차·PASS/FAIL 표시
- 검사 행 자동 저장 및 전체 비우기
- 기존 STEP 측정과 CATIA VBA CSV 결과 전환
- 여러 CSV 파일의 측정 결과 통합
- Selected = TRUE인 부품 조합만 계통별 드롭다운에 표시
- 조합 선택 시 부품 A/B와 실측값 자동 입력
- 동일 부품 조합은 최신 CSV 결과 사용
- VBA 검사 보고서에 STP 전체 배치와 검사 부품 강조 이미지 자동 연결

### 3페이지 — AI 분석 및 보고서

- FAIL 검사 항목 선택
- AI 추정 발생 원인 3개 작성
- 위험도 평가 및 판단 근거 작성
- 즉시·공정·품질 시정 조치 계획 작성
- 보고서 제목·본문 작성
- 검사 부품을 강조한 전체 배치 이미지 표시
- VBA CSV 실측값의 소수점 세 자리 표시
- 보고서 자동 저장
- 검사 항목 변경 시 AI 보고서 초기화

### 4페이지 — 메일 초안

- 검사 결과를 바탕으로 계통별 담당자 선택
- 수신·참조·제목·본문 자동 작성
- 메일 직접 수정
- 임시 저장 및 복원
- 메일 삭제 및 삭제 취소

## 사용 기술

- HTML, CSS, JavaScript
- Python, FastAPI, Uvicorn
- Three.js, occt-import-js, three-mesh-bvh
- LM Studio 로컬 AI
- CSV 규격 데이터 및 CATIA VBA 측정 결과
- 브라우저 저장소: localStorage, sessionStorage, IndexedDB

## 실행 환경

- Windows
- Python 3.10 이상
- 최신 Chrome 또는 Edge 권장
- AI 기능 사용 시 LM Studio 및 사용 가능한 AI 모델
- 최초 설치와 외부 3D 라이브러리 로딩을 위한 인터넷 연결
- VBA 결과 사용 시 CATIA에서 생성한 CSV 파일
- 전체 배치 이미지 표시 시 해당 부품이 포함된 STEP/STP 파일

## 설치 및 실행

1. GitHub 저장소에서 `Code → Download ZIP`을 선택합니다.
2. 압축을 해제합니다.
3. Python을 설치합니다.
4. AI 기능을 사용할 경우 LM Studio에서 모델을 로드하고 로컬 서버를 시작합니다.
5. 프로젝트 폴더에서 PowerShell을 열고 아래 명령을 실행합니다.

```powershell
$env:LOCAL_API_BASE_URL = "http://127.0.0.1:1234/v1"
$env:LOCAL_MODEL = "qwen3-8b"
$env:QUALITY_MODEL = "qwen3-8b"
$env:AEROPIPE_VBA_CSV_DIR = "D:\CATIA\Macro\Output"

.\start.cmd
```

- `qwen3-8b`는 LM Studio에 표시되는 실제 모델 ID로 변경합니다.
- `D:\CATIA\Macro\Output`은 실제 CSV 저장 폴더로 변경합니다.
- LM Studio 인증을 사용하는 경우 `LM_STUDIO_API_KEY` 환경변수도 설정합니다.
- 최초 실행 시 전용 Python 가상환경과 필요한 패키지를 설치합니다.
- 프로그램을 사용하는 동안 서버 실행 창을 열어둡니다.

브라우저 접속 주소:

```text
http://127.0.0.1:8766/index.html
```

API 문서:

```text
http://127.0.0.1:8766/docs
```

HTML 파일을 직접 더블클릭하지 않고 서버 주소로 접속해야 전체 기능을 사용할 수 있습니다.

8766 포트가 이미 사용 중이면 기존 서버를 종료한 뒤 실행합니다. 서버 실행 창에서 `Ctrl+C`를 누르면 종료됩니다.

### 기존 STEP 측정 사용

1. 1페이지에서 STEP/STP 파일을 선택하거나 보관함에 저장합니다.
2. 2페이지에서 측정할 STEP/STP 파일을 엽니다.
3. 검사할 부품 A와 B를 선택합니다.
4. 최소 이격거리를 계산합니다.
5. 넣을 검사 행을 선택하고 "검사 행에 넣기"를 누릅니다.
6. 기준치·실측치·편차·판정을 확인합니다.

VBA 모드에서 기존 기능으로 돌아가려면 "STEP 측정 (기존)" 버튼을 누릅니다.

### VBA CSV 결과 사용

1. CATIA에서 VBA 매크로를 실행해 측정 CSV를 생성합니다.
2. CSV 저장 폴더를 `AEROPIPE_VBA_CSV_DIR`로 지정하고 프로그램을 실행합니다.
3. 2페이지에서 해당 부품이 포함된 STEP/STP 파일을 선택합니다.
4. "VBA CSV 결과" 버튼을 누릅니다.
5. 계통별 드롭다운에서 TRUE 부품 조합을 선택합니다.
6. 자동 입력된 부품 A/B와 실측값, 기준치, 편차, 판정을 확인합니다.
7. FAIL 항목이 있으면 "FAIL 보고서"로 이동합니다.
8. 보고서에서 VBA 실측값과 STP 전체 배치를 확인합니다.

실측값은 VBA CSV에서, 전체 배치 이미지는 STP 모델에서 가져옵니다. 검사 부품 A/B는 배치 이미지에서 파랑·주황으로 강조됩니다.

CSV를 새로 생성한 뒤 버튼을 다시 누르면 결과를 갱신합니다. 버튼은 이미 생성된 CSV를 읽으며, CATIA 매크로 실행은 CATIA에서 별도로 진행합니다.

CSV는 프로그램 소스와 별도로 준비해야 합니다. 다른 PC에서는 CSV 파일을 준비하고 해당 PC의 저장 폴더를 지정합니다.

### VBA CSV 형식

CSV에는 다음 열이 필요합니다.

```csv
GroupA,PartNumberA,GroupB,PartNumberB,MinimumDistance_mm,Selected
```

| 열 | 의미 |
|---|---|
| GroupA | 부품 A의 계통 그룹 |
| PartNumberA | 부품 A의 이름 |
| GroupB | 부품 B의 계통 그룹 |
| PartNumberB | 부품 B의 이름 |
| MinimumDistance_mm | 두 부품 사이 최소거리 실측값, 단위 mm |
| Selected | 검사 목록에 포함할 조합이면 TRUE |

- 검사 드롭다운에는 `Selected = TRUE`인 조합만 표시합니다.
- `Selected`는 선택 여부이며 PASS/FAIL 판정을 뜻하지 않습니다.
- 부품 A/B 순서가 바뀌어도 같은 조합으로 처리합니다.
- 동일 조합이 여러 CSV에 있으면 최신 측정 결과를 사용합니다.
- STP 배치 연결은 CSV 부품 이름과 STP 부품 이름을 기준으로 합니다.

## 주요 파일

| 경로 | 역할 |
|---|---|
| `index.html` | 파일 관리 페이지 |
| `page2.html` | 측정·검사 페이지 |
| `page3.html` | AI 보고서 페이지 |
| `page4.html` | 메일 초안 페이지 |
| `step-measurer.html` | STEP 측정 및 전체 배치 이미지 생성 |
| `inspection-results.js` | 검사 행, STEP/VBA 전환, TRUE 조합 드롭다운 |
| `report-clearance.js` | 보고서 검사값 및 전체 배치 표시 |
| `backend/main.py` | FastAPI 서버 및 API 연결 |
| `backend/vba_csv.py` | CATIA VBA CSV 통합 및 최신 결과 처리 |
| `backend/inspection.py` | 규격 검사 |
| `backend/specification_bridge.py` | 규격 조회 |
| `backend/ai_causes.py` | AI 원인 분석·보고서 작성 |
| `backend/mail_routing.py` | 담당자 선택·메일 작성 |
| `data/specification_data.csv` | 규격 데이터 |
| `data/system_contacts.json` | 계통별 담당자 설정 |
| `requirements.txt` | Python 패키지 목록 |
| `start.cmd` | 프로그램 실행 |

## 데이터 및 저장 방식

- 규격 데이터는 제공된 클리어런스 규격집을 바탕으로 구성했습니다.
- 규격 근거는 검사 결과 화면에 표시합니다.
- VBA 실측값은 지정된 로컬 CSV 폴더에서 읽습니다.
- 파일 보관함과 검사 행·보고서·메일 초안은 사용자 브라우저에 저장됩니다.
- 다른 브라우저나 다른 접속 주소로 자동 공유되지 않습니다.
- STEP 모드와 VBA CSV 모드의 검사 선택은 별도로 보관됩니다.
- 예시 담당자 이메일은 시연용 주소입니다.

## 검사 및 보고서 흐름

```text
STEP 측정 또는 CATIA VBA CSV 결과 선택
→ 검사 부품과 실측값 입력
→ Python 규격 데이터 조회
→ 기준치·편차·PASS/FAIL 확인
→ FAIL 항목 선택
→ AI 원인 분석·위험도 평가·시정 조치 계획
→ 보고서 작성
→ 메일 초안 작성·임시 저장
```

편차는 다음과 같이 계산합니다.

```text
편차 = 실측값 − 최소 요구거리
```

최소 요구거리 미달은 FAIL로 표시합니다. 규격이 없거나 필요한 정보가 부족하면 판정을 보류합니다.

## 실행 확인 항목

| 확인 항목 | 기대 결과 |
|---|---|
| STEP 부품 선택과 최소 이격 계산 | 측정 결과를 검사 행에 반영 |
| VBA CSV 결과 읽기 | TRUE 조합만 드롭다운에 표시 |
| TRUE 조합 선택 | 부품 A/B와 실측값 자동 입력 |
| STEP/VBA 모드 전환 | 각 모드의 저장된 선택과 값 유지 |
| VBA FAIL 보고서 이동 | CSV 실측값과 STP 전체 배치 표시 |
| AI 분석·보고서 작성 | 선택한 FAIL 항목에 맞는 분석과 보고서 생성 |
| 메일 임시 저장 후 페이지 이동 | 저장한 메일 초안 복원 |

## 구현 범위 및 제한

- STEP 최소 이격거리는 부품 표면 메시를 기준으로 계산한 근사값입니다.
- 메시 정밀도에 따라 STEP 측정 결과가 달라질 수 있습니다.
- VBA 모드에서는 CSV에 기록된 실측값을 사용합니다.
- CATIA 원본 파일의 직접 3D 측정은 지원하지 않습니다.
- STP 전체 배치 연결에는 해당 CSV 부품을 식별할 수 있는 모델이 필요합니다.
- AI 분석은 제공된 검사 데이터에 대한 추정이며 실제 발생 원인을 확정하지 않습니다.
- 실제 이메일 발송은 연결하지 않았으며 메일 초안 작성·저장·삭제까지 구현했습니다.
- 현재 AI 연결은 같은 PC의 로컬 LM Studio를 대상으로 합니다.
- GitHub Pages만으로는 FastAPI와 로컬 AI 기능을 실행할 수 없습니다.

## 정보 출처

- 클리어런스 규격 데이터: 제공된 클리어런스 규격집 및 CSV에 기록된 규격 출처
- 실측 데이터: CATIA VBA 매크로로 생성한 CSV
- 전체 배치 이미지: 사용자가 선택한 STEP/STP 모델
- FastAPI: https://fastapi.tiangolo.com/
- Three.js: https://threejs.org/
- LM Studio: https://lmstudio.ai/
