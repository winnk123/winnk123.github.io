import numpy as np

# 教学环境：一维位置 x，动作 a 为本步位移，目标为 1。
H = 4
X, Y = [], []
for start in [-1.0, -0.5, 0.2, 0.5]:
    x = start
    states, actions = [], []
    for _ in range(12):
        states.append(x)  # 先观察，再发出 a_t
        a = 0.4 * (1.0 - x)
        actions.append(a)
        x += a
    for t in range(len(actions) - H + 1):
        X.append([states[t], 1.0])
        Y.append(actions[t:t + H])
X, Y = np.array(X), np.array(Y)
# 线性动作块策略：最小二乘精确求解 BC 的 MSE 目标。
W = np.linalg.lstsq(X, Y, rcond=None)[0]
print('dataset:', X.shape, Y.shape)
print('train MSE:', f'{np.mean((X @ W - Y)**2):.2e}')

def rollout(execute_horizon):
    x, steps = 0.0, 0
    while steps < 12:
        chunk = np.array([x, 1.0]) @ W
        for a in chunk[:execute_horizon]:
            x += 0.7 * a  # 执行器只走到命令位移的 70%
            steps += 1
            if steps == 12:
                break
    return abs(1.0 - x)

for n in [1, 4]:
    print(f'execute={n}, final error={rollout(n):.6f}')

