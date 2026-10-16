import numpy as np

rng = np.random.default_rng(7)
X = rng.uniform(-1, 1, (320, 2))
y = (X[:, 0] * X[:, 1] > 0).astype(float).reshape(-1, 1)
order = rng.permutation(len(X))
X, y = X[order], y[order]
xt, yt = X[:200], y[:200]
xv, yv = X[200:260], y[200:260]
xs, ys = X[260:], y[260:]
W1 = rng.normal(0, .6, (2, 16))
b1 = np.zeros((1, 16))
W2 = rng.normal(0, .2, (16, 1))
b2 = np.zeros((1, 1))

def forward(x):
    h = np.tanh(x @ W1 + b1)
    p = 1 / (1 + np.exp(-(h @ W2 + b2)))
    return h, p

for step in range(2500):
    h, p = forward(xt)
    dz = (p - yt) / len(xt)
    dW2, db2 = h.T @ dz, dz.sum(axis=0, keepdims=True)
    dh = (dz @ W2.T) * (1 - h * h)
    dW1, db1 = xt.T @ dh, dh.sum(axis=0, keepdims=True)
    W1 -= .15 * dW1
    b1 -= .15 * db1
    W2 -= .15 * dW2
    b2 -= .15 * db2

for name, x, target in [("train", xt, yt), ("validation", xv, yv), ("test", xs, ys)]:
    _, p = forward(x)
    loss = -np.mean(target * np.log(p + 1e-9) + (1-target) * np.log(1-p + 1e-9))
    accuracy = np.mean((p >= .5) == target)
    print(name, round(loss, 4), round(accuracy, 4))

