import { addConversation, INTENTS, KNOWLEDGE } from './catalog.mjs';
import { intentAgent } from './agents/intent.mjs';
import { orderAgent, productAgent, getOwnedOrder } from './agents/order.mjs';
import { knowledgeAgent } from './agents/knowledge.mjs';
import { aftersalesAgent, confirmAction, abortAction, createTicket, WRITE_INTENTS } from './agents/aftersales.mjs';
import { qualityAgent } from './agents/quality.mjs';

export async function processCommand(original, command, { model = null, now = Date.now() } = {}) {
  const state = structuredClone(original);
  if (command.type === 'new_conversation') { addConversation(state, now); state.version++; return { state }; }
  if (command.type === 'select_conversation') {
    if (!state.conversations.some(c => c.id === command.id)) throw new Error('会话不存在');
    state.activeId = command.id; state.version++; return { state };
  }
  const conversation = state.conversations.find(c => c.id === state.activeId);
  if (!conversation) throw new Error('会话不存在，请刷新页面');
  const trace = [];
  const started = performance.now();
  async function stage(agent, summary, fn) {
    const begin = performance.now();
    const value = await fn();
    trace.push({ agent, summary: typeof summary === 'function' ? summary(value) : summary, durationMs: Math.round((performance.now() - begin) * 10) / 10, tool: value.tool || null, source: (agent === 'quality' ? value.quality?.source : value.source) || (model ? '服务端执行' : '规则执行'), usage: (agent === 'quality' ? value.judgeUsage : value.usage) || null });
    return value;
  }
  const message = String(command.message || '').trim().slice(0, 2000);
  const isConfirm = command.type === 'confirm';
  const isAbort = command.type === 'abort';
  if (!message && !isConfirm && !isAbort) throw new Error('请输入咨询内容');
  const display = isConfirm ? '确认执行这项操作' : isAbort ? '取消当前操作' : message;
  conversation.messages.push({ id: crypto.randomUUID(), role: 'user', content: display, createdAt: new Date(now).toISOString() });
  if (conversation.title === '新的咨询') conversation.title = display.slice(0, 18);
  let result, intent;
  if (isConfirm || (/^(确认|确认提交|确认取消|确认退款|确认退货|确认执行)[。！!]?$/).test(message) && conversation.pending) {
    intent = conversation.pending?.kind || conversation.task?.intent || 'return';
    await stage('supervisor', '接收到明确确认，恢复绑定的操作上下文。', () => ({}));
    result = await stage('aftersales', v => v.executed ? '重新核对归属和状态后，完成业务写入。' : '检查确认有效性与幂等结果。', () => confirmAction(state, conversation, command.actionId || conversation.pending?.id, now));
  } else {
    const slots = await stage('supervisor', v => `识别为「${INTENTS[v.intent]}」${conversation.task && WRITE_INTENTS.has(v.intent) ? '，接续任务并补全信息。' : '，分配对应处理路径。'}`, () => isAbort ? { intent: 'abort', source: '用户撤销' } : intentAgent(message, conversation, model));
    intent = slots.intent;
    // Explicit task switching revokes the previous pending write.
    if (conversation.pending && !WRITE_INTENTS.has(intent)) { conversation.pending = null; if (conversation.task) conversation.task.status = 'paused'; }
    if (WRITE_INTENTS.has(intent)) {
      if (slots.orderId || conversation.task?.orderId) {
        const id = slots.orderId || conversation.task.orderId;
        await stage('order', '核对订单归属、商品类型与当前业务状态。', () => ({ ...getOwnedOrder(state, id), tool: 'get_order' }));
      }
      result = await stage('aftersales', v => v.pending ? '信息与规则已核对，等待用户确认；尚未写入。' : v.needs === 'reason' ? '保留当前订单，追问缺失原因。' : v.needs === 'order' ? '保留申请意图，追问订单信息。' : '核对适用条件与重复申请。', () => aftersalesAgent(state, conversation, slots, now));
    } else if (intent === 'abort') result = await stage('aftersales', '撤销待确认动作，结束当前任务。', () => abortAction(conversation));
    else if (intent === 'handoff') result = await stage('aftersales', '保存咨询摘要，创建可查看的演示工单。', () => createTicket(state, conversation, message, now));
    else if (['order', 'logistics', 'aftersales_status'].includes(intent)) {
      const orderId = slots.orderId || conversation.task?.orderId;
      if (!orderId) {
        conversation.task = { intent, orderId: null, reason: null, status: 'collecting_order', updatedAt: now };
        result = { answer: '请提供要查询的订单号，或从下方选择一笔订单。', needs: 'order' };
      } else {
        result = await stage('order', '通过订单工具读取当前买家的业务数据。', () => orderAgent(state, orderId, intent, now));
        if (!result.ok) result.answer = result.error;
        conversation.task = { intent, orderId: result.ok ? orderId : null, reason: null, status: result.ok ? 'completed' : 'collecting_order', updatedAt: now };
      }
    } else if (intent === 'policy') {
      const found = slots.orderId ? getOwnedOrder(state, slots.orderId) : null;
      result = await stage('knowledge', v => `检索${v.citations.length}份政策，${v.strategy === 'multi' ? '合并例外条件' : '定位适用条款'}。`, () => knowledgeAgent(message, { model, order: found?.ok ? found.order : null }));
    } else if (intent === 'product') result = await stage('order', '读取商品目录中的价格、库存与规格。', () => productAgent(message));
    else if (intent === 'greeting') result = { answer: /谢谢|感谢/.test(message) ? '不客气。需要查询订单、了解商品政策或申请售后，随时告诉我。' : '你好，我是拾光客服。可以帮你查订单和物流、核对退换规则、提交售后演示申请。\n你可以分几次告诉我信息，我会记住当前任务。' };
    else result = { answer: '我专注于商品、订单、物流和售后服务，无法处理这个请求。请告诉我购物相关的问题；其他买家的订单和系统信息不会提供。', refused: true };
  }
  result = await stage('quality', v => v.quality.note, () => qualityAgent(result, { model, before: original, after: state, conversationId: conversation.id }));
  const used = trace.reduce((sum, t) => sum + Number(t.usage?.total_tokens || 0), 0);
  const response = {
    id: crypto.randomUUID(), role: 'assistant', content: result.answer, createdAt: new Date(now).toISOString(),
    intent, strategy: WRITE_INTENTS.has(intent) || ['order', 'logistics', 'aftersales_status', 'handoff', 'product'].includes(intent) ? 'agent' : result.strategy || (intent === 'refuse' ? 'refuse' : 'direct'),
    citations: result.citations || [], trace, task: structuredClone(conversation.task), pending: structuredClone(conversation.pending),
    needs: result.needs || null, refused: result.refused || false,
    metrics: { durationMs: Math.round(performance.now() - started), tokens: used, model: model ? 'server-model' : 'deterministic-demo' },
  };
  conversation.messages.push(response);
  conversation.messages = conversation.messages.slice(-100);
  state.version++;
  return { state, response };
}

export function sourceById(id) { return KNOWLEDGE.find(d => d.id === id); }
