import numpy as np

x = np.array([-2., -1., 0., 1., 2.])
y = 2 * x + 1
w, b = 0., 0.
learning_rate = 0.1

for step in range(201):
    prediction = w * x + b
    error = prediction - y
    loss = np.mean(error ** 2)
    if step in [0, 1, 10, 100, 200]:
        print(step, round(loss, 6), round(w, 6), round(b, 6))
    if step < 200:
        dw = 2 * np.mean(error * x)
        db = 2 * np.mean(error)
        w -= learning_rate * dw
        b -= learning_rate * db

