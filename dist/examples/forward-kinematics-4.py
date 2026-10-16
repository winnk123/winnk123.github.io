import numpy as np

def dh(theta, d, a, alpha):
    c, s = np.cos(theta), np.sin(theta)
    ca, sa = np.cos(alpha), np.sin(alpha)
    return np.array([[c, -s*ca, s*sa, a*c],
                     [s, c*ca, -c*sa, a*s],
                     [0., sa, ca, d],
                     [0., 0., 0., 1.]])

q1, q2 = np.deg2rad([30., -60.])
T_02 = dh(q1, 0., 1., 0.) @ dh(q2, 0., 0.7, 0.)
T_2tcp = np.eye(4)
T_2tcp[0, 3] = 0.1
T_0tcp = T_02 @ T_2tcp
print("link endpoint:", np.round(T_02[:2, 3], 6))
print("TCP:", np.round(T_0tcp[:2, 3], 6))
print("heading degrees:", np.rad2deg(np.arctan2(T_02[1, 0], T_02[0, 0])))
geometric = [np.cos(q1)+0.7*np.cos(q1+q2),
             np.sin(q1)+0.7*np.sin(q1+q2)]
assert np.allclose(T_02[:2, 3], geometric)

