---
status: done
language: c++
# 블로그 등 풀이 원문이 있으면 아래 주석을 해제해 입력합니다.
# url: https://example.com/solution
---

## 접근

각 값이 몇 번 나왔는지 세야 하므로, 값을 키로 두고 O(1)에 누적할 수 있는
`unordered_map`을 골랐다. 등장 순서나 키 정렬이 필요 없어서 `map` 대신 썼다.

빈도 상위 k개를 뽑으려면 빈도 기준 정렬이 필요한데 map 자체는 정렬할 수 없다.
그래서 `vector<pair<int,int>>`로 옮긴 뒤 second 내림차순으로 정렬하고 앞에서 k개를 잘랐다.

## 풀이

```C++
class Solution {
public:
    vector<int> topKFrequent(vector<int>& nums, int k) {
        vector<int> ans;
        vector<pair<int,int>> v;
        unordered_map<int, int> map;

        for(auto n : nums){
            map[n]++;
        }

        for(auto it = map.begin(); it != map.end();it++){
            v.push_back({it->first, it->second});
        }

        sort(v.begin(), v.end(), [](auto& a, auto& b){
            return a.second > b.second;
        });

        for(int i=0;i<k;i++){
            ans.push_back(v[i].first);
        }

        return ans;
    }
};
```

시간복잡도O(nlogn)
소요시간: 약 20분

## 막혔던 부분

처음 정렬을 할 때 우선순위 큐를 사용했는데 value의 값으로 정렬을 해야함으로
compare의 커스텀이 필요했다. 그래서 굳이 복잡하게 우선순위 큐를 사용할 필요없이
벡터로 바꿔서 정렬했다.