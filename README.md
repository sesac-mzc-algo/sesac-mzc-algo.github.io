# 🧩 코딩테스트 스터디

**https://sesac-mzc-algo.github.io/**

매주 알고리즘 주제가 하나 정해집니다. 그 주제에 맞는 문제 **2개는 각자 직접 고르고**,
**랜덤 1개는 자동으로 배정**됩니다. 문제는 사람마다 다릅니다.
푼 풀이는 Markdown으로 올리고, 보드에서 서로 비교해 봅니다.

## 보드 보는 법

칸반은 **멤버별로 한 줄(레인)** 입니다. 레인 안에 `풀 문제 / 푸는 중 / 푼 문제` 세 칸이 있고,
오른쪽에 진행률이 붙습니다. 위쪽 필터로 주차 · 난이도 · 멤버를 좁혀 볼 수 있습니다.

카드를 누르면 그 문제의 **풀이 페이지**가 열립니다. 그 문제를 받은 사람들의 설명과 코드가
모여 있고, 스포일러를 피하도록 기본은 접혀 있습니다. 이름을 누르면 그 사람의 풀이 목록이 열립니다.

## 처음 한 번만

### 포크하고 클론하기

모든 변경은 **fork → 브랜치 → Pull Request** 로 올립니다. main에 직접 push하지 않습니다.

레포 오른쪽 위 **Fork** 를 누른 뒤 클론합니다.

```bash
git clone https://github.com/<내-github-id>/sesac-mzc-algo.github.io.git
cd sesac-mzc-algo.github.io
git remote add upstream https://github.com/sesac-mzc-algo/sesac-mzc-algo.github.io.git
npm ci
```

### 멤버 등록

`members/<github-id>.md` 를 만듭니다. 파일명은 **소문자 GitHub ID** 입니다.
프로필 이미지는 GitHub 계정에서 자동으로 가져옵니다.

```md
---
levels:
  programmers: [1, 2, 3, 4, 5]
  leetcode: [Easy, Medium, Hard]
---

# 표시할 이름

자기소개, 관심 분야, 사용하는 언어를 자유롭게 작성합니다.
```

`levels` 는 **추천받고 싶은 난이도** 입니다. 프로그래머스는 `1`~`5`, LeetCode는
`Easy` / `Medium` / `Hard` 중에서 고릅니다. 추천 문제 목록과 자동 배정되는 랜덤 문제가
이 범위에 맞춰집니다. 생략하면 전체 난이도를 받습니다.

너무 쉽거나 어렵다 싶으면 이 파일만 고쳐 PR을 열면 됩니다.
이미 배정된 문제는 그대로 두고 다음 주차부터 반영됩니다.

멤버 파일이 머지되면 **랜덤 문제 1개가 자동으로 배정**됩니다.

## 매주 하는 일

### 1. 문제 2개 고르기

보드의 **이번 주 추천 문제** 에서 골라도 되고, 다른 문제를 가져와도 됩니다.
`picks/<년-월-주차>/<github-id>.yaml` 에 **링크만** 넣습니다.
디렉터리 이름은 주차 id 그대로입니다 — 이번 주는 `2026-09-W2`.

```yaml
# picks/2026-09-W2/sjungwon03.yaml
- https://leetcode.com/problems/two-sum/
- https://school.programmers.co.kr/learn/courses/30/lessons/42576
```

머지되면 링크를 파싱해서 **제목과 난이도를 자동으로 채워** 등록합니다.
LeetCode와 프로그래머스를 지원하고, `?envType=...` 같은 쿼리가 붙어 있어도 됩니다.

이런 링크는 PR에서 걸립니다.

- 지원하지 않는 사이트 (백준 등)
- 문제 페이지가 아닌 링크 (콘테스트, 목록)
- 없는 문제, LeetCode 유료(Premium) 문제
- 이전 주차에 이미 받은 문제, 같은 문제를 두 번 적은 경우

이번 주 주제와 상관없는 문제를 골라도 등록은 됩니다.

### 2. 풀이 올리기

푼 문제마다 파일을 하나 만듭니다. **자기에게 할당된 문제만** 올릴 수 있습니다.

```
solutions/<년-월-주차>/<github-id>/<문제-id>.md
예: solutions/2026-09-W2/sjungwon03/programmers-1845.md
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

아직 푸는 중이라면 `status: doing` 으로 접근만 적어 올려도 됩니다.
`status: done` 은 풀이 코드 블록이 있어야 통과합니다.
전체 형식은 [examples/solution.md](examples/solution.md) 를 참고하세요.

### 3. PR 올리기

작업 전에 upstream 최신 main에서 브랜치를 땁니다.

```bash
git fetch upstream
git switch -c solve/2026-09-W2 upstream/main
```

끝나면 내 포크에 push하고 PR을 엽니다.

```bash
git push -u origin solve/2026-09-W2
gh pr create --repo sesac-mzc-algo/sesac-mzc-algo.github.io --fill
```

`gh` 가 없으면 push 후 GitHub이 띄워주는 **Compare & pull request** 버튼을 누르면 됩니다.
PR을 열면 형식 검사가 돌고, 머지되면 사이트가 자동으로 다시 배포됩니다.

올리기 전에 형식을 미리 확인하려면:

```bash
npm run validate   # 형식 검사
npm run serve      # 빌드 후 http://localhost:3000 에서 보기
```

## 알아두면 좋은 것

**주차 표기** — `2026-09-W2` 는 2026년 9월 2주차입니다.
**그 주의 목요일이 속한 달** 을 그 주의 달로 봅니다.
그래서 8월 31일(월)~9월 6일(일)은 `2026-09-W1` 입니다.

**주제 순환** — 매주 월요일 새벽에 다음 주제가 자동으로 정해집니다. 랜덤이 아니라
[커리큘럼 20개](tools/topics.mjs)를 순서대로 돕니다.
해시 → 스택/큐 → 정렬 → 투 포인터 → … → 연결 리스트, 그리고 다시 처음으로.

**난이도 표기** — 출처가 달라도 3단계로 묶어 필터합니다.
쉬움(Easy · Lv.1) / 보통(Medium · Lv.2~3) / 어려움(Hard · Lv.4+).
카드에는 원래 표기(`Medium`, `Lv.2`)가 그대로 보입니다.

**랜덤 문제** — 내 `levels` 안에서, 이전에 받은 적 없는 문제 중에서 뽑습니다.
같은 주에 다른 사람이 받은 문제는 되도록 피합니다.

## 관리

| 워크플로 | 시점 | 하는 일 |
| --- | --- | --- |
| `weekly` | 매주 월요일 00:10 KST | 주제와 추천 문제를 정하고 랜덤 문제를 배정 |
| `assign` | `members/` · `picks/` 변경 시 | 고른 링크를 등록하고 랜덤 문제가 없는 멤버에게 배정 |
| `collect` | 매월 1일 | LeetCode / 프로그래머스에서 문제 풀을 다시 수집 |
| `check` | PR · push | 테스트 + 형식 검사 + 빌드 |
| `deploy` | main push · `weekly` 완료 후 | 사이트를 빌드해 GitHub Pages에 배포 |

`weekly` 는 Actions 탭에서 **Run workflow** 로 주차(`2026-10-W1`)와
알고리즘(`greedy`)을 지정해 직접 돌릴 수도 있습니다.

프로그래머스는 문제 목록 API가 공개되어 있지 않아
[data/programmers-seed.json](data/programmers-seed.json) 의 큐레이션 목록을 씁니다.
문제를 추가하려면 `{ "id": 레슨번호, "topic": "주제slug", "level": 1~5 }` 를 넣고
`npm run collect` 를 돌립니다. (직접 고른 링크는 이 목록에 없어도 등록됩니다.)

레포 설정은 **Settings → Pages → Source** 가 `GitHub Actions`,
**Settings → Actions → General → Workflow permissions** 가 `Read and write` 여야 합니다.
