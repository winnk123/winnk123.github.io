import numpy as np
# 单个 query 的教学例子：按两 token 一组选择微块
scores = np.array([.1,.2,1.2,1.4,3.0,2.8,.4,.3])
values = np.array([0.,0.,1.,1.,2.,2.,-1.,-1.])
def softmax(s):
    e=np.exp(s-s.max()); return e/e.sum()
dense = softmax(scores)@values
blocks = scores.reshape(4,2)
# 教学 indexer 直接用块内最大 logit；真实模型需单独学习轻量索引器
keep_blocks = np.argsort(blocks.max(axis=1))[-2:]
keep = np.sort(np.concatenate([np.arange(i*2,i*2+2) for i in keep_blocks]))
sparse = softmax(scores[keep])@values[keep]
print("selected tokens:", keep.tolist())
print("dense:", round(float(dense),6))
print("sparse:", round(float(sparse),6))
print("abs error:", round(float(abs(dense-sparse)),6))
# 算关键缓存规模，不把示例配比等同于某个已发布模型
T,L,heads,dim,bytes_per = 32768,32,8,128,2
full_kv = 2*L*T*heads*dim*bytes_per
# 假设 8 层保留 KV，另 24 层每头保存 d×d 的 FP16 递归状态
hybrid = 2*8*T*heads*dim*bytes_per + 24*heads*dim*dim*bytes_per
print("full KV GiB:", round(full_kv/2**30,6))
print("illustrative hybrid GiB:", round(hybrid/2**30,6))

