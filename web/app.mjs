import { AGENTS, INTENTS, KNOWLEDGE, PRODUCTS, STATUS } from '../core/catalog.mjs';
import { runEvaluation, EVAL_CASES } from '../core/evaluation.mjs';
import { icon, brand } from './icons.mjs';
import { createTransport, setAccessCode } from './transport.mjs';

const app = document.querySelector('#app');
const modal = document.querySelector('#modal');
const e = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const dt = value => new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
const time = value => new Date(value).toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false });
const product = sku => PRODUCTS.find(p => p.sku === sku);
const navs = [ ['chat', 'chat', '服务工作台'], ['orders', 'box', '订单中心'], ['knowledge', 'book', '知识库'], ['evaluation', 'chart', '评测中心'], ['architecture', 'network', '协作架构'] ];
let state, transport, busy = false, draft = '', view = location.hash.slice(1) || 'chat';
let orderTab = 'orders', knowledgeQuery = '', knowledgeCategory = '全部', evalBusy = false, evalReport = null, evalProgress = [];
const active = () => state.conversations.find(c => c.id === state.activeId);
const lastResponse = () => [...(active()?.messages || [])].reverse().find(m => m.role === 'assistant');
const btn = (action, label, cls = 'button', extra = '') => `<button type="button" class="${cls}" data-action="${action}" ${extra}>${label}</button>`;
function notice(message) { const toast = document.querySelector('#toast'); toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 3500); }
function download(name, data, type = 'application/json') { const url = URL.createObjectURL(new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function showModal(content) { modal.innerHTML = `<div class="modal-top">${brand()}${btn('close-modal', icon('close'), 'icon-button', 'aria-label="关闭详情"')}</div>${content}`; if (!modal.open) modal.showModal(); }

function sidebar() {
  return `<aside class="sidebar"><a href="#chat" class="brand">${brand()}<span>拾光客服<small>AGENT DESK</small></span></a>
  <div class="workspace-select"><span class="workspace-icon">拾</span><span>电商服务空间<small>个人项目 · 演示环境</small></span>${icon('down')}</div>
  <nav aria-label="主导航">${navs.map(([id, ico, title]) => `<a href="#${id}" class="nav-item ${view === id ? 'active' : ''}">${icon(ico)}<span>${title}</span>${id === 'chat' ? '<span class="nav-live"></span>' : ''}</a>`).join('')}</nav>
  <div class="conversation-heading"><span>最近会话</span>${btn('new', icon('plus'), 'icon-button tiny', 'aria-label="新建会话"')}</div>
  <div class="conversation-list">${state.conversations.slice(0, 7).map(c => btn('select', `${icon('chat')}<span>${e(c.title)}</span>`, `conversation-link ${c.id === state.activeId && view === 'chat' ? 'selected' : ''}`, `data-id="${e(c.id)}"`)).join('')}</div>
  <div class="sidebar-bottom"><div class="mode-card"><span class="mode-dot"></span><strong>${transport.config.mode === 'model' ? '模型模式已启用' : '规则演示已就绪'}</strong><p>${transport.config.runtime === 'server' ? '服务端保存 · SQLite 持久化' : '浏览器本地保存 · 无需密钥'}</p></div>
  ${btn('settings', `${icon('settings')}<span>工作台设置</span>`, 'sidebar-setting')}
  <div class="profile"><span class="avatar profile-avatar">林</span><span>演示买家<small>我的服务空间</small></span><span class="profile-status">在线</span></div></div></aside>`;
}

function header() {
  return `<header class="topbar"><div class="breadcrumb">${btn('menu', icon('menu'), 'icon-button mobile-menu', 'aria-label="打开导航"')}<span>工作空间</span>${icon('chevron')}<strong>${navs.find(n => n[0] === view)?.[2] || '服务工作台'}</strong></div><div class="header-actions">${btn('settings', `<span class="status-dot"></span>${transport.config.mode === 'model' ? e(transport.config.model) : '演示模式'}${icon('down')}`, 'mode-badge')}<span class="header-divider"></span><span class="avatar header-avatar">林</span></div></header>`;
}

function sourceButton(citation) { return btn('source', `${icon('book')}<span>${e(citation.title)}</span>${icon('external')}`, 'citation', `data-id="${e(citation.id)}"`); }

function actionCard(message) {
  const pending = message.pending;
  const current = active().pending;
  if (!pending || current?.id !== pending.id) return '';
  const order = state.orders.find(o => o.id === pending.orderId);
  return `<section class="confirmation-card" aria-label="操作确认"><div class="confirmation-title">${icon('shield')}<strong>请确认这项操作</strong><span>等待你的授权</span></div><div class="confirmation-content"><span class="product-thumb ${product(order?.sku)?.icon || ''}" style="--product-bg:${product(order?.sku)?.color || '#eee'}">${icon(product(order?.sku)?.icon || 'box')}</span><div><strong>${e(pending.summary)}</strong><p>${e(pending.orderId)}${pending.reason ? ` · ${e(pending.reason)}` : ''}</p></div></div><p class="confirmation-note">${e(pending.impact)}</p><div class="confirmation-footer"><small>${icon('clock')}15分钟内有效</small><div>${btn('abort', '取消操作', 'button quiet', busy ? 'disabled' : '')}${btn('confirm', `确认${e(INTENTS[pending.kind])}${icon('arrow')}`, 'button primary', `data-id="${e(pending.id)}" ${busy ? 'disabled' : ''}`)}</div></div></section>`;
}

function messageRow(message) {
  if (message.role === 'user') return `<div class="message-row user-row"><div class="user-bubble">${e(message.content).replace(/\n/g, '<br>')}</div><span class="avatar user-avatar">林</span></div>`;
  return `<article class="message-row assistant-row"><span class="assistant-avatar">${brand()}</span><div class="assistant-content"><div class="message-heading"><strong>拾光客服</strong><span>${time(message.createdAt)}</span><span class="route-label">${e(({ direct: '直接答复', single: '知识检索', multi: '条件核对', agent: '协作处理', refuse: '边界提示' })[message.strategy] || '协作处理')}</span></div><div class="message-text">${message.content.split('\n').filter(Boolean).map(line => `<p>${e(line)}</p>`).join('')}</div>${message.citations?.length ? `<div class="citations">${message.citations.map(sourceButton).join('')}</div>` : ''}${actionCard(message)}<div class="response-footnote">${icon('check')}<span>${message.trace?.length || 0} 个协作步骤 · ${message.metrics?.model === 'server-model' ? '服务端模型路径' : '规则演示路径'}</span>${btn('copy', icon('copy'), 'icon-button tiny', `data-id="${e(message.id)}" aria-label="复制答复"`)}</div></div></article>`;
}

function welcome() {
  return `<section class="welcome"><div class="welcome-orbit"><span>${icon('spark')}</span><i></i><b></b></div><span class="eyebrow">YOUR EVERYDAY SERVICE COMPANION</span><h2>你好，很高兴为你服务<span>。</span></h2><p>从了解一条规则，到完成一项售后。<br>把问题交给我，我们一步一步处理。</p><div class="suggestions">${[
    ['box', '包裹到哪里了？', '查询订单和物流进度', '帮我查一下订单SG10001的物流'],
    ['book', '定制商品能退吗？', '核对适用条件与政策', '定制马克杯签收12天有质量问题能退吗？'],
    ['refresh', '我想申请退货', '补充信息，确认后提交', '我要退货'],
    ['headphones', '了解一下声屿 Pro', '查看商品信息与库存', '介绍一下耳机和库存'],
  ].map(([ico, title, text, prompt]) => btn('prompt', `<span class="suggestion-icon">${icon(ico)}</span><strong>${title}</strong><small>${text}</small><span class="suggestion-arrow">${icon('arrow')}</span>`, 'suggestion', `data-prompt="${e(prompt)}"`)).join('')}</div><div class="welcome-proof"><span>${icon('shield')}操作前确认</span><span>${icon('link')}回答有依据</span><span>${icon('chat')}记住当前任务</span></div></section>`;
}

function composer() {
  const needs = lastResponse()?.needs;
  const quick = needs === 'order' ? state.orders.filter(o => o.status !== 'cancelled').map(o => btn('prompt', `${e(o.id)} · ${e(product(o.sku).short)}`, 'quick-chip', `data-prompt="${e(o.id)}"`)).join('') : needs === 'reason' ? ['商品破损，有质量问题', '尺寸不合适', '买错了'].map(p => btn('prompt', p, 'quick-chip', `data-prompt="${e(p)}"`)).join('') : '';
  return `<div class="composer-area">${quick ? `<div class="quick-options"><span>${needs === 'order' ? '选择订单' : '补充原因'}</span>${quick}</div>` : ''}<form id="chat-form" class="composer ${busy ? 'busy' : ''}"><label for="message-input" class="sr-only">输入咨询内容</label><textarea id="message-input" placeholder="说说你需要什么帮助，也可以分几次告诉我…" rows="2" maxlength="2000" ${busy ? 'disabled' : ''}>${e(draft)}</textarea><div class="composer-toolbar"><span>${icon('shield')}每次写入，都由你确认</span><div><kbd>Enter</kbd><span class="send-hint">发送</span><button type="submit" class="send-button" aria-label="发送消息" ${busy ? 'disabled' : ''}>${busy ? '<span class="spinner"></span>' : icon('arrow')}</button></div></div></form><p class="composer-disclaimer">本站使用演示商品与订单，申请不涉及真实资金。<span>拾光 · 让服务有始有终</span></p></div>`;
}

function agentPanel() {
  const response = lastResponse();
  const trace = response?.trace || [];
  const task = active().task;
  return `<aside class="inspector"><div class="inspector-heading"><span>${icon('network')}协作现场</span><span class="live-label"><i></i>${busy ? '处理中' : trace.length ? '已完成本轮' : '准备就绪'}</span></div><p class="inspector-intro">每个角色各司其职，让处理有迹可循。</p><div class="agent-stack">${AGENTS.map((agent, index) => {
    const event = trace.find(t => t.agent === agent.id);
    return `<div class="agent-step ${event ? 'used' : ''}"><div class="agent-node" style="--agent-color:${agent.color}">${icon(agent.icon)}</div><div class="agent-info"><strong>${agent.name}<span>${agent.en}</span></strong><p>${event ? e(event.summary) : agent.role}</p>${event ? `<small>${e(event.source)}${event.durationMs > 0 ? ` · ${event.durationMs} ms` : ' · <1 ms'}</small>` : ''}</div><span class="agent-result">${event ? icon('check') : '<i></i>'}</span></div>`;
  }).join('')}</div>
  <div class="memory-box"><div class="section-label">${icon('chat')}当前任务记忆<span>${task && task.status !== 'completed' && task.status !== 'cancelled' ? '保留中' : '就绪'}</span></div><dl><div><dt>服务意图</dt><dd>${task ? e(INTENTS[task.intent]) : '等待你的提问'}</dd></div><div><dt>关联订单</dt><dd>${e(task?.orderId || '尚未提供')}</dd></div><div><dt>申请原因</dt><dd>${e(task?.reason || '尚未提供')}</dd></div><div><dt>任务状态</dt><dd><span class="task-status">${e(({ collecting_order: '等待订单号', collecting_reason: '等待原因', awaiting_confirmation: '等待确认', completed: '处理完成', cancelled: '已结束', needs_review: '需核对条件', expired: '确认已过期', paused: '已暂停' })[task?.status] || '待开始')}</span></dd></div></dl></div>
  <div class="inspector-note">${icon('info')}<p>这里展示实际路由、工具和状态摘要。${transport.config.mode === 'model' ? '模型输出会经过独立核验。' : '当前由确定性规则执行，不冒充大模型推理。'}</p></div>${trace.length ? btn('trace', `查看本轮处理记录${icon('arrow')}`, 'text-button trace-link') : ''}</aside>`;
}

function chatView() {
  const messages = active().messages;
  return `<div class="chat-layout"><section class="chat-column"><div class="chat-title"><div><span class="eyebrow">SERVICE WORKSPACE</span><h1>每一次咨询，都有下文<span>✳</span></h1><p>多角色协作 · 有依据的回答 · 由你确认的操作</p></div>${btn('new', `${icon('plus')}新的咨询`, 'button outline', busy ? 'disabled' : '')}</div><div class="chat-surface"><div class="chat-surface-heading"><span class="surface-title"><i></i>${messages.length ? e(active().title) : '开始一次对话'}</span><div><span>演示买家</span>${btn('export', icon('download'), 'icon-button', 'aria-label="导出会话"')}</div></div><div class="messages" id="messages" aria-live="polite">${messages.length ? `<div class="date-divider"><span>今日服务记录</span></div>${messages.map(messageRow).join('')}` : welcome()}${busy ? `<div class="message-row assistant-row"><span class="assistant-avatar">${brand()}</span><div class="thinking"><span class="spinner"></span>正在核对信息并处理你的请求…</div></div>` : ''}</div>${composer()}</div><div class="chat-bottom-strip"><span>${icon('leaf')}5 个协作角色，一段连贯的服务</span><span>需要试试？<button data-action="prompt" data-prompt="取消订单SG10003">取消一笔待发货订单 ${icon('arrow')}</button></span></div></section>${agentPanel()}</div>`;
}

function pageHead(kicker, title, text, action = '') { return `<div class="page-heading"><div><span class="eyebrow">${kicker}</span><h1>${title}</h1><p>${text}</p></div>${action}</div>`; }

function orderView() {
  const tabs = [['orders', '我的订单', state.orders.length], ['applications', '售后申请', state.applications.length], ['tickets', '人工工单', state.tickets.length]];
  return `<div class="page-scroll">${pageHead('ORDER CENTER', '每笔订单，进展清晰。', '查询商品、物流与售后状态，所有操作都会与你确认。', `<span class="badge soft">演示买家 · 3 笔初始订单</span>`)}<div class="summary-grid"><div><span>我的订单</span><strong>${state.orders.length}<small>笔</small></strong>${icon('box')}</div><div><span>待发货</span><strong>${state.orders.filter(o => o.status === 'paid').length}<small>笔</small></strong>${icon('clock')}</div><div><span>售后申请</span><strong>${state.applications.length}<small>笔</small></strong>${icon('refresh')}</div></div><div class="content-tabs">${tabs.map(([id, text, count]) => btn('order-tab', `${text}<span>${count}</span>`, orderTab === id ? 'active' : '', `data-id="${id}"`)).join('')}</div>
  ${orderTab === 'orders' ? `<div class="order-grid">${state.orders.map(o => { const p = product(o.sku); return `<article class="order-card"><div class="order-card-top"><span>${e(o.id)}</span><span class="order-status ${e(o.status)}"><i></i>${e(STATUS[o.status])}</span></div><div class="order-product"><div class="product-illustration" style="--product-bg:${p.color}">${icon(p.icon)}</div><div><small>${e(p.category)} · 演示商品</small><h3>${e(p.name)}</h3><p>${e(p.desc)}</p><strong>¥${o.total.toFixed(2)}<span>× ${o.quantity}</span></strong></div></div><div class="order-meta"><span>${icon('clock')}${dt(o.createdAt)}</span><span>收货城市 ${e(o.city)}</span></div><div class="order-card-footer">${btn('order-detail', '订单详情', 'text-button', `data-id="${e(o.id)}"`)}${btn('prompt', `${o.status === 'shipped' ? '查看物流' : o.status === 'delivered' ? '申请售后' : o.status === 'paid' ? '取消订单' : '查看状态'}${icon('arrow')}`, 'button outline', `data-prompt="${e(o.status === 'shipped' ? `查一下${o.id}的物流` : o.status === 'delivered' ? `我要退货，订单${o.id}` : o.status === 'paid' ? `取消订单${o.id}` : `查询订单${o.id}`)}"`)}</div></article>`; }).join('')}</div>` : orderTab === 'applications' ? applicationList() : ticketList()}
  <p class="page-footnote">${icon('info')}所有商品、订单与物流均为演示数据。售后申请不会触发真实退款。</p></div>`;
}

function applicationList() { return state.applications.length ? `<div class="record-list">${state.applications.map(a => `<article class="record-card"><span class="record-icon">${icon('refresh')}</span><div><h3>${e(INTENTS[a.kind])}<span class="badge soft">待审核</span></h3><p>${e(a.id)} · ${e(a.orderId)}</p><p>申请原因：${e(a.reason)}</p><small>${dt(a.createdAt)} · 已提交演示记录，未连接真实审批或支付系统</small></div></article>`).join('')}</div>` : empty('refresh', '还没有售后申请', '在聊天中说明订单与原因，确认后提交的申请会显示在这里。', btn('prompt', '发起一次退货申请', 'button primary', 'data-prompt="我要退货"')); }
function ticketList() { return state.tickets.length ? `<div class="record-list">${state.tickets.map(t => `<article class="record-card"><span class="record-icon">${icon('user')}</span><div><h3>人工协助演示工单<span class="badge soft">已记录</span></h3><p>${e(t.id)}${t.orderId ? ` · ${e(t.orderId)}` : ''}</p><p>${e(t.reason)}</p><small>${dt(t.createdAt)} · 咨询摘要已保存，未连接真实客服座席</small><details><summary>查看咨询摘要</summary><p class="ticket-summary">${e(t.summary).replace(/\n/g, '<br>')}</p></details></div></article>`).join('')}</div>` : empty('user', '暂时没有人工协助工单', '需要人工复核时，可以在聊天里告诉我；演示工单会保留咨询摘要。', btn('prompt', '创建演示工单', 'button primary', 'data-prompt="我需要人工协助"')); }
function empty(ico, title, text, action = '') { return `<div class="empty-state"><span>${icon(ico)}</span><h3>${title}</h3><p>${text}</p>${action}</div>`; }

function knowledgeView() {
  const categories = ['全部', ...new Set(KNOWLEDGE.map(d => d.category))];
  const docs = KNOWLEDGE.filter(d => (knowledgeCategory === '全部' || d.category === knowledgeCategory) && (d.title + d.tags.join('') + d.sections.map(s => s.text).join('')).includes(knowledgeQuery));
  return `<div class="page-scroll">${pageHead('KNOWLEDGE BASE', '每一条回答，都有出处。', '查看演示政策原文、适用条件和版本，理解答案背后的依据。', `<span class="badge soft">${KNOWLEDGE.length} 份政策文档</span>`)}<div class="knowledge-toolbar"><div class="search-field">${icon('search')}<input id="knowledge-search" type="search" aria-label="搜索知识库" placeholder="搜索政策、商品或关键词…" value="${e(knowledgeQuery)}" /></div><span>最新维护 2026.10.29</span></div><div class="filter-chips">${categories.map(c => btn('category', c, knowledgeCategory === c ? 'active' : '', `data-id="${e(c)}"`)).join('')}</div><div id="knowledge-results" class="knowledge-grid">${docs.length ? docs.map(d => `<button class="knowledge-card" data-action="source" data-id="${e(d.id)}"><div><span class="knowledge-icon">${icon('book')}</span><span>${e(d.category)}</span>${icon('external')}</div><h3>${e(d.title)}</h3><p>${e(d.sections[0].text)}</p><footer><span>${e(d.version)}</span><span>${d.sections.length} 个条款 ${icon('arrow')}</span></footer></button>`).join('') : empty('search', '没有匹配的政策', '可以换个关键词，或选择其他分类。')}</div><p class="page-footnote">${icon('info')}这些内容是项目演示规则，不代表真实商家的服务承诺。</p></div>`;
}

function evaluationView() {
  const rows = evalBusy ? evalProgress : evalReport?.results || [];
  const passed = rows.filter(r => r.passed).length;
  return `<div class="page-scroll">${pageHead('QUALITY LAB', '可靠的服务，经得起检查。', '运行预设模拟任务，直接核验多轮续接、业务状态与确认边界。', btn('run-evaluation', `${evalBusy ? '<span class="spinner"></span>' : icon('play')}${evalBusy ? '正在检查…' : '运行回归检查'}`, 'button primary', evalBusy ? 'disabled' : ''))}<section class="evaluation-banner"><div class="evaluation-orb">${icon('shield')}</div><div><span class="eyebrow">DETERMINISTIC REGRESSION</span><h2>从“回复了”，检查到“做对了”。</h2><p>每一组任务使用独立演示数据，运行不会改变你的工作台记录。</p></div><div class="eval-score"><strong>${rows.length ? `${passed}/${rows.length}` : '—'}</strong><span>${rows.length ? '本轮检查通过' : '等待首次运行'}</span></div></section><div class="eval-metrics"><div><span>预设任务组</span><strong>${EVAL_CASES.length}<small>组模拟会话</small></strong></div><div><span>执行方式</span><strong>规则引擎<small>不调用外部模型</small></strong></div><div><span>检查依据</span><strong>任务与状态<small>不是关键词命中</small></strong></div></div><div class="section-row"><h2>检查清单 <span>${evalBusy ? `已完成 ${rows.length}/${EVAL_CASES.length}` : '可复查的逐项结果'}</span></h2>${evalReport && !evalBusy ? btn('export-evaluation', `${icon('download')}导出结果`, 'button outline') : ''}</div><div class="eval-table"><div class="eval-table-head"><span>任务场景</span><span>检查维度</span><span>状态</span></div>${EVAL_CASES.map((item, i) => { const r = rows[i]; return `<div class="eval-table-row"><div><strong><span>${String(i + 1).padStart(2, '0')}</span>${item.name}</strong><p>${r ? e(r.note) : '运行后显示实际检查结果'}</p></div><span class="eval-category">${item.category}</span><span class="eval-status ${r ? r.passed ? 'pass' : 'fail' : ''}">${r ? `${icon(r.passed ? 'check' : 'close')}${r.passed ? '通过' : '未通过'}` : '待运行'}</span></div>`; }).join('')}</div><p class="page-footnote">${icon('info')}这是12组预设规则回归，不是独立盲测、模型准确率或线上业务效果。${evalReport ? `运行于 ${dt(evalReport.createdAt)}` : ''}</p></div>`;
}

function architectureView() {
  return `<div class="page-scroll">${pageHead('AGENT ORCHESTRATION', '分工明确，服务连贯。', '共享任务状态，将理解、查证、执行与核验组织成一条可追踪的流程。')}<section class="architecture-intro"><span class="architecture-graphic">${icon('network')}</span><div><h2>一个入口，五个协作角色。</h2><p>调度官根据问题分配任务，专家使用各自的工具与证据；业务写入始终经过用户确认。</p><span class="badge soft">当前：${transport.config.mode === 'model' ? '模型辅助理解与独立质检' : '确定性规则演示执行器'}</span></div></section><div class="architecture-agents">${AGENTS.map((a, i) => `<article><span style="--agent-color:${a.color}" class="agent-node">${icon(a.icon)}</span><small>0${i + 1} / ${a.en.toUpperCase()}</small><h3>${a.name}</h3><p>${a.role}</p><ul>${({ supervisor: ['读取当前任务与近轮对话', '区分政策咨询与操作意愿', '分配到知识或工具路径'], knowledge: ['词面检索与业务标签融合', '保留时效与例外条件', '返回可打开的政策来源'], order: ['核对买家与订单归属', '读取物流、商品和状态', '返回结构化业务事实'], aftersales: ['追问缺失字段并保留任务', '检查条件与用户确认', '执行、撤销与防重复提交'], quality: ['核对工具与执行状态', '模型路径做独立证据检查', '失败时降级为政策原文'] })[a.id].map(t => `<li>${t}</li>`).join('')}</ul></article>`).join('')}</div><section class="flow-explanation"><h2>以退货申请为例</h2><div class="flow-strip">${['表达退货意愿', '补齐订单与原因', '核对适用条件', '用户明确确认', '写入申请并回执'].map((t, i) => `<span><b>${i + 1}</b>${t}</span>${i < 4 ? icon('arrow') : ''}`).join('')}</div><div class="principles"><p>${icon('chat')}保存任务状态，支持分轮补充信息。</p><p>${icon('shield')}确认过期、订单变化或用户撤销，原操作失效。</p><p>${icon('book')}规则问答有原文，执行结果有实际记录。</p></div></section></div>`;
}

function render({ scroll = false } = {}) {
  if (!state) return;
  if (!navs.some(n => n[0] === view)) view = 'chat';
  app.innerHTML = `${sidebar()}<div class="workspace">${header()}<main id="main-content">${view === 'chat' ? chatView() : view === 'orders' ? orderView() : view === 'knowledge' ? knowledgeView() : view === 'evaluation' ? evaluationView() : architectureView()}</main></div><button class="nav-scrim" data-action="menu" aria-label="关闭导航"></button>`;
  if (scroll && view === 'chat' && active().messages.length) requestAnimationFrame(() => { const messages = document.querySelector('#messages'); if (messages) messages.scrollTop = messages.scrollHeight; });
}

async function send(command) {
  if (busy) return;
  busy = true;
  if (command.type === 'message' || command.type === 'confirm' || command.type === 'abort') { view = 'chat'; location.hash = 'chat'; }
  render({ scroll: true });
  try {
    const outcome = await transport.send({ ...command, version: state.version });
    state = outcome.state;
    if (command.type === 'message') draft = '';
    return outcome;
  } catch (error) {
    if (error.state) state = error.state;
    notice(error.message);
    if (error.code === 'ACCESS_REQUIRED') openSettings();
  } finally {
    busy = false; render({ scroll: true });
    if (view === 'chat') document.querySelector('#message-input')?.focus();
  }
}

function openSource(id) {
  const doc = KNOWLEDGE.find(d => d.id === id);
  if (!doc) return notice('没有找到这份政策');
  showModal(`<span class="eyebrow">POLICY SOURCE · ${e(doc.category)}</span><h2>${e(doc.title)}</h2><div class="source-metadata"><span>${e(doc.version)}</span><span>更新 ${e(doc.updatedAt)}</span></div><div class="source-sections">${doc.sections.map(s => `<section><h3>${e(s.title)}</h3><p>${e(s.text)}</p></section>`).join('')}</div><p class="modal-note">本站演示政策 · 回答应保留适用条件与例外</p><div class="modal-actions">${btn('prompt', '就这条政策提问', 'button primary', `data-prompt="${e(doc.tags[0] + '的规则是什么？')}"`)}</div>`);
}

function openOrder(id) {
  const o = state.orders.find(o => o.id === id); if (!o) return;
  const p = product(o.sku);
  showModal(`<span class="eyebrow">ORDER DETAILS</span><h2>${e(o.id)}</h2><div class="order-product modal-product"><div class="product-illustration" style="--product-bg:${p.color}">${icon(p.icon)}</div><div><small>${e(STATUS[o.status])}</small><h3>${e(p.name)}</h3><strong>¥${o.total.toFixed(2)}</strong></div></div><dl class="detail-list"><div><dt>下单时间</dt><dd>${dt(o.createdAt)}</dd></div><div><dt>收货城市</dt><dd>${e(o.city)}</dd></div><div><dt>商品类型</dt><dd>${o.customized ? '定制商品' : '普通商品'}</dd></div>${o.deliveredAt ? `<div><dt>签收时间</dt><dd>${dt(o.deliveredAt)}</dd></div>` : ''}${o.tracking ? `<div><dt>演示物流单号</dt><dd>${e(o.tracking)}</dd></div>` : ''}</dl><div class="modal-actions">${btn('prompt', '查询物流', 'button outline', `data-prompt="查询${e(o.id)}的物流"`)}${btn('prompt', '申请售后', 'button primary', `data-prompt="我要退货，订单${e(o.id)}"`)}</div>`);
}

function openSettings() {
  showModal(`<span class="eyebrow">WORKSPACE SETTINGS</span><h2>让服务按你的方式运行。</h2><div class="settings-description"><span>${icon('network')}</span><div><strong>${transport.config.mode === 'model' ? `已启用 ${e(transport.config.model)}` : '当前为规则演示模式'}</strong><p>${transport.config.runtime === 'server' ? '会话、订单和工单保存在本机 SQLite，刷新与重启后仍可读取。' : '会话与演示记录保存在当前浏览器，适合 GitHub Pages 展示；不会跨设备同步。'}</p></div></div><div class="settings-section"><h3>真实模型接入</h3><p>在项目服务端的 .env 中配置模型地址、名称和密钥后重启。API Key 不会写入浏览器或 GitHub Pages；详细步骤见源码 README。</p>${transport.config.accessRequired ? `<label for="model-access">模型访问口令</label><div class="access-input"><input id="model-access" type="password" autocomplete="off" placeholder="服务端配置的访问口令" />${btn('save-access', '本次使用', 'button primary')}</div><small>仅在当前页面内存中保存，刷新即清除。</small>` : ''}</div><div class="settings-section"><h3>数据与导出</h3><p>导出的文件包含演示会话、申请和处理记录。</p><div class="settings-buttons">${btn('export', `${icon('download')}导出工作台记录`, 'button outline')}${btn('ask-reset', '重置演示数据', 'button danger')}</div></div><p class="modal-note">版本 1.0 · 5 个协作角色 · ${KNOWLEDGE.length} 份演示政策</p>`);
}

document.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  const action = button.dataset.action;
  if (action === 'menu') return document.body.classList.toggle('nav-open');
  if (action === 'close-modal') return modal.close();
  if (action === 'settings') return openSettings();
  if (action === 'source') return openSource(button.dataset.id);
  if (action === 'order-detail') return openOrder(button.dataset.id);
  if (action === 'new') { document.body.classList.remove('nav-open'); location.hash = 'chat'; return send({ type: 'new_conversation' }); }
  if (action === 'select') { location.hash = 'chat'; document.body.classList.remove('nav-open'); return send({ type: 'select_conversation', id: button.dataset.id }); }
  if (action === 'prompt') { modal.close(); draft = button.dataset.prompt; return send({ type: 'message', message: draft }); }
  if (action === 'confirm') return send({ type: 'confirm', actionId: button.dataset.id });
  if (action === 'abort') return send({ type: 'abort' });
  if (action === 'order-tab') { orderTab = button.dataset.id; return render(); }
  if (action === 'category') { knowledgeCategory = button.dataset.id; return render(); }
  if (action === 'export') { download(`shiguang-workspace-${new Date().toISOString().slice(0, 10)}.json`, { exportedAt: new Date().toISOString(), mode: transport.config, scope: '演示数据与实际处理摘要，不代表线上业务成果', workspace: state }); return notice('演示记录已导出'); }
  if (action === 'copy') { const m = active().messages.find(m => m.id === button.dataset.id); try { await navigator.clipboard.writeText(m.content); notice('答复已复制'); } catch { notice('浏览器未允许复制，请手动选择文字。'); } return; }
  if (action === 'trace') { const r = lastResponse(); return showModal(`<span class="eyebrow">EXECUTION RECORD</span><h2>本轮处理记录</h2><p class="trace-request">${e(r.content.slice(0, 100))}</p><div class="trace-details">${r.trace.map(t => `<section><strong>${e(AGENTS.find(a => a.id === t.agent)?.name)}<small>${t.durationMs > 0 ? t.durationMs + ' ms' : '<1 ms'}</small></strong><p>${e(t.summary)}</p><code>${e(t.tool || t.source)}</code></section>`).join('')}</div><p class="modal-note">实际执行摘要，不展示模型内部思维。${r.metrics.tokens ? `本轮已返回用量：${r.metrics.tokens} Tokens。` : '规则演示未调用外部模型。'}</p>`); }
  if (action === 'save-access') { setAccessCode(document.querySelector('#model-access').value); modal.close(); return notice('访问口令已用于当前页面，请重新发送请求。'); }
  if (action === 'ask-reset') return showModal(`<span class="eyebrow">RESET DEMO</span><h2>重新开始演示？</h2><p>将清空当前空间的会话、售后申请和人工工单，并恢复初始演示订单。可以先导出记录。</p><div class="modal-actions">${btn('export', '先导出记录', 'button outline')}${btn('reset', '确认重置', 'button danger')}</div>`);
  if (action === 'reset') { modal.close(); await send({ type: 'reset' }); location.hash = 'chat'; return; }
  if (action === 'run-evaluation' && !evalBusy) {
    evalBusy = true; evalProgress = []; render();
    try { evalReport = await runEvaluation(rows => { evalProgress = rows; render(); }); }
    finally { evalBusy = false; render(); }
    return;
  }
  if (action === 'export-evaluation' && evalReport) return download('shiguang-regression-report.json', evalReport);
});

document.addEventListener('submit', event => { if (event.target.id === 'chat-form') { event.preventDefault(); if (draft.trim()) send({ type: 'message', message: draft.trim() }); } });
document.addEventListener('input', event => {
  if (event.target.id === 'message-input') draft = event.target.value;
  if (event.target.id === 'knowledge-search') {
    knowledgeQuery = event.target.value;
    const pos = event.target.selectionStart;
    render(); const input = document.querySelector('#knowledge-search'); input.focus(); try { input.setSelectionRange(pos, pos); } catch { /* search inputs may not support selection */ }
  }
});
document.addEventListener('keydown', event => { if (event.target.id === 'message-input' && event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); if (draft.trim()) send({ type: 'message', message: draft.trim() }); } });
window.addEventListener('hashchange', () => { view = location.hash.slice(1) || 'chat'; document.body.classList.remove('nav-open'); render({ scroll: true }); });
window.addEventListener('storage', async event => { if (event.key === 'shiguang-workspace-v1' && transport?.config.runtime === 'browser' && !busy) { state = (await transport.load()).state; render(); } });
modal.addEventListener('click', event => { if (event.target === modal) { const rect = modal.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) modal.close(); } });

try { transport = await createTransport(); state = (await transport.load()).state; render({ scroll: true }); }
catch (error) { app.innerHTML = `<main class="boot"><div class="boot-mark">拾</div><h1>工作台暂时无法打开</h1><p>${e(error.message)}</p><p>本地运行请使用 npm start；浏览器演示需允许本地存储。</p><button class="button primary" data-action="reload">重新加载</button></main>`; document.querySelector('[data-action="reload"]')?.addEventListener('click', () => location.reload()); }
