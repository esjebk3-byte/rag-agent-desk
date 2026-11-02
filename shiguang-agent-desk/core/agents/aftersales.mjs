import { getOwnedOrder } from './order.mjs';
import { INTENTS } from '../catalog.mjs';

const QUALITY = /质量|破损|坏了|瑕疵|无法开机|开不了机|有问题|漏水|裂了|掉色|故障/;
const WRITE_INTENTS = new Set(['return', 'refund', 'cancel_order']);
export { WRITE_INTENTS };

function policyEligibility(order, task, now) {
  if (task.intent === 'cancel_order') return ['created', 'paid'].includes(order.status) ? null : '这笔订单已经发货或结束，不能直接取消。可以查询物流，签收后按规则申请退货，或创建人工协助演示工单。';
  if (order.status === 'cancelled') return '这笔订单已取消，不能重复提交售后申请。';
  if (task.intent === 'refund') return order.status === 'paid' ? null : '当前退款入口仅支持已付款未发货订单。已签收商品请申请退货；运输中的订单可联系人工协助。';
  if (order.status !== 'delivered') return '退货申请需要商品已签收。当前订单尚未签收，可以先查询物流，或创建人工协助演示工单。';
  const days = Math.floor((now - Date.parse(order.deliveredAt)) / 86400000);
  const quality = QUALITY.test(task.reason || '');
  if (order.customized && !quality) return '这是一件定制商品，不适用无理由退货。如果存在质量问题，请说明具体情况；其他情况可申请人工复核。';
  if (!quality && days > 7) return '这笔订单已超过演示规则中的7天无理由退货时效。如果存在质量问题，请补充具体情况，或者申请人工复核。';
  if (quality && days > 15) return '这笔订单已超过演示规则中的15日质量退货申请时效，可以咨询保修或申请人工复核。';
  return null;
}

export function aftersalesAgent(state, conversation, slots, now = Date.now()) {
  const previous = conversation.task;
  const same = previous?.intent === slots.intent && previous.status !== 'completed';
  const task = same ? { ...previous } : { intent: slots.intent, orderId: null, reason: null, status: 'collecting', updatedAt: now };
  const changedOrder = slots.orderId && task.orderId && slots.orderId !== task.orderId;
  if (changedOrder) task.reason = null;
  if (slots.orderId) task.orderId = slots.orderId;
  if (slots.reason) task.reason = slots.reason;
  task.updatedAt = now;
  conversation.task = task;
  conversation.pending = null; // Any edit invalidates the old proposal.
  if (!task.orderId) {
    task.status = 'collecting_order';
    return { answer: `可以，我来协助你${INTENTS[task.intent]}。请先提供订单号，或从下方选择一笔订单。${task.reason ? '\n退货原因已经记下，无需重复填写。' : ''}`, needs: 'order', tool: 'collect_order_id' };
  }
  const found = getOwnedOrder(state, task.orderId);
  if (!found.ok) { task.status = 'collecting_order'; task.orderId = null; return { answer: found.error, needs: 'order', tool: 'check_order_ownership' }; }
  if (task.intent !== 'cancel_order' && !task.reason) {
    task.status = 'collecting_reason';
    return { answer: `已找到订单 ${found.order.id}「${found.product.name}」。\n${changedOrder ? '订单已切换，请重新说明这件商品的问题。' : '请简单描述申请原因，例如商品破损、质量故障或不合适。'}${found.order.customized ? '\n这是一件定制商品，我会结合原因核对适用规则。' : ''}`, needs: 'reason', tool: 'collect_reason' };
  }
  const issue = policyEligibility(found.order, task, now);
  if (issue) {
    task.status = 'needs_review';
    return { answer: issue, citations: [{ id: task.intent === 'cancel_order' ? 'cancel' : 'returns', title: task.intent === 'cancel_order' ? '订单取消规则' : '退货与换货规则', version: '2026.10-v1' }], tool: 'eligibility_check', needs: 'review' };
  }
  const duplicate = state.applications.find(a => a.orderId === task.orderId && a.kind === task.intent && a.status === 'requested');
  if (duplicate) {
    task.status = 'completed';
    return { answer: `订单 ${task.orderId} 已有待审核的${INTENTS[task.intent]}，申请编号 ${duplicate.id}，无需重复提交。`, tool: 'deduplicate_application' };
  }
  const pending = {
    id: crypto.randomUUID(), kind: task.intent, orderId: task.orderId, reason: task.reason,
    orderRevision: found.order.revision, createdAt: now, expiresAt: now + 15 * 60000,
    summary: `${INTENTS[task.intent]} · ${found.product.short}`,
    impact: task.intent === 'cancel_order' ? '确认后订单将变为已取消；演示不涉及真实支付退款。' : '确认后仅提交演示申请，等待后续审核；不代表退款到账。',
  };
  conversation.pending = pending;
  task.status = 'awaiting_confirmation';
  return { answer: `信息已核对，请确认下方操作内容。${QUALITY.test(task.reason || '') ? '\n质量问题凭证需要在后续人工审核环节补充，本演示暂不支持上传。' : ''}\n你确认前，我不会提交或更改订单。`, pending, tool: 'propose_action' };
}

export function confirmAction(state, conversation, actionId, now = Date.now()) {
  const receipt = state.actionReceipts?.[actionId];
  if (receipt?.conversationId === conversation.id) return { answer: receipt.answer, tool: 'idempotency_replay' };
  const pending = conversation.pending;
  if (!pending || pending.id !== actionId) return { answer: '这项操作已撤销或不存在，请重新发起申请。', tool: 'reject_invalid_confirmation' };
  if (pending.expiresAt <= now) {
    conversation.pending = null;
    if (conversation.task) conversation.task.status = 'expired';
    return { answer: '确认已超过15分钟有效期。没有执行操作，请重新发起并核对订单。', tool: 'reject_expired_confirmation' };
  }
  const found = getOwnedOrder(state, pending.orderId);
  if (!found.ok || found.order.revision !== pending.orderRevision) {
    conversation.pending = null;
    if (conversation.task) conversation.task.status = 'needs_review';
    return { answer: '订单状态已经变化，原确认已失效。请重新发起操作，我会核对最新状态。', tool: 'reject_stale_confirmation' };
  }
  const issue = policyEligibility(found.order, { intent: pending.kind, reason: pending.reason }, now);
  if (issue) { conversation.pending = null; return { answer: issue, tool: 'recheck_eligibility' }; }
  let answer;
  if (pending.kind === 'cancel_order') {
    found.order.status = 'cancelled';
    found.order.revision++;
    answer = `订单 ${pending.orderId} 已取消。\n演示订单状态已更新；本站不连接真实支付系统。`;
  } else {
    const application = { id: `AS${String(now).slice(-8)}${state.applications.length + 1}`, orderId: pending.orderId, kind: pending.kind, reason: pending.reason, status: 'requested', createdAt: new Date(now).toISOString(), actionId };
    state.applications.unshift(application);
    found.order.revision++;
    answer = `订单 ${pending.orderId} 的${INTENTS[pending.kind]}已提交。\n申请编号：${application.id}\n当前状态：待审核。提交不代表审核通过或退款到账。`;
  }
  conversation.pending = null;
  if (conversation.task) conversation.task.status = 'completed';
  state.actionReceipts ||= {};
  state.actionReceipts[actionId] = { conversationId: conversation.id, answer };
  const keys = Object.keys(state.actionReceipts);
  if (keys.length > 100) delete state.actionReceipts[keys[0]];
  return { answer, tool: pending.kind === 'cancel_order' ? 'cancel_order' : `create_${pending.kind}_request`, executed: true };
}

export function abortAction(conversation) {
  const had = Boolean(conversation.pending || conversation.task);
  conversation.pending = null;
  if (conversation.task) conversation.task.status = 'cancelled';
  return { answer: had ? '已结束当前任务，并撤销待确认操作，没有新增业务变更。你可以继续咨询其他问题。' : '当前没有待处理的申请。你可以继续咨询其他问题。', tool: 'revoke_pending_action' };
}

export function createTicket(state, conversation, message, now = Date.now()) {
  const existing = state.tickets.find(t => t.conversationId === conversation.id && t.status === 'open');
  if (existing) return { answer: `当前已有演示工单 ${existing.id}，无需重复创建。本站未接入真实客服座席。`, tool: 'deduplicate_ticket' };
  const ticket = { id: `TK${String(now).slice(-8)}`, conversationId: conversation.id, orderId: conversation.task?.orderId || null, reason: message, summary: conversation.messages.slice(-6).map(m => m.content.slice(0, 200)).join('\n'), status: 'open', createdAt: new Date(now).toISOString() };
  state.tickets.unshift(ticket);
  conversation.pending = null;
  if (conversation.task) conversation.task.status = 'cancelled';
  return { answer: `已创建人工协助演示工单 ${ticket.id}，并保存本次咨询摘要。\n可在“订单中心 → 人工工单”中查看。本站未接入真实客服座席，当前不会有客服实际接入。`, tool: 'create_handoff_ticket' };
}
