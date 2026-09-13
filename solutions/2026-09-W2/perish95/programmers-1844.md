---
status: done
language: cpp
# 블로그 등 풀이 원문이 있으면 아래 주석을 해제해 입력합니다.
# url: https://example.com/solution
---

## 접근

최단 경로 문제임으로 BFS를 선택하여 풀이했다.

## 풀이

```C++
#include<vector>
#include<iostream>
#include<queue>
using namespace std;


int solution(vector<vector<int>> maps)
{
    int N = maps.size();
    int M = maps[0].size();
    int dx[4] = {1, 0, -1, 0};
    int dy[4] = {0, 1, 0, -1};
    
    vector<vector<int>> ans(N, vector<int>(M, -1));
    queue<pair<int,int>> q;
    
    q.push({0,0});
    ans[0][0] = 1;
    
    while(!q.empty()){
        auto [x, y] = q.front();
        q.pop();
        
        for(int i=0;i<4;i++){
            int nx = x + dx[i];
            int ny = y + dy[i];

            if(nx < 0 || nx >=N || ny < 0 || ny >= M) continue;

            if(maps[nx][ny] == 1 && ans[nx][ny] == -1){
                ans[nx][ny] = ans[x][y] + 1;
                q.push({nx,ny});
            }
        }
    }
    
    return ans[N-1][M-1];
}
```

시간복잡도O(NM)
소요시간: 약 40분

## 막혔던 부분

처음 접근을 DFS로 했는데TLE와 효율성 체크에서 실패했다.
DFS는 경로가 유효한지 확인하기 위해서 끝까지 가야하는 필요성이 있다.
그래서 BFS로 방향을 틀어서 풀이했다. 