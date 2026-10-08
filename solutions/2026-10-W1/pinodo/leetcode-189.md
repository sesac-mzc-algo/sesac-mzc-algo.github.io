---
status: done
language: python
# 블로그 등 풀이 원문이 있으면 아래 주석을 해제해 입력합니다.
# url: https://example.com/solution
---

## 접근

- int k가 주어지면, index k부터 index 0의 값이 시작되도록 배치
- Example
- Input: nums = [1,2,3,4,5,6,7], k = 3
- Output: [5,6,7,1,2,3,4]
- 맨 뒤 원소를 앞에 추가 후, 맨 뒤 원소 제거: 시간 초과
- 리스트를 역순으로 배치하고, k를 분기로 리스트 앞을 역전, 리스트 뒤를 역전하면 답이 나옴.
- k mod len(nums)해줘야 됨: 리스트 길이보다 길 경우/리스트 길이가 1일 경우를 대비해서

## 풀이

```python
# solution 참조
class Solution:
    def rotate(self, nums: list[int], k: int) -> None:
        """
        Do not return anything, modify nums in-place instead.
        """
        k %= len(nums)

        def reverse_array(left: int, right: int):
            while (left < right):
                nums[left], nums[right] = nums[right], nums[left]
                left += 1
                right -= 1

        reverse_array(0, len(nums) - 1)
        reverse_array(0, k - 1)
        reverse_array(k, len(nums) - 1)

# Try_1: 시간 초과
# class Solution:
#     def rotate(self, nums: list[int], k: int) -> None:
#         """
#         Do not return anything, modify nums in-place instead.
#         """
#         for i in range(k):
#             nums.insert(0, nums[-1])
#             nums.pop()
```

시간 O(n), 공간 O(1)

## 막혔던 부분
