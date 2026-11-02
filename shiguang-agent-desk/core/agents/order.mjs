import { PRODUCTS, STATUS, INTENTS } from '../catalog.mjs';

export function getOwnedOrder(state, orderId) {
  const order = state.orders.find(o => o.id === orderId);
  if (!order || order.userId !== state.buyerId) return { ok: false, error: '未找到属于当前买家的这笔订单，请核对订单号。' };
  return { ok: true, order, product: PRODUCTS.find(p => p.sku === order.sku) };
}

export function orderAgent(state, orderId, intent, now = Date.now()) {
  const found = getOwnedOrder(state, orderId);
  if (!found.ok) return found;
  const { order, product } = found;
  if (intent === 'aftersales_status') {
    const applications = state.applications.filter(a => a.orderId === orderId);
    return { ok: true, order, tool: 'get_aftersales_status', answer: applications.length ? `订单 ${orderId} 的售后记录：\n${applications.map(a => `• ${INTENTS[a.kind]} ${a.id}：待审核，原因 ${a.reason}。`).join('\n')}\n这些是演示申请记录，尚不代表审核通过或款项到账。` : `订单 ${orderId} 当前没有售后申请记录。需要申请退货或退款时，请告诉我具体诉求。` };
  }
  if (intent === 'logistics') {
    const text = order.status === 'delivered' ? `已签收，签收日期 ${new Date(order.deliveredAt).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' })}` : order.status === 'shipped' ? '运输中，包裹已到达目的地分拨中心，预计1至2天内送达' : order.status === 'cancelled' ? '订单已取消，无在途包裹' : '待发货，暂时没有物流单号';
    return { ok: true, order, answer: `订单 ${order.id}「${product.name}」：${text}。${order.tracking ? `\n物流单号：${order.tracking}。` : ''}\n以上为演示物流轨迹。`, tool: 'track_shipment' };
  }
  const days = order.deliveredAt ? Math.floor((now - Date.parse(order.deliveredAt)) / 86400000) : null;
  return { ok: true, order, product, answer: `已查到订单 ${order.id}：\n${product.name} × ${order.quantity}\n实付 ¥${order.total.toFixed(2)} · ${STATUS[order.status] || order.status}\n收货城市：${order.city}${days !== null ? ` · 签收约${days}天` : ''}。`, tool: 'get_order' };
}

export function productAgent(message) {
  const matches = PRODUCTS.filter(p => message.includes(p.category) || message.includes(p.short.slice(0, 2)) || (/耳机/.test(message) && p.category === '数码') || (/杯/.test(message) && p.category === '定制') || (/衣|T恤|t恤/.test(message) && p.category === '服饰'));
  const items = matches.length ? matches : PRODUCTS;
  return { answer: `为你找到以下演示商品：\n${items.map(p => `• ${p.name}：¥${p.price}，${p.desc}，库存${p.stock}件。`).join('\n')}\n${!matches.length ? '可以告诉我预算和用途，我会进一步帮你缩小范围。' : '商品价格、库存均为演示数据。'}`, tool: 'search_products', products: items.map(p => p.sku) };
}
