# 标准 Python 即可运行：杯子在右抽屉，顶抓会滑落。
class Kitchen:
    def __init__(self):
        self.drawer = None
        self.held = False
        self.done = False
    def observe(self):
        if self.done: return 'cup_on_tray'
        if self.held: return 'cup_in_hand'
        if self.drawer is None: return 'closed_drawers'
        return 'empty' if self.drawer == 'left' else 'cup_visible'
    def step(self, action):
        if action.startswith('open_'):
            self.drawer = action.split('_')[1]
            return 'opened'
        if action == 'close':
            self.drawer = None
            return 'closed'
        if action == 'grasp_top': return 'slipped'
        if action == 'grasp_side':
            self.held = True
            return 'grasped'
        if action == 'place':
            self.held, self.done = False, True
            return 'placed'
        raise ValueError(action)

def run(use_memory):
    env, memory, trace = Kitchen(), set(), []
    for _ in range(8):
        obs = env.observe()
        if obs == 'cup_on_tray': break
        if obs == 'closed_drawers':
            action = 'open_right' if 'left_empty' in memory else 'open_left'
        elif obs == 'empty':
            if use_memory: memory.add('left_empty')
            action = 'close'
        elif obs == 'cup_visible':
            action = 'grasp_side' if 'top_failed' in memory else 'grasp_top'
        else:
            action = 'place'
        event = env.step(action)
        trace.append(action + ':' + event)
        if use_memory and event == 'slipped': memory.add('top_failed')
    return env.done, trace

for enabled in [False, True]:
    success, trace = run(enabled)
    print('memory=', enabled, 'success=', success)
    print(' -> '.join(trace))

