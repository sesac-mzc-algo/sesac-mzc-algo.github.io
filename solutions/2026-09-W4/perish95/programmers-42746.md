---
status: done
language: cpp
# 블로그 등 풀이 원문이 있으면 아래 주석을 해제해 입력합니다.
# url: https://example.com/solution
# 파일명 양식
# programmers-.md  leetcode-.md
---

## 문제 설명

- 0을 포함한 양의 정수가 배열로 주어진다.
- 이 때, 이 수들을 붙여서 가장 큰 수를 만들어서 반환

## 접근

- 주어진 배열들을 가장 큰 수가 되도록 정렬한다.
- 배열을 정렬하기 위해서 두 개의 수를 `string`으로 변환해서 합친 것들을 비교해서 큰 수를 앞으로 배치한다.
- 정렬된 수들을 `string`으로 변환해서 `answer`에 붙여서 반환한다.

## 풀이

```C++
#include <string>
#include <vector>
#include <algorithm>

using namespace std;

string solution(vector<int> numbers) {
    string answer = "";

    sort(numbers.begin(), numbers.end(), [](int a, int b){
        string sa = to_string(a);
        string sb = to_string(b);
        return sa + sb > sb + sa;
    });

    for(auto n : numbers){
        answer += to_string(n);
    }

    if (answer[0] == '0') return "0";

    return answer;
}

```

시간복잡도O(nlogn)
소요시간: 약 30분

## 막혔던 부분

처음에 3계층으로 분류를 시도했으나 두 번째 예제에 막혀서 고민했다.
두 수들을 직접적으로 비교해야만 정렬이 되서 어디 계층 사이에 넣을지 생각하다가
그럴 필요가 없다는 것을 깨닫고 저것 하나만 두고 정렬했다.
그러다 테스트케이스 11번이 틀려서 한참 생각하다가 [0, 0, 0 ..]을 겨우 생각해내서
마지막에 한 줄 넣고 통과했다.