---
status: done
language: java
---

## 접근

1. `sequence` 길이가 최대 100만이라 모든 구간을 확인하는 `O(n^2)`는 불가능하다. `O(n)`으로 풀어야 한다.
2. 원소가 **전부 양수**라는 조건이 핵심이다. 덕분에 "오른쪽을 늘리면 합이 커지고, 왼쪽을 줄이면 합이 작아진다"는 단조성이 성립해서 투 포인터를 쓸 수 있다. (음수가 섞이면 이 방법이 깨진다.)
3. `left`와 `right`를 둘 다 0에서 시작해 **같은 방향으로만** 움직이는 슬라이딩 윈도우를 만든다. 윈도우 안의 합 `sum`을 들고 다닌다.
   - `sum < k` → `right`를 늘려 합을 키운다
   - `sum > k` → `left`를 늘려 합을 줄인다
   - `sum == k` → 후보로 기록한다
4. `sum == k`일 때 `left`를 더 옮기면 양수를 빼는 것이라 무조건 `k`보다 작아진다. 그래서 더 볼 필요 없이 `right`를 늘리면 된다. `while` 조건이 `sum >= k`가 아니라 `sum > k`인 이유다.
5. 길이 비교는 `right - left < bestEnd - bestStart`로 한다. 실제 길이는 `+1`을 해야 하지만 양쪽에 똑같이 붙으므로 생략해도 결과가 같다. 등호를 넣지 않아 **길이가 같으면 갱신하지 않으므로**, 먼저 찾은 쪽(시작 인덱스가 더 작은 쪽)이 자동으로 남는다.
6. `sum`은 `long`으로 둔다. `k`가 최대 10억이라 `int`로는 넘칠 수 있다.
7. `left`가 되돌아가는 일이 없어 두 포인터가 합쳐 최대 2n번만 움직인다. 따라서 `O(n)`.

## 풀이

```java
class Solution {
    public int[] solution(int[] sequence, int k) {
        int left = 0;
        int bestStart = 0;
        int bestEnd = sequence.length - 1;
        long sum = 0;

        for (int right = 0; right < sequence.length; right++) {
            // 오른쪽을 한 칸 늘려 윈도우에 넣는다
            sum += sequence[right];

            // 합이 넘치면 왼쪽을 줄여서 맞춘다
            while (sum > k) {
                sum -= sequence[left];
                left++;
            }

            // 정확히 k가 되면 더 짧은 구간일 때만 갱신
            if (sum == k && right - left < bestEnd - bestStart) {
                bestStart = left;
                bestEnd = right;
            }
        }
        return new int[]{bestStart, bestEnd};
    }
}
```

시간 O(n), 공간 O(1)

### 동작 예시 (`sequence = [1,2,3,4,5]`, `k = 7`)

| right | 더함 | sum | while (sum > 7) | left | sum | ==7? | best |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0~2 | | 1, 3, 6 | - | 0 | 6 | | `[0,4]` |
| 3 | +4 | 10 | `-1`→9 `-2`→7 | 2 | 7 | 성립 (`1 < 4`) | `[2,3]` |
| 4 | +5 | 12 | `-3`→9 `-4`→5 | 4 | 5 | | `[2,3]` |

## 막혔던 부분

1. `right - left < bestEnd - bestStart` 조건이 무엇을 뜻하는지 바로 읽히지 않았습니다. 실제 길이는 `+1`을 해야 하는데 양쪽에서 생략된 것이라는 점, 그리고 등호를 빼는 것만으로 "길이가 같으면 시작 인덱스가 작은 것"이라는 조건이 해결된다는 점을 이해하는 데 시간이 걸렸습니다.
2. 투 포인터에서 두 포인터를 어느 방향으로 움직여야 하는지 판단하는 부분 (611번과 달리 이 문제는 둘 다 오른쪽으로만 움직인다는 점)
