import numpy as np
GiB = 2**30
params = 7_000_000_000
print("weights FP16 GiB:", round(params*2/GiB, 3))
print("weights INT4 ideal GiB:", round(params*0.5/GiB, 3))
def kv_bytes(batch, layers, length, kv_heads, head_dim, elem_bytes=2):
    return 2*batch*layers*length*kv_heads*head_dim*elem_bytes
print("GQA KV GiB:", kv_bytes(2,32,8192,8,128)/GiB)
print("MHA KV GiB:", kv_bytes(2,32,8192,32,128)/GiB)
w = np.array([-1., -.3, .1, .8])
scale = np.max(np.abs(w))/7
q = np.clip(np.round(w/scale), -7, 7).astype(np.int8)
print("int4 values:", q.tolist())
print("max quantization error:", round(float(np.max(np.abs(w-q*scale))), 6))
# 单头、单位投影：缓存后的逐步计算与整段因果计算一致
x = np.arange(12, dtype=float).reshape(3,4)/10
def softmax(a):
    e = np.exp(a-a.max(axis=-1,keepdims=True))
    return e/e.sum(axis=-1,keepdims=True)
scores = x@x.T/2
mask = np.triu(np.ones((3,3),bool),1)
full = softmax(np.where(mask,-np.inf,scores))@x
keys, values, incremental = [], [], []
for token in x:
    keys.append(token); values.append(token)
    p = softmax(token@np.array(keys).T/2)
    incremental.append(p@np.array(values))
print("cached equals full:", np.allclose(full, incremental))

