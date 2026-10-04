# Aircraft Clearance Inspector

항공기 계통 간 최소 이격거리 검사 및 AI 보고서·메일 초안 작성 프로그램입니다.

STEP 모델에서 두 부품의 최소 이격거리를 측정하고, 규격 데이터와 비교해 PASS/FAIL을 판정합니다. FAIL 항목을 바탕으로 로컬 AI가 원인 분석, 위험도 평가, 시정 조치 계획, 보고서와 메일 초안을 작성합니다.

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

### 3페이지 — AI 분석 및 보고서
- FAIL 검사 항목 선택
- AI 추정 발생 원인 3개 작성
- 위험도 평가 및 판단 근거 작성
- 즉시·공정·품질 시정 조치 계획 작성
- 보고서 제목·본문 작성
- 검사 부품을 강조한 전체 배치 이미지 표시
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
- CSV 규격 데이터
- 브라우저 저장소: localStorage, sessionStorage, IndexedDB

## 실행 환경

- Windows
- Python 3.10 이상
- 최신 Chrome 또는 Edge 권장
- LM Studio 및 사용 가능한 AI 모델
- 최초 설치와 외부 3D 라이브러리 로딩을 위한 인터넷 연결

## 설치 및 실행

1. GitHub 저장소에서 `Code → Download ZIP`을 선택합니다.
2. 압축을 해제합니다.
3. Python을 설치합니다.
4. LM Studio에서 사용할 모델을 로드하고 로컬 서버를 시작합니다.
5. 프로젝트 폴더에서 PowerShell을 열고 아래 명령을 실행합니다.

```powershell
$env:LOCAL_API_BASE_URL = "http://127.0.0.1:1234/v1"
$env:LOCAL_MODEL = "qwen3-8b"
$env:QUALITY_MODEL = "qwen3-8b"

.\start.cmd
```

`qwen3-8b`는 LM Studio에 표시되는 실제 모델 ID로 변경합니다.
