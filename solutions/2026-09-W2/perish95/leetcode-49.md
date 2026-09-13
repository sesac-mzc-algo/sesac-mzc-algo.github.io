---
status: done
language: c++
# 블로그 등 풀이 원문이 있으면 아래 주석을 해제해 입력합니다.
# url: https://example.com/solution
---

## 접근

해시 문제이므로 `map`을 사용했다.
대신 key, value를 저장할 때 key의 값을 strs의 요소가 아닌 알파벳 순으로 정렬된 값을 키로, 원본 값을 value로 사용했다.
그래서 컬렉션의 데이터타입을 `<string, vector<string>>`으로 선언했다.

그 후에 `map`의 순회를 돌면서 차례차례 `ans`에 넣어서 반환했다.

## 풀이

```C++
class Solution {
public:
    vector<vector<string>> groupAnagrams(vector<string>& strs) {
        vector<vector<string>> ans;
        unordered_map<string, vector<string>> map;

        for(auto s : strs){
            string temp = s;
            sort(temp.begin(), temp.end());
            map[temp].push_back(s);
        }

        for(auto it=map.begin();it != map.end();it++){
            ans.push_back(it->second);
        }

       
        return ans;
    }
};
```

시간복잡도O(n klogk)
소요시간: 약 20분

## 막혔던 부분

초기에는 키값을 strs의 값으로 잡고 진행했는데 `map`에 저장된 값을 다시 sort하고 답을 저장하는 과정이
너무 복잡해서 풀이방식을 다시 고민하게 됐다.