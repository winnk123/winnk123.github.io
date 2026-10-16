from collections import Counter
from math import log, sqrt
import json
# 空格用于显式分词；text 是将被引用的原始片段
corpus = [
    {"id":"D1", "terms":"相机 标定 内参 棋盘格 重投影", "text":"内参标定用多张不同姿态的棋盘格图像拟合相机模型。"},
    {"id":"D2", "terms":"机械臂 逆运动学 IK 关节 末端", "text":"逆运动学根据目标末端位姿求解关节变量。"},
    {"id":"D3", "terms":"模型 微调 LoRA 低秩 参数", "text":"LoRA 冻结基础权重并训练低秩权重增量。"},
    {"id":"D4", "terms":"相机 手眼 标定 外参 机械臂", "text":"手眼标定求相机坐标系与机械臂相关坐标系之间的刚体变换。"}
]
vocab = sorted(set(" ".join(d["terms"] for d in corpus).split()))
idf = {w: log((1+len(corpus))/(1+sum(w in d["terms"].split() for d in corpus)))+1 for w in vocab}
def vector(text):
    c = Counter(text.split())
    v = [c[w]*idf[w] for w in vocab]
    norm = sqrt(sum(x*x for x in v)) or 1.0
    return [x/norm for x in v]
docs = [vector(d["terms"]) for d in corpus]
def search(query, k=2):
    q = vector(query)
    scores = [sum(a*b for a,b in zip(q,d)) for d in docs]
    order = sorted(range(len(corpus)), key=lambda i: (-scores[i], corpus[i]["id"]))
    return [corpus[i] for i in order[:k] if scores[i] > 0]
# 一个可检查的工具调用协议
call = json.loads('{"tool":"search","arguments":{"query":"相机 标定 内参"}}')
assert call["tool"] == "search"
assert isinstance(call["arguments"]["query"], str)
hits = search(call["arguments"]["query"])
print("retrieved:", [d["id"] for d in hits])
# 抽取式回答基线；接入 LLM 时仍返回相同的 answer/citations 结构
result = {"answer": hits[0]["text"], "citations": [hits[0]["id"]]}
assert set(result["citations"]) <= {d["id"] for d in hits}
print(json.dumps(result, ensure_ascii=False))
eval_set = [("相机 内参", "D1"), ("机械臂 逆运动学", "D2"), ("LoRA 微调", "D3")]
recall = sum(gold in [d["id"] for d in search(q,1)] for q,gold in eval_set)/len(eval_set)
print("Recall@1:", f"{recall:.3f}")
print("unknown query:", search("温度 湿度"))

