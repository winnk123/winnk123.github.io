import numpy as np
np.set_printoptions(precision=3, suppress=True)
def softmax(x):
    e = np.exp(x - x.max(axis=-1, keepdims=True))
    return e / e.sum(axis=-1, keepdims=True)
def attention(x):
    # 为看清运算，令 Q、K、V 投影均为单位矩阵
    scores = x @ x.T / np.sqrt(x.shape[-1])
    future = np.triu(np.ones(scores.shape, dtype=bool), k=1)
    weights = softmax(np.where(future, -np.inf, scores))
    return weights, weights @ x
x = np.array([[1., 0.], [0., 1.], [1., 1.]])
a, h = attention(x)
print("attention:\n", a)
print("row sums:", a.sum(axis=1))
# 每个位置预测下一 token，3 个候选 token
unembed = np.array([[1., 0., -1.], [0., 1., -1.]])
p = softmax(h @ unembed)
target = np.array([1, 2, 0])
loss = -np.log(p[np.arange(3), target]).mean()
print("next-token loss:", round(float(loss), 6))
x_changed = x.copy(); x_changed[2] = [100., -100.]
print("past unchanged:", np.allclose(attention(x_changed)[1][:2], h[:2]))

