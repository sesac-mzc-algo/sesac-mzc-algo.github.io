---
status: done
language: python
# 블로그 등 풀이 원문이 있으면 아래 주석을 해제해 입력합니다.
# url: https://example.com/solution
---

## 접근
- 사이즈가 정해진 캐시가 있음.
- 용량이 다 차기 전까지 k-v를 넣으면 순차적으로 들어감
- 중간에 get(k)이 호출되면 최근에 사용됐으므로 순번이 마지막으로 밀려남
- 용량이 다 찼는데, put(k, v)호출 시, k값이 있으면 순번 마지막으로 밀고 업데이트, k값이 없으면 가장 적게 사용된 elem(해시맵에서 가장 첫번째 k-v쌍)을 빼내고, 마지막 순번에 새로운 k-v값 저장


## 풀이

```python
class LRUCache:

    def __init__(self, capacity: int):
        self.capacity = capacity
        self.cache = {}

    def get(self, key: int) -> int:
        if (key not in self.cache):
            return -1
        value = self.cache.pop(key)
        self.cache[key] = value
        return value

    def put(self, key: int, value: int) -> None:
        if (key in self.cache):
            self.cache.pop(key)
        self.cache[key] = value
        if (len(self.cache) > self.capacity):
            self.cache.pop(next(iter(self.cache)))


# Your LRUCache object will be instantiated and called as such:
# obj = LRUCache(capacity)
# param_1 = obj.get(key)
# obj.put(key,value)
```

시간 O(1), 공간 O(capacity)

## 막혔던 부분
- get(k) 먼저 호출 시, 나중에 put(k, v)가 호출되었을 때, 순번이 적용되는줄 알았음.