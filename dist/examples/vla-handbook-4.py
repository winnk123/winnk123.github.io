import numpy as np
# 本例动作：[dx,dy,dz,drx,dry,drz,gripper]；米、弧度、开关。
low = np.array([-.04, -.04, -.03, -.2, -.2, -.2, 0.])
high = np.array([.04, .04, .03, .2, .2, .2, 1.])
action = np.array([.02, -.01, 0., .1, 0., -.1, 1.])
mask = np.array([True]*6 + [False])
z = np.where(mask, 2*(action-low)/(high-low)-1, action)
restored = np.where(mask, (z+1)/2*(high-low)+low, z)
print('normalized:', np.round(z, 4).tolist())
print('restored:', np.round(restored, 4).tolist())
assert np.allclose(action, restored)
# 用 256 个等宽区间示范量化，取区间中点重建。
bin_id = np.clip(np.floor((z[:6]+1)/2*256), 0, 255).astype(int)
z_hat = -1 + (bin_id+0.5)*2/256
continuous_hat = (z_hat+1)/2*(high[:6]-low[:6])+low[:6]
print('translation max error (m):', f'{np.max(abs(continuous_hat[:3]-action[:3])):.7f}')
# 归一化统计量属于动作语义的一部分；换错统计量会改变位移。
wrong_high = high.copy()
wrong_high[:3] *= 2
wrong_low = low.copy()
wrong_low[:3] *= 2
wrong = (z+1)/2*(wrong_high-wrong_low)+wrong_low
print('dx with wrong statistics (m):', round(float(wrong[0]), 4))

