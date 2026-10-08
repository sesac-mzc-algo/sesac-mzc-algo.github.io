---
status: done
language: python
# 블로그 등 풀이 원문이 있으면 아래 주석을 해제해 입력합니다.
# url: https://example.com/solution
---

## 접근
- 정수 리스트가 주어지는데, 한 숫자의 중복은 최대 2번만 허용됨
- 투포인터를 이용해서 현재 원소와 현재 + idx2 의 원소를 비교해서 같으면 넘기고(중복 제거), 같지 않으면 덮어씌움

## 풀이

```python
class Solution:
    def removeDuplicates(self, nums: list[int]) -> int:
        k = 0
        
        for num in nums:
            if (k < 2 or num != nums[k - 2]):
                nums[k] = num
                k += 1

        return k
```

시간 O(n), 공간 O(1)

## 막혔던 부분
- 투포인터를 어떻게 활용할지 고민함