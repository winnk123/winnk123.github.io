import numpy as np
rng = np.random.default_rng(7)
A = np.array([[[0.4], [0.24], [0.144], [0.0864]]])
noise = rng.normal(size=A.shape)
# 扩散的一个训练噪声级别，alpha_bar 为累计信号系数。
alpha_bar = 0.6
noisy = np.sqrt(alpha_bar)*A + np.sqrt(1-alpha_bar)*noise
# 零输出模型的噪声预测损失；训练会更新模型以降低此值。
eps_prediction = np.zeros_like(A)
diffusion_loss = np.mean((eps_prediction-noise)**2)
# Flow matching：本例约定 tau=0 是噪声，tau=1 是动作。
tau = 0.3
mixed = (1-tau)*noise + tau*A
velocity_target = A-noise
velocity_prediction = np.zeros_like(A)
flow_loss = np.mean((velocity_prediction-velocity_target)**2)
print('action / noisy / mixed:', A.shape, noisy.shape, mixed.shape)
print('diffusion loss:', round(float(diffusion_loss), 6))
print('flow loss:', round(float(flow_loss), 6))
# 插值路径的导数确实是 A-noise。
dt = 1e-5
next_mixed = (1-tau-dt)*noise + (tau+dt)*A
assert np.allclose((next_mixed-mixed)/dt, velocity_target)

