import math
# <user>, 1+1?, <assistant>, 2, <eos>
# 4 个预测位置的真实目标概率
p_true = [0.8, 0.7, 0.6, 0.9]
assistant_mask = [0, 0, 1, 1]  # 只监督 2 与 eos
loss = -sum(m * math.log(p) for p, m in zip(p_true, assistant_mask)) / sum(assistant_mask)
print("assistant-only loss:", round(loss, 6))
d, rank, layers, projections = 4096, 16, 32, 2
full, adapter = d*d, rank*(d+d)
print("one matrix:", full, "LoRA:", adapter)
print("trainable fraction:", f"{adapter/full:.5%}")
print("all adapters:", adapter*layers*projections)
# 所有 logp 都是回答 token 的对数概率之和
policy_chosen, policy_rejected = -2.0, -4.0
ref_chosen, ref_rejected = -2.5, -3.5
beta = 0.1
margin = beta*((policy_chosen-policy_rejected)-(ref_chosen-ref_rejected))
dpo = math.log1p(math.exp(-margin))
print("DPO margin:", round(margin, 6), "loss:", round(dpo, 6))

