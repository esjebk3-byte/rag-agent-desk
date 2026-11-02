export const AGENTS = [
  { id: 'supervisor', name: '调度官', en: 'Supervisor', role: '识别意图 · 分配任务', color: '#6a71c5', icon: 'network' },
  { id: 'knowledge', name: '知识顾问', en: 'Knowledge', role: '查找政策 · 组织依据', color: '#40917f', icon: 'book' },
  { id: 'order', name: '订单专员', en: 'Order', role: '查询订单 · 追踪物流', color: '#b18a4b', icon: 'box' },
  { id: 'aftersales', name: '售后专员', en: 'Aftersales', role: '补齐信息 · 确认操作', color: '#b76f85', icon: 'refresh' },
  { id: 'quality', name: '质检员', en: 'Quality', role: '检查边界 · 核验结果', color: '#6685a9', icon: 'shield' },
];

export const INTENTS = {
  greeting: '日常交流', policy: '政策咨询', order: '订单查询', logistics: '物流追踪',
  return: '退货申请', refund: '退款申请', cancel_order: '取消订单', aftersales_status: '售后进度', handoff: '人工协助', product: '商品咨询', refuse: '服务边界', abort: '取消当前任务',
};

export const KNOWLEDGE = [
  { id: 'returns', title: '退货与换货规则', category: '退换售后', tags: ['退货', '退换', '七天', '7天', '无理由', '质量', '定制'], version: '2026.10-v1', updatedAt: '2026-10-29', sections: [
    { title: '普通商品', text: '普通商品签收次日起7个自然日内，保持商品完整且不影响二次销售，可申请无理由退货。非质量问题的退货运费由买家承担。' },
    { title: '定制与质量问题', text: '刻字、印字、定做尺寸等定制商品不适用7天无理由。质量问题仍可在签收后15日内提交凭证并申请售后，是否通过由售后审核决定。不能仅因定制或超过7天就否定质量售后通道。' },
    { title: '申请与审核', text: '提交退货申请不代表审核通过，也不代表退款到账。申请需要订单号、原因与用户确认；质量问题凭证由后续人工审核收集，本演示不支持文件上传。' },
  ] },
  { id: 'electronics', title: '数码商品售后细则', category: '退换售后', tags: ['耳机', '手机', '数码', '激活', '拆封', '开机'], version: '2026.10-v1', updatedAt: '2026-10-29', sections: [
    { title: '拆封与激活', text: '已激活或绑定序列号的数码商品不适用无理由退货。质量故障可在签收后15日内提交凭证申请售后。超过质量退货时效可咨询保修。' },
    { title: '配件与核验', text: '申请时请保留原包装、配件和故障描述。系统可以提交申请，但不能代替业务人员判定质量问题。' },
  ] },
  { id: 'shipping', title: '配送与物流说明', category: '订单物流', tags: ['物流', '配送', '包邮', '运费', '发货', '快递', '新疆', '偏远'], version: '2026.10-v2', updatedAt: '2026-10-29', sections: [
    { title: '配送费用', text: '普通地区商品实付满59元包邮。偏远地区及大件商品运费以结算页展示为准，不能直接承诺所有地区包邮。' },
    { title: '发货与异常', text: '普通现货通常在付款后48小时内发出；定制、预售商品以订单约定为准。物流停滞超过48小时可创建人工协助工单。演示轨迹为模拟数据。' },
  ] },
  { id: 'cancel', title: '订单取消规则', category: '订单物流', tags: ['取消订单', '撤单', '不想买', '发货前', '待付款'], version: '2026.10-v1', updatedAt: '2026-10-29', sections: [
    { title: '可取消状态', text: '待付款或已付款未发货订单可申请取消，必须经用户明确确认后执行。已发货订单不能直接取消，可咨询退货或人工协助。执行时需再次核对订单状态。' },
  ] },
  { id: 'refund', title: '退款申请与到账说明', category: '退换售后', tags: ['退款', '到账', '原路', '退钱', '退款进度'], version: '2026.10-v1', updatedAt: '2026-10-29', sections: [
    { title: '退款进度', text: '申请提交、售后审核、支付退款、实际到账是不同状态。审核通过后的款项通常原路退回，参考时效1至3个工作日，实际以支付机构处理为准。' },
    { title: '演示边界', text: '本站只能创建演示退款申请，不连接支付网关，不会退还真实资金。不得将演示申请状态描述为已实际到账。' },
  ] },
  { id: 'invoice', title: '发票开具与抬头修改', category: '支付发票', tags: ['发票', '电子', '抬头', '税号', '开票'], version: '2026.10-v1', updatedAt: '2026-10-28', sections: [
    { title: '开具方式', text: '支持电子普通发票，可在订单完成后通过订单详情申请，正常情况下1至3个工作日内开具。企业抬头需填写完整名称与税号。' },
    { title: '修改与重开', text: '未开具前可修改抬头；已经开具的发票需联系人工核实红冲与重开流程。本站提供流程说明，不代开真实发票。' },
  ] },
  { id: 'warranty', title: '保修服务与维修申请', category: '退换售后', tags: ['保修', '维修', '修理', '进水', '坏了', '故障'], version: '2026.10-v1', updatedAt: '2026-10-28', sections: [
    { title: '保修范围', text: '演示数码商品提供12个月有限保修。正常使用下的性能故障可申请检测；进水、摔坏和私自拆修需人工判断是否属于保修范围。' },
  ] },
  { id: 'coupons', title: '优惠券与活动叠加', category: '优惠权益', tags: ['优惠券', '折扣', '满减', '叠加', '活动', '优惠'], version: '2026.10-v1', updatedAt: '2026-10-28', sections: [
    { title: '使用规则', text: '优惠券的门槛、有效期和可用商品以券面说明为准。一般每笔订单可使用一张店铺券，与平台活动能否叠加需看活动细则。' },
  ] },
  { id: 'sizes', title: '尺码选择与服饰换货', category: '商品选购', tags: ['尺码', '衣服', '尺寸', 'T恤', '换货', '洗涤'], version: '2026.10-v1', updatedAt: '2026-10-28', sections: [
    { title: '尺码与换货', text: '建议先核对商品页尺码表与个人穿着习惯。未洗涤、吊牌完整且不影响二次销售的普通服饰，可按7天规则申请退换；已洗涤服饰不支持无理由退换。' },
  ] },
  { id: 'handoff', title: '人工服务与升级处理', category: '服务保障', tags: ['人工', '客服', '投诉', '工单', '联系'], version: '2026.10-v1', updatedAt: '2026-10-29', sections: [
    { title: '演示工单', text: '可创建本地持久化的人工协助工单，保留订单、原因和咨询摘要。本站没有接入真实客服座席，创建演示工单不表示已有客服接入。' },
  ] },
  { id: 'privacy', title: '订单隐私与操作确认', category: '服务保障', tags: ['隐私', '别人', '权限', '确认', '数据', '安全'], version: '2026.10-v1', updatedAt: '2026-10-29', sections: [
    { title: '订单归属', text: '仅可查询当前演示买家的订单。订单号不是身份凭据，操作前必须检查归属。取消订单、退货和退款申请都需要明确确认；确认有效期为15分钟，确认时会重新检查业务状态。' },
  ] },
];

export const PRODUCTS = [
  { sku: 'SG-H01', name: '声屿 Pro 降噪耳机', short: '声屿 Pro', category: '数码', price: 399, stock: 32, icon: 'headphones', color: '#e7ecf4', desc: '主动降噪 · 40小时续航 · 云雾白' },
  { sku: 'SG-C02', name: '拾光定制陶瓷杯', short: '拾光陶瓷杯', category: '定制', price: 89, stock: 120, icon: 'cup', color: '#f1e8dc', desc: '手工釉面 · 专属刻字 · 燕麦色' },
  { sku: 'SG-T03', name: '日常系列纯棉 T 恤', short: '日常纯棉 T 恤', category: '服饰', price: 129, stock: 18, icon: 'shirt', color: '#e6eddf', desc: '100%棉 · 宽松版型 · 苔原绿' },
];

export function createWorkspace(now = Date.now()) {
  const days = (n) => new Date(now - n * 86400000).toISOString();
  const orders = [
    { id: 'SG10001', userId: 'demo-buyer', sku: 'SG-H01', status: 'shipped', quantity: 1, total: 399, createdAt: days(3), shippedAt: days(2), tracking: 'SF-DEMO-10001', city: '上海', customized: false, revision: 1 },
    { id: 'SG10002', userId: 'demo-buyer', sku: 'SG-C02', status: 'delivered', quantity: 1, total: 89, createdAt: days(20), deliveredAt: days(12), tracking: 'YT-DEMO-10002', city: '杭州', customized: true, revision: 1 },
    { id: 'SG10003', userId: 'demo-buyer', sku: 'SG-T03', status: 'paid', quantity: 1, total: 129, createdAt: days(0), city: '北京', customized: false, revision: 1 },
    { id: 'SG90001', userId: 'another-buyer', sku: 'SG-H01', status: 'paid', quantity: 1, total: 399, createdAt: days(1), city: '深圳', customized: false, revision: 1 },
  ];
  const state = { schema: 1, version: 0, buyerId: 'demo-buyer', orders, applications: [], tickets: [], conversations: [], activeId: null, createdAt: new Date(now).toISOString() };
  addConversation(state, now);
  return state;
}

export function addConversation(state, now = Date.now()) {
  const conversation = { id: crypto.randomUUID(), title: '新的咨询', createdAt: new Date(now).toISOString(), messages: [], task: null, pending: null };
  state.conversations.unshift(conversation);
  state.conversations = state.conversations.slice(0, 30);
  state.activeId = conversation.id;
  return conversation;
}

export const STATUS = { paid: '待发货', created: '待付款', shipped: '运输中', delivered: '已签收', cancelled: '已取消' };
export function publicWorkspace(state) {
  const copy = structuredClone(state);
  copy.orders = copy.orders.filter(o => o.userId === state.buyerId);
  copy.orders.forEach(o => delete o.userId);
  return copy;
}
