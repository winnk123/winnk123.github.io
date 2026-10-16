from collections import Counter
from math import comb
# 同一问题的四个候选答案；这里只用固定候选演示选择机制
answers = [41, 41, 42, 43]
scores = [.92, .90, .85, .70]
gold = 42
vote = Counter(answers).most_common(1)[0][0]
best = answers[max(range(len(scores)), key=scores.__getitem__)]
print("candidate available:", gold in answers)
print("majority:", vote, "score selection:", best)
# 正确候选存在，不代表投票或评分器能选中
n, c, k = 10, 3, 4
pass_k = 1-comb(n-c,k)/comb(n,k)
print("finite-bank pass@4:", round(pass_k, 6))
# 假设独立采样且单次成功率固定为 p，理论至少成功一次的概率
p = .3
for budget in [1,2,4,8]:
    print("samples", budget, "discovery", round(1-(1-p)**budget, 4))
# 同一份候选池对三个选择器重放
banks = [[42,41,41], [42,42,40], [40,41,43]]
print("bank availability:", sum(gold in b for b in banks)/len(banks))
print("vote accuracy:", sum(Counter(b).most_common(1)[0][0]==gold for b in banks)/len(banks))

