---
status: doing
language: python
# 블로그 등 풀이 원문이 있으면 아래 주석을 해제해 입력합니다.
# url: https://example.com/solution
---

## 접근

문제를 어떻게 읽었고 어떤 자료구조나 알고리즘을 골랐는지 적습니다.
왜 그 방법을 골랐는지, 처음에 떠올린 방법이 왜 안 되는지도 함께 적으면 좋습니다.

## 풀이

```python
def solution(participant, completion):
    from collections import Counter
    return list(Counter(participant) - Counter(completion))[0]
```

시간복잡도와 공간복잡도를 적습니다. 예) 시간 O(n), 공간 O(n)

## 막혔던 부분

풀면서 헤맨 지점, 놓쳤던 반례, 리뷰에서 배운 점을 적습니다.
없으면 이 섹션은 생략합니다.