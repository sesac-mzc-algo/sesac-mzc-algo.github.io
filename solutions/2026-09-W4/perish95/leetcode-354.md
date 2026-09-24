---
status: done
language: cpp
# 블로그 등 풀이 원문이 있으면 아래 주석을 해제해 입력합니다.
# url: https://example.com/solution
# 파일명 양식
# programmers-.md  leetcode-.md
---

## 문제 설명

- `(너비, 높이)` 쌍으로 이루어진 배열 `envelopes`가 주어진다.
- 봉투 A를 봉투 B 안에 넣으려면 너비와 높이가 모두 B보다 작아야한다.
- 이렇게 차례로 넣을 수 있는 봉투들의 최대 개수(가장 긴 오름차순 배열의 길이)를 반환한다.

## 접근

- 너비와 높이 둘 다 커야하기 때문에 먼저 너비를 **오름차순**으로 정렬한다.
- 너비가 같을 경우 높이를 **내림차순**으로 정렬한다.
- 높이를 오름차순으로 정렬할 경우 너비가 같아도 LIS(최장 증가 순열)에 포함되기 때문에 이 경우를 배제하기 위함이다.
- 그 다음 높이를 기준으로 LIS(이분탐색 방식)를 구해서 최대 길이 값을 반환한다. 

## 풀이

```C++
class Solution {
public:
    int maxEnvelopes(vector<vector<int>>& envelopes) {
        sort(envelopes.begin(), envelopes.end(), [](auto &a, auto &b){
            if(a[0] == b[0]) return a[1] > b[1]; // (3, 1), (3, 2), (3, 3)일 경우 정답인 1로 반환하기 위해 
            return a[0] < b[0];
        });

        vector<int> lis;

        for(auto a : envelopes){
            int temp = a[1];
            auto it = lower_bound(lis.begin(), lis.end(), temp); //이진 탐색 O(logn)

            if(it == lis.end()) lis.push_back(temp);
            else *it = temp;
        }

        return lis.size();
    }
};

```

시간복잡도 O(nlogn)
소요시간: 약 90~100분

## 막혔던 부분

높이와 너비를 오름차순 정렬로 접근했었는데 너비가 같은 경우를 제외시키지 못해서 통과못했다.
그래서 높이를 내림차순으로 수정했지만, envelopes의 값들끼리 비교하는 식으로 이중루프를 돌리니 
건너띄어서 넣어야하는 부분을 체크하지 못해서 또 실패했다.
이 때, LIS가 섞인 문제라는 것을 깨닫고 풀었다. 
