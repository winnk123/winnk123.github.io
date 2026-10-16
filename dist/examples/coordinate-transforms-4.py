import numpy as np

def T(R, p):
    out = np.eye(4)
    out[:3, :3], out[:3, 3] = R, p
    return out

def inverse(H):
    R, p = H[:3, :3], H[:3, 3]
    return T(R.T, -R.T @ p)

R_bg = np.array([[0., -1., 0.], [1., 0., 0.], [0., 0., 1.]])
T_bg = T(R_bg, [0.4, 0.2, 0.3])
T_gc = T(np.eye(3), [0.05, 0., 0.1])
p_c = np.array([0.1, 0.02, 0.5, 1.])
T_bc = T_bg @ T_gc
p_b = T_bc @ p_c
print("base point:", np.round(p_b[:3], 6))
print("back to camera:", np.round((inverse(T_bc) @ p_b)[:3], 6))
print("rotation determinant:", np.linalg.det(T_bc[:3, :3]))
assert np.allclose(p_b[:3], [0.38, 0.35, 0.9])
assert np.allclose(inverse(T_bc) @ T_bc, np.eye(4))

