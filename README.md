# 🧩 코딩테스트 스터디 보드

주마다 알고리즘 주제를 자동으로 정합니다. 그 주제에 맞는 문제 **2개는 각자 링크로 직접 고르고**,
**랜덤 1개는 자동으로 배정**됩니다. 문제는 멤버마다 다릅니다.
스터디원은 **풀이를 Markdown으로 커밋**하고, 보드는 **GitHub Pages 정적 사이트**로 배포됩니다.

서버도 데이터베이스도 로그인도 없습니다. **GitHub 계정이 곧 인증**이고,
누가 무엇을 풀었는지는 커밋 히스토리에 그대로 남습니다.

## 보드

칸반은 **멤버별로 한 줄(레인)** 입니다. 각 레인 안에 `풀 문제 / 푸는 중 / 푼 문제` 세 칸이 있어서
누가 어디까지 갔는지 나란히 비교됩니다. 레인 오른쪽에는 진행률 막대가 붙습니다.

- **주차** 필터 — 이번 주 / 특정 주차 / 전체
- **난이도** 필터 — 쉬움(Easy·Lv.1) / 보통(Medium·Lv.2~3) / 어려움(Hard·Lv.4+)
- **멤버** 필터 — 한 사람만 남겨서 보기

카드를 누르면 그 문제의 **스터디원 풀이 페이지**로 갑니다. 각자의 설명과 코드가 모여 있고,
스포일러를 피하도록 기본은 접혀 있습니다. 멤버 이름을 누르면 그 사람의 전체 풀이 목록이 열립니다.

## 구조

```
weeks/2026-W37.yaml                    주차 주제 · 추천 문제 · 멤버별 할당 (워크플로가 관리)
members/<github-id>.md                 스터디원 프로필
picks/2026-W37/<github-id>.yaml        직접 고른 문제 링크 2개
solutions/2026-W37/<github-id>/<문제-id>.md   풀이 (설명 + 코드)
data/problems.json                     수집된 문제 풀 (collect 워크플로가 갱신)
data/programmers-seed.json             프로그래머스 큐레이션 목록
tools/                                 수집 · 주차 생성 · 검증 · 사이트 빌드
templates/                             사이트 CSS와 클라이언트 스크립트
examples/                              풀이 · 프로필 작성 예시
```

## 스터디 참여하기

### 1. 멤버 등록

`members/<github-id>.md` 를 추가하는 Pull Request를 엽니다. 파일명은 **소문자 GitHub ID**입니다.

```md
# 표시할 이름

자기소개, 관심 분야, 사용하는 언어를 자유롭게 작성합니다.
```

멤버 파일이 main에 들어가면 `assign` 워크플로가 **랜덤 문제 1개를 자동으로 배정**합니다.

### 2. 이번 주 문제 2개 고르기

주제에 맞는 문제 2개는 각자 고릅니다. 보드의 **이번 주 추천 문제**에서 골라도 되고,
다른 문제를 가져와도 됩니다. `picks/<주차>/<github-id>.yaml` 에 **링크만** 넣으면 됩니다.

```yaml
# picks/2026-W37/jiwon.yaml
- https://leetcode.com/problems/two-sum/
- https://school.programmers.co.kr/learn/courses/30/lessons/42576
```

머지되면 `assign` 워크플로가 링크를 파싱해서 **제목·난이도를 자동으로 채워** 주차 파일에 등록합니다.
LeetCode와 프로그래머스 링크를 지원하고, 쿼리 문자열(`?envType=...`)이 붙어 있어도 됩니다.

이런 링크는 PR 단계에서 걸립니다.

- 지원하지 않는 사이트 (백준 등)
- 문제 페이지가 아닌 링크 (콘테스트, 목록)
- 존재하지 않는 문제, LeetCode 유료(Premium) 문제
- 이전 주차에 이미 받은 문제, 같은 문제를 두 번 적은 경우

이번 주 주제와 상관없는 문제를 골라도 등록은 되지만, 워크플로 로그에 알림이 남습니다.

### 3. 풀이 올리기

푼 문제마다 파일을 하나 추가합니다. **자기에게 할당된 문제만** 올릴 수 있습니다.

```
solutions/<주차>/<github-id>/<문제-id>.md
예: solutions/2026-W37/jiwon/programmers-1845.md
```

~~~md
---
status: done          # todo | doing | done
language: python      # 선택
# url: https://...    # 선택, 블로그 등 풀이 원문
---

## 접근

어떤 자료구조와 알고리즘을 왜 골랐는지 적습니다.

## 풀이

```python
def solution(nums):
    return min(len(set(nums)), len(nums) // 2)
```

시간 O(n), 공간 O(n).

## 막혔던 부분

헤맨 지점, 놓친 반례, 리뷰에서 배운 점. 없으면 생략합니다.
~~~

전체 형식은 [examples/solution.md](examples/solution.md) 를 참고하세요.
아직 푸는 중이라면 `status: doing` 으로 접근만 적어 올려도 됩니다.
`status: done` 은 풀이 코드 블록이 있어야 통과합니다.

Pull Request를 열면 `check` 워크플로가 형식을 검사하고, main에 머지되면 사이트가 자동으로 다시 배포됩니다.

### 4. 로컬에서 확인

```bash
npm ci
npm run serve      # 빌드 후 http://localhost:3000
```

```bash
npm test           # 검증 로직 테스트
npm run validate   # 내가 쓴 파일 형식 검사
```

## 자동화

| 워크플로 | 시점 | 하는 일 |
| --- | --- | --- |
| `weekly` | 매주 월요일 00:10 KST | 이번 주차 주제와 추천 문제를 정하고, 멤버별 랜덤 문제를 배정 |
| `assign` | `members/` · `picks/` 변경 시 | 고른 링크를 문제로 등록하고, 신규 멤버에게 랜덤 문제 배정 |
| `collect` | 매월 1일 | LeetCode / 프로그래머스에서 문제 풀을 다시 수집 |
| `check` | PR · push | 테스트 + 형식 검사 + 빌드 |
| `deploy` | main push · weekly 완료 후 | 사이트를 빌드해 GitHub Pages에 배포 |

`weekly` 와 `collect` 는 Actions 탭에서 **Run workflow** 로 직접 돌릴 수도 있습니다.
`weekly` 는 주차(`2026-W40`)와 알고리즘(`greedy`)을 입력받아 미리 만들어둘 수도 있습니다.

### 주제 순환과 문제 선정

주제는 [tools/topics.mjs](tools/topics.mjs) 의 커리큘럼 20개를 순환합니다.
해시 → 스택/큐 → 정렬 → 투 포인터 → … → 연결 리스트.

문제 3개의 출처는 이렇습니다.

1. **직접 고른 문제 2개** — `picks/` 에 링크를 넣어 등록합니다.
2. **랜덤 1개** — 주제와 무관하게 자동 배정됩니다.

**추천 문제**는 주차 파일의 `suggestions` 에 6개 들어갑니다.
두 사이트를 섞어 쉬운 것부터 어려운 것까지 고르고, 빈출 문제를 우선합니다.
같은 문제가 두 사이트에 겹치면(`N-Queen` / `N-Queens II`) 걸러냅니다.

랜덤 문제는 **그 사람이 이전에 받은 적 없는 문제** 중에서 뽑고, 같은 주에 다른 멤버가
이미 받은 문제는 되도록 피합니다. 같은 (주차, 멤버) 조합은 언제 돌려도 같은 결과입니다(시드 난수).

난이도는 출처가 달라도 3단계로 정규화됩니다 — Easy·Lv.1 / Medium·Lv.2~3 / Hard·Lv.4+.
카드에는 원래 표기(`Medium`, `Lv.2`)가 그대로 보입니다.

## 문제 수집

- **LeetCode** — 공개 GraphQL API. 유료 문제와 커리큘럼에 없는 주제는 제외. 약 600문제.
  Top Interview 150, LeetCode 75 등 스터디 플랜에 속한 문제는 대표 문제로 표시되고,
  주차 문제는 **대표 문제 중에서 우선 선정**됩니다.
  직접 고른 LeetCode 링크는 이 풀에 없어도 GraphQL로 바로 조회해 등록합니다.
- **프로그래머스** — 문제 목록 API가 로그인 없이 열려 있지 않아
  [data/programmers-seed.json](data/programmers-seed.json) 의 큐레이션 목록(고득점 Kit 중심 68문제)을 쓰고
  제목만 실제 문제 페이지에서 확인합니다.
  문제를 추가하려면 `{ "id": 레슨번호, "topic": "주제slug", "level": 1~5 }` 를 넣고 `npm run collect` 를 돌립니다.
  직접 고른 링크는 문제 페이지에서 제목과 난이도를 바로 읽어오므로 풀에 없어도 등록됩니다.

## 배포 설정

처음 한 번만 하면 됩니다. **Organization은 필요 없고 개인 레포로 충분합니다.**

1. 레포를 **public** 으로 만듭니다.
   (private 레포에 Pages를 붙이려면 유료 플랜이 필요합니다. 스터디 풀이를 공개하기 싫다면
   private 레포 + 유료 플랜, 또는 아래 "다른 배포처" 를 보세요.)
2. **Settings → Pages → Source** 를 `GitHub Actions` 로 바꿉니다.
3. **Settings → Actions → General → Workflow permissions** 를
   `Read and write permissions` 로 바꿉니다. `weekly` 와 `collect` 가 커밋을 푸시해야 합니다.
4. main에 push하면 `deploy` 가 돌고, 몇 분 뒤 `https://<github-id>.github.io/<레포>/` 에서 열립니다.

### 다른 배포처

`npm run build` 결과인 `dist/` 는 그냥 정적 파일이라 어디에나 올릴 수 있습니다.
Vercel · Netlify · Cloudflare Pages 모두 빌드 명령 `npm run build`, 출력 디렉터리 `dist` 로 두면 됩니다.
Pages가 아닌 곳에 올릴 때는 `BASE_PATH` 를 비워두세요(도메인 루트에 배포되므로).
