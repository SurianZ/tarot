/* =========================================================
   神秘塔罗 · AI 深度解读模块
   - 浏览器直连 OpenAI 兼容接口（流式 SSE）
   - 仅在用户填写了问题时调用
   - 密钥只保存在本机 localStorage
   ========================================================= */
window.TAROT_AI = (function () {
  'use strict';

  /* 已验证「浏览器可直连（CORS 放行）」的服务商 */
  var PRESETS = [
    { key: 'deepseek', name: 'DeepSeek', base: 'https://api.deepseek.com', model: 'deepseek-chat' },
    { key: 'siliconflow', name: '硅基流动', base: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen2.5-72B-Instruct' },
    { key: 'dashscope', name: '阿里云百炼（中国站）', base: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
    { key: 'dashscope-intl', name: '阿里云百炼（国际站）', base: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
    { key: 'moonshot', name: '月之暗面 Kimi', base: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
    { key: 'ark', name: '火山方舟（豆包）', base: 'https://ark.cn-beijing.volces.com/api/v3', model: 'doubao-pro-32k' },
    { key: 'custom', name: '自定义 / OpenAI 兼容', base: '', model: '' }
  ];

  function presetOf(key) {
    for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i].key === key) return PRESETS[i];
    return PRESETS[0];
  }

  /* 把用户填写的 base 补全为 chat/completions 端点 */
  function endpoint(base) {
    var b = String(base || '').trim().replace(/\s+/g, '');
    if (!b) return '';
    b = b.replace(/\/+$/, '');
    if (/\/chat\/completions$/i.test(b)) return b;
    return b + '/chat/completions';
  }

  var SYSTEM_PROMPT = [
    '你是一位经验丰富、语气温润而有洞见的塔罗解读师，擅长把牌面象征与求助者的真实处境连在一起。',
    '解读要求：',
    '1. 紧扣求助者写下的问题，不要泛泛而谈；把每张牌放回它所在的牌阵位置上理解。',
    '2. 兼顾正位与逆位的差异，说明牌与牌之间如何互相加强或彼此牵制。',
    '3. 语气温柔而清醒，像一位可靠的朋友；避免"命中注定""一定会"这类绝对断言，也不要做医疗、法律、投资方面的具体决定。',
    '4. 结尾给出 2~3 条今天就能开始做的、具体可执行的建议。',
    '输出格式（使用 Markdown，不要输出其它内容）：',
    '### 一、整体能量',
    '（2~3 段，概括这次占卜的整体氛围与核心议题）',
    '### 二、逐张串联',
    '（按牌阵顺序，用 - 列表，每张牌 1~2 句，写出它在那个位置的含义与彼此的关系）',
    '### 三、针对你的问题',
    '（2~3 段，直接回答求助者的问题，指出最关键的变量与可能的走向）',
    '### 四、下一步建议',
    '（用 - 列表给出 2~3 条具体建议）',
    '全文 600~900 字，中文。'
  ].join('\n');

  function buildMessages(payload) {
    var q = (payload.question || '').trim();
    var lines = [];
    lines.push('【求助者的问题】');
    lines.push(q || '（未填写具体问题，请给出整体指引）');
    lines.push('');
    lines.push('【使用的牌阵】' + payload.spreadName + (payload.spreadSub ? '（' + payload.spreadSub + '）' : '') +
      '，共 ' + payload.cards.length + ' 张');
    lines.push('');
    lines.push('【抽到的牌（按牌阵位置顺序）】');
    payload.cards.forEach(function (c, i) {
      lines.push((i + 1) + '. 位置：' + c.pos + '｜牌：' + c.name + '（' + c.en + '）｜' +
        (c.reversed ? '逆位' : '正位') + '｜关键词：' + (c.keywords || []).join('、'));
      if (c.meaning) lines.push('   牌面基础含义：' + c.meaning);
    });
    lines.push('');
    lines.push('请结合以上信息给出完整解读。');
    return [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: lines.join('\n') }
    ];
  }

  /* 认证/权限类错误给出可执行的排查提示（端点与 key 的区域必须匹配） */
  function diagnose(status, url) {
    if (status !== 401 && status !== 403) return '';
    var lines = [];
    lines.push('');
    lines.push('调用地址：' + url);
    if (/dashscope-intl/.test(url)) {
      lines.push('→ 这是阿里云百炼【国际站】端点，只认国际站（modelstudio.console.alibabacloud.com）生成的 API-KEY。');
      lines.push('   如果你的 key 取自中国站 bailian.console.aliyun.com，请把「服务商」改成「阿里云百炼（中国站）」。');
    } else if (/dashscope\.aliyuncs\.com/.test(url)) {
      lines.push('→ 这是阿里云百炼【中国站】端点，只认中国站（bailian.console.aliyun.com → API-KEY 管理）生成的 sk- 密钥。');
      lines.push('   如果 key 取自国际站，请改选「阿里云百炼（国际站）」；另外别把阿里云 AccessKey（LTAI 开头）当 API-KEY 用。');
    } else if (/api\.deepseek\.com/.test(url)) {
      lines.push('→ DeepSeek 密钥形如 sk- 加 32 位字符，请到 platform.deepseek.com → API keys 重新生成并完整复制。');
    } else if (/moonshot/.test(url)) {
      lines.push('→ Kimi 密钥请在 platform.moonshot.cn → API Key 管理 获取。');
    } else if (/siliconflow/.test(url)) {
      lines.push('→ 硅基流动密钥请在 cloud.siliconflow.cn → API 密钥 获取。');
    } else if (/volces\.com/.test(url)) {
      lines.push('→ 火山方舟需要同时填对「模型」为你的推理接入点 ID（形如 ep-xxxx）或模型名。');
    } else {
      lines.push('→ 请核对三点：① key 是否完整（不要带多余空格或换行）② 服务商与端点是否匹配 ③ 用的是「API Key」而不是「AccessKey / SecretKey」。');
    }
    return lines.join('\n');
  }

  /* 流式对话：onDelta(片段) / onDone(全文) */
  async function chat(cfg, messages, onDelta, signal) {
    var url = endpoint(cfg.base);
    if (!url) throw new Error('接口地址为空');
    if (!cfg.key) throw new Error('API Key 为空');

    var res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + cfg.key
        },
        body: JSON.stringify({
          model: cfg.model || presetOf(cfg.preset).model,
          messages: messages,
          stream: true,
          temperature: 0.85,
          max_tokens: 2200
        }),
        signal: signal
      });
    } catch (e) {
      throw new Error('无法连接接口（可能是网络不通或该接口未开放跨域 CORS）：' + e.message);
    }

    if (!res.ok) {
      var detail = '';
      try { detail = await res.text(); } catch (e2) {}
      var msg = detail;
      try { var j = JSON.parse(detail); msg = (j.error && (j.error.message || j.error.code)) || j.message || detail; } catch (e3) {}
      throw new Error('接口返回 ' + res.status + '：' + String(msg).slice(0, 300) + diagnose(res.status, url));
    }

    var ctype = (res.headers.get('content-type') || '').toLowerCase();
    var full = '';

    /* 非流式响应兜底 */
    if (ctype.indexOf('application/json') >= 0 && ctype.indexOf('event-stream') < 0) {
      var data = await res.json();
      full = (((data.choices || [])[0] || {}).message || {}).content || '';
      if (full && onDelta) onDelta(full, true);
      return full;
    }

    var reader = res.body.getReader();
    var decoder = new TextDecoder('utf-8');
    var buf = '';
    while (true) {
      var chunk = await reader.read();
      if (chunk.done) break;
      buf += decoder.decode(chunk.value, { stream: true });
      var parts = buf.split('\n');
      buf = parts.pop();
      for (var i = 0; i < parts.length; i++) {
        var line = parts[i].trim();
        if (!line || line.charAt(0) === ':') continue;
        if (line.indexOf('data:') !== 0) continue;
        var payload = line.slice(5).trim();
        if (payload === '[DONE]') continue;
        var delta = '';
        try {
          var obj = JSON.parse(payload);
          var ch = (obj.choices || [])[0] || {};
          delta = (ch.delta && (ch.delta.content || '')) || (ch.message && ch.message.content) || '';
          if (ch.finish_reason === 'error') delta = '';
        } catch (e4) { continue; }
        if (delta) { full += delta; if (onDelta) onDelta(delta, false); }
      }
    }
    return full;
  }

  /* 极简 Markdown 渲染（先转义，避免 XSS） */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }

  function inline(s) {
    return s
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  }

  function render(text, caret) {
    var src = escapeHtml(text || '');
    var lines = src.split('\n');
    var out = [];
    var listOpen = false;
    function closeList() { if (listOpen) { out.push('</ul>'); listOpen = false; } }

    for (var i = 0; i < lines.length; i++) {
      var raw = lines[i];
      var line = raw.trim();
      if (!line) { closeList(); continue; }
      var h = /^(#{1,6})\s*(.+)$/.exec(line);
      if (h) {
        closeList();
        var lvl = h[1].length <= 3 ? 'h4' : 'h5';
        out.push('<' + lvl + '>' + inline(h[2]) + '</' + lvl + '>');
        continue;
      }
      var li = /^[-*•]\s+(.+)$/.exec(line) || /^\d+[.、)]\s+(.+)$/.exec(line);
      if (li) {
        if (!listOpen) { out.push('<ul>'); listOpen = true; }
        out.push('<li>' + inline(li[1]) + '</li>');
        continue;
      }
      closeList();
      out.push('<p>' + inline(line) + '</p>');
    }
    closeList();
    var html = out.join('');
    if (caret) html += '<span class="caret"></span>';
    return html;
  }

  return { PRESETS: PRESETS, presetOf: presetOf, endpoint: endpoint, buildMessages: buildMessages, chat: chat, render: render };
})();