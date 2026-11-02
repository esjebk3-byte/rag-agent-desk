export function createModel(env = process.env) {
  if (env.MODEL_ENABLED !== 'true' || !env.MODEL_API_KEY) return null;
  const base = new URL(env.MODEL_BASE_URL || 'https://api.deepseek.com');
  if (base.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(base.hostname)) throw new Error('模型地址必须使用HTTPS或本机服务');
  const endpoint = base.href.replace(/\/$/, '') + '/chat/completions';
  return {
    name: env.MODEL_NAME || 'deepseek-flash',
    async complete(agent, system, user, { json = false } = {}) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.MODEL_API_KEY}` },
        signal: AbortSignal.timeout(Math.min(Number(env.MODEL_TIMEOUT_MS) || 20000, 60000)),
        body: JSON.stringify({ model: this.name, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: 0, max_tokens: 700, ...(json ? { response_format: { type: 'json_object' } } : {}) }),
      });
      if (!response.ok) throw new Error(`模型服务HTTP ${response.status}`);
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;
      if (typeof text !== 'string' || !text.trim()) throw new Error('模型返回空内容');
      return { text, usage: data.usage || null, agent };
    },
  };
}
