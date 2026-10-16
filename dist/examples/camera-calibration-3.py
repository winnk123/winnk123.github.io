import numpy as np
import cv2 as cv

rng = np.random.default_rng(7)
K_true = np.array([[800., 0., 320.], [0., 810., 240.], [0., 0., 1.]])
d_true = np.array([-0.1, 0.03, 0.001, -0.0005, 0.])
board = np.zeros((9*6, 3), np.float32)
board[:, :2] = np.mgrid[0:9, 0:6].T.reshape(-1, 2)*0.025
board[:, :2] -= [0.1, 0.0625]
objects, images = [], []
for _ in range(18):
    rvec = rng.uniform(-0.45, 0.45, 3)
    tvec = np.array([rng.uniform(-0.08, 0.08), rng.uniform(-0.05, 0.05), rng.uniform(0.55, 0.85)])
    uv, _ = cv.projectPoints(board, rvec, tvec, K_true, d_true)
    objects.append(board.copy())
    images.append(uv.astype(np.float32))
rms, K, dist, _, _ = cv.calibrateCamera(objects, images, (640, 480), None, None)
r_true = np.array([0.2, -0.1, 0.05])
t_true = np.array([0.03, -0.02, 0.7])
observed, _ = cv.projectPoints(board, r_true, t_true, K_true, d_true)
ok, rvec, tvec = cv.solvePnP(board, observed, K, dist)
assert ok
predicted, _ = cv.projectPoints(board, rvec, tvec, K, dist)
pixel_rms = np.sqrt(np.mean(np.sum((predicted-observed).reshape(-1, 2)**2, axis=1)))
print("fx, fy, cx, cy:", np.round([K[0, 0], K[1, 1], K[0, 2], K[1, 2]], 3))
print("board origin in camera:", np.round(tvec.ravel(), 6))
R, _ = cv.Rodrigues(rvec)
print("camera origin in board:", np.round((-R.T @ tvec).ravel(), 6))
print("calibration / PnP RMS pixels:", rms, pixel_rms)
assert np.max(np.abs(K-K_true)) < 0.01
assert np.linalg.norm(tvec.ravel()-t_true) < 1e-5

