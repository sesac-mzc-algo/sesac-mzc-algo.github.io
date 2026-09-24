---
status: done
language: cpp
# 블로그 등 풀이 원문이 있으면 아래 주석을 해제해 입력합니다.
# url: https://example.com/solution
# 파일명 양식
# programmers-.md  leetcode-.md
---

## 문제 설명

- m x n 배열에 든 알파벳들 `board`와 찾아야 할 단어`word`를 제시한다.
- m x n 배열을 탐색해서 가로 또는 세로로 인접한 셀에 있는 글자들을 조합해서 `word`를 찾는다.
- 찾으면 `true` 못 찾으면 `false`를 반환한다.

## 접근

- 우선 인접한 가로 세로이므로 탐색으로 방향을 잡는다.
- 방문했던 곳을 다시 돌아가서 탐색해야 하므로 **백트래킹**을 이용한 문제다.

## 풀이

```C++
class Solution {
public:
    /*** Global ***/
    int dx[4] = {1, 0, -1, 0};
    int dy[4] = {0, 1, 0, -1};
    int M, N;

    bool dfs(vector<vector<char>>& board, string& word, int len, int x, int y) {
        if (len == word.size()) return true;
        if (x < 0 || x >= M || y < 0 || y >= N) return false;
        if (board[x][y] != word[len]) return false;

        char temp = board[x][y];
        board[x][y] = '#';

        for (int i = 0; i < 4; i++) {
            int nx = x + dx[i];
            int ny = y + dy[i];
            if (dfs(board, word, len + 1, nx, ny)) return true;
        }

        board[x][y] = temp;
        return false;
    }

    bool exist(vector<vector<char>>& board, string word) {
        M = board.size();
        N = board[0].size();

        for (int i = 0; i < M; i++) {
            for (int j = 0; j < N; j++) {
                if (dfs(board, word, 0, i, j)) return true;
            }
        }
        return false;
    }
};

```

시간복잡도O(mn3^l) l:글자의 길이
소요시간: 약 50분

## 막혔던 부분

처음에는 완전탐색 문제라 판단하고 BFS로 접근했다.
단어의 첫 글자와 일치하는 좌표를 큐에 미리 담아 탐색하려 했는데,
같은 알파벳이 word에 여러 번 등장할 수 있어 방문 처리를 하면
유효한 경로까지 막히는 문제가 있었다.

경로 위에서 이미 지나온 칸만 재사용을 막고,
다른 경로에서는 다시 쓸 수 있어야 한다는 점에서
되돌아가며 복원하는 백트래킹이 필요하다고 판단해 방향을 바꿨다.
