# 쿠팡 공사 현황판

티에스코어 쿠팡 공사 일정·이슈·사진 공유 사이트.
화면은 GitHub Pages, 데이터·사진은 Supabase(무료)에 저장해요.

- 보기: 주소만 있으면 누구나
- 수정: 누구나 바로 (비밀번호 없음)
- Claude 변경 붙여넣기: 홈 위쪽 버튼
- 엑셀로 받기: 현장 목록 화면 오른쪽 위 (A4 가로 인쇄용)

## 파일

| 파일 | 하는 일 | GitHub에 올리기 |
|---|---|---|
| index.html | 화면 모양 | O |
| app.js | 화면 동작 | O |
| store.js | 데이터 저장·불러오기 | O |
| config.js | Supabase 주소·공개키 | O (주소 넣은 뒤) |
| supabase/setup.sql | DB 처음 설정 | X (Supabase에만 붙여넣기) |
| supabase/seed.sql | 기존 엑셀 데이터 | **X (절대 올리지 않기)** |
| seed.js | 시안 모드용 데이터 | **X (절대 올리지 않기)** |

## 설치 순서

### 1. Supabase 만들기 (5분)
1. https://supabase.com 접속 → Start your project → GitHub 계정으로 로그인
2. New project
   - Name: `tscore-coupang`
   - Database Password: Generate → 메모장에 따로 저장 (사이트 비밀번호와 다름)
   - Region: Northeast Asia (Seoul)
3. 만들어질 때까지 1~2분 기다리기

### 2. DB 설정 (2분)
1. 왼쪽 메뉴 **SQL Editor** → New query
2. `supabase/setup.sql` 내용 전체 붙여넣기 → **Run**
3. New query → `supabase/seed.sql` 내용 전체 붙여넣기 → **Run** (기존 엑셀 27개 현장이 들어가요)

### 3. 연결 정보 넣기 (1분)
1. 왼쪽 아래 **Project Settings** → **API Keys** (또는 Data API)
2. Project URL, 그리고 `anon public` 키(또는 `publishable` 키) 복사
3. `config.js` 열어서 따옴표 안에 붙여넣고 저장
   - `service_role` / `secret` 키는 **절대 넣지 마세요** (전체 권한 키예요)

### 4. GitHub Pages 올리기 (3분)
1. https://github.com → 오른쪽 위 + → New repository
   - 이름: `coupang-board`, Public 선택 → Create
2. "uploading an existing file" 클릭 → `index.html`, `app.js`, `store.js`, `config.js` 4개만 끌어다 놓기 → Commit
3. 저장소 **Settings → Pages** → Branch: `main`, 폴더 `/ (root)` → Save
4. 1~2분 뒤 위쪽에 주소가 떠요: `https://아이디.github.io/coupang-board/`

### 5. 휴대폰에 앱처럼 깔기
- 아이폰: 사파리로 주소 열기 → 공유 버튼 → 홈 화면에 추가
- 안드로이드: 크롬으로 주소 열기 → ⋮ → 홈 화면에 추가

## 관리

- **비밀번호 바꾸기**: SQL Editor에서
  `update public.app_config set v = extensions.crypt('새비밀번호', extensions.gen_salt('bf')) where k = 'passcode';`
- **백업**: 주 1회 "엑셀로 받기" → 회사 NAS에 저장
- **일시정지 주의**: Supabase 무료 플랜은 일주일 동안 아무도 안 쓰면 멈춰요. 멈추면 Supabase 대시보드에서 Restore 누르면 돌아와요.
- **화면 고치기**: GitHub 저장소에서 파일 다시 올리면 1~2분 뒤 반영돼요.

## 날짜 적는 법
- 단계 칸·기본정보에 `11/23`, `11/23 16시`처럼 적으면 홈 화면 "이번 주 쳐낼 일"과 달력에 자동으로 떠요.
- `○` 완료, `진행중`, `대기`, `N/A` 해당 없음, `Ⅹ` 실주
- 기록 내용에 `11/24 미팅 예정`처럼 미래 날짜를 쓰면 그것도 일정에 떠요.
