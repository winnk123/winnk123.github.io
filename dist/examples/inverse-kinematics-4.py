import numpy as np

L1, L2 = 1., 0.7
target = np.array([1.2, 0.5])

def fk(q):
    a, b = q[0], q.sum()
    return np.array([L1*np.cos(a)+L2*np.cos(b),
                     L1*np.sin(a)+L2*np.sin(b)])

def jacobian(q):
    a, b = q[0], q.sum()
    return np.array([[-L1*np.sin(a)-L2*np.sin(b), -L2*np.sin(b)],
                     [L1*np.cos(a)+L2*np.cos(b), L2*np.cos(b)]])

c2 = (target @ target - L1**2 - L2**2)/(2*L1*L2)
if abs(c2) > 1 + 1e-12:
    raise ValueError("target outside workspace")
for sign in (1, -1):
    q2 = sign*np.arccos(np.clip(c2, -1, 1))
    q1 = np.arctan2(target[1], target[0])-np.arctan2(L2*np.sin(q2), L1+L2*np.cos(q2))
    print("analytic degrees:", np.round(np.rad2deg([q1, q2]), 6))

q = np.array([0.2, 0.9])
lam = 0.03
for k in range(200):
    error = target-fk(q)
    if np.linalg.norm(error) < 1e-9:
        break
    J = jacobian(q)
    dq = J.T @ np.linalg.solve(J @ J.T + lam**2*np.eye(2), error)
    dq *= min(1., 0.2/max(np.linalg.norm(dq), 1e-12))
    q += dq
residual = np.linalg.norm(target-fk(q))
print("numeric degrees:", np.round(np.rad2deg(q), 6))
print("residual metres:", residual)
eps = 1e-6
J_fd = np.column_stack([(fk(q+eps*axis)-fk(q-eps*axis))/(2*eps) for axis in np.eye(2)])
assert residual < 1e-8
assert np.allclose(jacobian(q), J_fd, atol=1e-8)

