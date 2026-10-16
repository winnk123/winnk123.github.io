import numpy as np
import cv2 as cv

def pose(rvec, p):
    H = np.eye(4)
    H[:3, :3] = cv.Rodrigues(np.asarray(rvec, dtype=float))[0]
    H[:3, 3] = p
    return H

def inverse(H):
    out = np.eye(4)
    out[:3, :3] = H[:3, :3].T
    out[:3, 3] = -out[:3, :3] @ H[:3, 3]
    return out

rng = np.random.default_rng(42)
X = pose([0.2, -0.1, 0.15], [0.04, -0.02, 0.1])  # gripper <- camera
Y = pose([0.1, 0.2, -0.2], [0.5, 0.1, 1.2])       # base <- target
G, C = [], []
for _ in range(24):
    g = pose(rng.uniform(-0.65, 0.65, 3),
             np.array([0.3, 0.1, 0.4])+rng.uniform(-0.12, 0.12, 3))
    c = inverse(X) @ inverse(g) @ Y
    G.append(g)
    C.append(c)

# The last six poses are held out from the solve.
train = 18
R, t = cv.calibrateHandEye(
    [h[:3, :3] for h in G[:train]], [h[:3, 3] for h in G[:train]],
    [h[:3, :3] for h in C[:train]], [h[:3, 3] for h in C[:train]],
    method=cv.CALIB_HAND_EYE_PARK)
X_hat = np.eye(4)
X_hat[:3, :3], X_hat[:3, 3] = R, t.ravel()
closure = [inverse(Y) @ g @ X_hat @ c for g, c in zip(G[train:], C[train:])]
position_errors = [np.linalg.norm(h[:3, 3]) for h in closure]
rotation_errors = [np.linalg.norm(cv.Rodrigues(h[:3, :3])[0]) for h in closure]
A = inverse(G[1]) @ G[0]
B = C[1] @ inverse(C[0])
print("camera origin in gripper:", np.round(t.ravel(), 6))
print("AX-XB norm:", np.linalg.norm(A @ X_hat-X_hat @ B))
print("held-out max position error:", max(position_errors))
print("held-out max rotation error radians:", max(rotation_errors))
assert np.linalg.norm(X_hat-X) < 1e-8
assert max(position_errors) < 1e-8

