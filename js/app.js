/* =========================================================
   神秘塔罗 · 应用逻辑  v2
   Vue 3 + GSAP：洗牌 → 扇形铺牌 → 用户自己翻牌抽牌 → 3D 翻牌 → 解析
   AI 深度解读：仅在用户填写了问题时调用
   ========================================================= */
(function () {
  'use strict';

  var DATA = window.TAROT_DATA || [];
  var AI = window.TAROT_AI || null;
  var byId = {};
  DATA.forEach(function (c) { byId[c.id] = c; });

  var BASE_W = 9;                    // 卡牌基准宽度（占舞台宽度的百分比）
  var RATIO = 527 / 300;             // 牌面高宽比（素材 300×527）
  /* 扇形参数：每张牌的角度步长随屏宽变化；半径系数；可见/淡出角度 */
  var FAN = { radius: 0.86, topPad: 0.03, visHalf: 34, fadeHalf: 42 };
  var stepOf = function (W) { return W < 520 ? 5.6 : 4.2; };

  var FALLBACK_CARD = { name: '未知之牌', en: 'Unknown', emoji: '🔮', keywords: [], upright: '', reversed: '' };
  var ROMAN = ['0', 'Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ', 'Ⅶ', 'Ⅷ', 'Ⅸ', 'Ⅹ',
    'Ⅺ', 'Ⅻ', 'ⅩⅢ', 'ⅩⅣ', 'ⅩⅤ', 'ⅩⅥ', 'ⅩⅦ', 'ⅩⅧ', 'ⅩⅨ', 'ⅩⅩ', 'ⅩⅪ'];
  var COURT = { 11: '侍从', 12: '骑士', 13: '王后', 14: '国王' };
  var SUIT_CN = { wands: '权杖', cups: '圣杯', swords: '宝剑', pentacles: '星币' };
  var SUIT_ICON = { wands: '🔥', cups: '🏆', swords: '⚔️', pentacles: '🪙' };
  var AI_STORE = 'tarot.ai.config.v1';

  /* ================= 牌阵 ================= */
  var SPREADS = {
    single: {
      key: 'single', name: '单张牌', sub: '今日指引', emoji: '🔮',
      cards: [{ x: 50, y: 48, w: 16, rot: 0 }],
      positions: [{
        no: 1, pos: '指引 (Guidance)',
        lead: '牌阵为你抽出的这张牌，正是此刻最需要你看见的那股能量——',
        tailU: '它意味着顺着这股力量前行，你会走在属于自己的节奏上。',
        tailR: '它以逆位出现，提示这股能量此刻受阻或过度，先松动内心的某个结，再谈前进。'
      }]
    },
    three: {
      key: 'three', name: '三张牌', sub: '过去 / 现在 / 未来', emoji: '🌙',
      cards: [
        { x: 26, y: 50, w: 12.5, rot: 0 },
        { x: 50, y: 50, w: 12.5, rot: 0 },
        { x: 74, y: 50, w: 12.5, rot: 0 }
      ],
      positions: [
        { no: 1, pos: '过去 (Past)', lead: '【过去】的位置映照出这件事的来处——', tailU: '这段经历留下的养分，此刻仍在默默支持着你。', tailR: '这段经历里尚未被消化的部分，正以看不见的方式牵动着现在。' },
        { no: 2, pos: '现在 (Present)', lead: '【现在】的位置显示你此刻真实所处的状态——', tailU: '把握住眼前的这份能量，它是你下一步最可靠的支点。', tailR: '此刻的能量有些滞涩，先别急着推进，把注意力收回到自己身上。' },
        { no: 3, pos: '未来 (Future)', lead: '【未来】的位置预示事情可能的走向——', tailU: '若保持当下的方向与心境，结果会朝着你期待的样子展开。', tailR: '这是提醒而非定论：未来仍在流动，调整当下的选择便能改写走向。' }
      ]
    },
    celtic: {
      key: 'celtic', name: '凯尔特十字', sub: '十张牌 · 完整剖析', emoji: '✦',
      cards: [
        { x: 41.5, y: 45, w: 10, rot: 0 },
        { x: 42.5, y: 48.2, w: 9.6, rot: 90 },
        { x: 42, y: 68, w: 10, rot: 0 },
        { x: 23, y: 46, w: 10, rot: 0 },
        { x: 42, y: 24, w: 10, rot: 0 },
        { x: 61, y: 46, w: 10, rot: 0 },
        { x: 80, y: 78, w: 10, rot: 0 },
        { x: 80, y: 59, w: 10, rot: 0 },
        { x: 80, y: 40, w: 10, rot: 0 },
        { x: 80, y: 21, w: 10, rot: 0 }
      ],
      positions: [
        { no: 1, pos: '底牌 / 指示牌 (Centre)', lead: '【底牌】是整个牌阵的核心，代表这件事最本质的能量——', tailU: '它是整件事的根基，也是你此刻可以依靠的力量。', tailR: '核心能量处在逆位，说明真正的课题是先修复自己，而非改变外界。' },
        { no: 2, pos: '覆盖牌 (Crossing)', lead: '【覆盖牌】横在底牌之上，代表正在发生的阻碍或助力——', tailU: '这股交错的能量会成为推动力，认清它，就可以善用它。', tailR: '它是眼下的主要阻力；看清它的形状，它便不再无形。' },
        { no: 3, pos: '根源 (Basis)', lead: '【根源】指向问题深层的成因——', tailU: '这是事情得以成立的底色，也是你最稳固的立足点。', tailR: '根源处还留着未解的旧痕，处理它远比处理表面更有效。' },
        { no: 4, pos: '过去 (Recent Past)', lead: '【过去】的位置回望刚刚过去不久的影响——', tailU: '它为你积攒了此刻可用的经验与资源，别急着否定走过的路。', tailR: '尚未散去的余波仍在起作用，允许自己慢慢消化。' },
        { no: 5, pos: '可能结果 (Possible Outcome)', lead: '【可能结果】显示顺着当前路径可能抵达的地方——', tailU: '若能保持现在的状态，这是一个值得期待的方向。', tailR: '这是预警：若维持现状，落点可能不如预期，但仍有调整的余地。' },
        { no: 6, pos: '近期未来 (Near Future)', lead: '【近期未来】揭示即将到来的变化——', tailU: '接下来会有一阵顺风，请提前做好准备去迎接它。', tailR: '接下来会经过一段考验，提前留出缓冲，别把日程排得太满。' },
        { no: 7, pos: '自我 (Self)', lead: '【自我】的位置照见你在这件事中的姿态——', tailU: '你的状态是这场占卜里最有分量的变量，请信任自己。', tailR: '你此刻对自己的判断有些摇摆，先安顿情绪，再谈决定。' },
        { no: 8, pos: '环境 (Environment)', lead: '【环境】代表你周围人与事的氛围——', tailU: '周围的人与事正在默默支持你，不必独自扛下所有。', tailR: '外部环境有杂音与阻力，注意分辨哪些声音才值得听。' },
        { no: 9, pos: '希望与恐惧 (Hopes & Fears)', lead: '【希望与恐惧】的位置，往往同时映出你最想要与最害怕的东西——', tailU: '你的期待正在成形，它是推动你向前的燃料。', tailR: '恐惧被放大了，它多半来自想象，而不是事实。' },
        { no: 10, pos: '结果 (Outcome)', lead: '【结果】是整个牌阵的收束，指向最终的落点——', tailU: '这是牌面给出的答案：顺流而行，你正走在正确的路上。', tailR: '结果尚未定型，逆转的关键在于你愿不愿意改变当下的一个习惯。' }
      ]
    }
  };

  var ELEMENT_TEXT = {
    '火': '火元素最为突出：这件事的核心动力来自热情、行动与意志力。你需要的往往不是继续等待，而是先迈出那一步。',
    '水': '水元素最为明显：情感与直觉是这件事的主线。多倾听心里的声音，也照顾关系里的温度，答案会在柔软处浮现。',
    '风': '风元素最为突出：理性、沟通与信息将成为关键。把话说清楚、把事实核对清楚，远比反复揣测有用。',
    '土': '土元素最为显著：现实层面的资源、时间与金钱需要被认真对待。稳步推进，胜过孤注一掷。',
    '大阿尔卡纳': '牌面以大阿尔卡纳为主：这不是一件小事，它牵动的是你人生中更深的那条主线。'
  };

  /* ================= 工具 ================= */
  function pickIndices(total, n) {
    var pool = [];
    for (var i = 0; i < total; i++) pool.push(i);
    for (var j = pool.length - 1; j > 0; j--) {
      var k = Math.floor(Math.random() * (j + 1));
      var t = pool[j]; pool[j] = pool[k]; pool[k] = t;
    }
    return pool.slice(0, n);
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function loadAiCfg() { try { return JSON.parse(localStorage.getItem(AI_STORE)) || null; } catch (e) { return null; } }
  function saveAiCfg(cfg) { try { localStorage.setItem(AI_STORE, JSON.stringify(cfg)); } catch (e) {} }

  function buildAnalysis(question, spread, drawn) {
    var lines = [], major = 0, rev = 0, elemCount = {}, kwPool = [];

    drawn.forEach(function (d, i) {
      var card = byId[d.cardId] || FALLBACK_CARD;
      var pos = spread.positions[i];
      var meaning = (d.reversed ? card.reversed : card.upright) || '';
      lines.push({
        no: pos.no, pos: pos.pos, name: card.name, en: card.en,
        reversed: d.reversed, flipped: false,
        text: pos.lead + meaning + (d.reversed ? pos.tailR : pos.tailU)
      });
      if (card.arcana === 'major') major++;
      if (d.reversed) rev++;
      var el = card.arcana === 'major' ? '大阿尔卡纳' : (card.element || '其他');
      elemCount[el] = (elemCount[el] || 0) + 1;
      (card.keywords || []).forEach(function (k) { kwPool.push(k); });
    });

    var n = drawn.length;
    var last = drawn[n - 1];
    var lastCard = byId[last.cardId] || FALLBACK_CARD;
    var firstCard = byId[drawn[0].cardId] || FALLBACK_CARD;
    var summary = [];

    summary.push(
      '本次使用【' + spread.name + '】共 ' + n + ' 张牌' + (question ? '，围绕你所问的「' + question + '」' : '') + '。' +
      (major >= Math.ceil(n / 2)
        ? '其中大阿尔卡纳有 ' + major + ' 张，占比很重——它说明这并非一件可以轻描淡写的小事，而是牵动你人生主线的一段课题。'
        : '其中大阿尔卡纳 ' + major + ' 张、小阿尔卡纳 ' + (n - major) + ' 张，事情的走向更多取决于日常的选择与行动，而非不可违逆的命运。')
    );

    var dominant = null, max = 0;
    Object.keys(elemCount).forEach(function (k) { if (elemCount[k] > max) { max = elemCount[k]; dominant = k; } });
    summary.push((max >= 2 && ELEMENT_TEXT[dominant])
      ? ELEMENT_TEXT[dominant]
      : '牌面的元素分布较为均衡，说明这件事需要你同时兼顾理性与情感、想法与落地——任何一头失衡，都会让进展变慢。');

    if (rev === 0) {
      summary.push('全部 ' + n + ' 张牌皆为正位，能量流动顺畅。这是一个难得的好兆头：该发生的会自然发生，你只需保持当下的方向。');
    } else if (rev === n) {
      summary.push('全部 ' + n + ' 张牌皆为逆位，能量整体处在内收与重整的阶段。此刻最好的动作或许是暂停向外争取，先把自己理顺。');
    } else if (rev * 2 >= n) {
      summary.push('逆位牌偏多（' + rev + '/' + n + '），说明能量多半处在调整期：外部的阻力其实不大，真正的关卡在你心里尚未解开的那一部分。');
    } else {
      summary.push('正逆位交错（' + (n - rev) + ' 正 / ' + rev + ' 逆），事情有顺有阻，关键在于节奏而非运气——顺着顺的位置发力，在逆的位置留白。');
    }

    summary.push(
      '牌阵最后落在《' + lastCard.name + '》' + (last.reversed ? '逆位' : '正位') + '。' +
      (last.reversed
        ? '它提醒你：现在看到的结局只是当前轨迹的延伸，你不必接受它——改变一个习惯、换一种表达，落点就会随之偏移。'
        : '它给出的答案是肯定的：若你愿意继续投入，这件事值得被认真对待。')
    );

    if (kwPool.length) {
      var uniq = kwPool.filter(function (k, i) { return kwPool.indexOf(k) === i; }).slice(0, 6);
      summary.push('把这次占卜的关键词记在心里：' + uniq.join('、') + '。从《' + firstCard.name +
        '》开始，先处理好它提示的那一件事，其余的线索会依次向你展开。');
    }

    return { lines: lines, summary: summary };
  }

  /* ================= Vue 应用 ================= */
  var app = Vue.createApp({
    data: function () {
      var saved = loadAiCfg();
      var preset = (saved && saved.preset) || 'deepseek';
      var p = AI ? AI.presetOf(preset) : { base: '', model: '' };
      return {
        tab: 'divine',
        question: '',
        spreadKey: 'three',
        phase: 'idle',
        visualDeck: [],
        drawn: [],
        analysis: null,
        landed: 0,
        broken: {},
        /* 本站自带 78 张牌面，默认按「有图」渲染；单张图缺失时由 @error 回退到 CSS 牌面。
           不再额外发探测请求 —— 国内每次往返 1~2 秒，能省则省 */
        hasArt: true,
        selected: null,
        spreadRefOpen: false,
        learnFilter: 'all',
        learnQuery: '',
        unit: 6,
        fanCursor: 0,
        fanSpace: 220,
        fanHover: null,
        drag: null,
        autoTimer: null,
        tl: null,
        resizeTimer: null,
        copyMsg: '',

        aiPresets: AI ? AI.PRESETS : [],
        aiOpen: false,
        aiCfg: {
          preset: preset,
          base: (saved && saved.base) || p.base,
          model: (saved && saved.model) || p.model,
          key: (saved && saved.key) || ''
        },
        aiForm: {
          preset: preset,
          base: (saved && saved.base) || p.base,
          model: (saved && saved.model) || p.model,
          key: (saved && saved.key) || ''
        },
        aiState: 'idle',
        aiText: '',
        aiError: '',
        aiAbort: null,
        aiTesting: false,
        aiTestMsg: '',
        aiTestOk: false
      };
    },

    computed: {
      spreadList: function () {
        return [SPREADS.single, SPREADS.three, SPREADS.celtic].map(function (s) {
          return { key: s.key, name: s.name, sub: s.sub, emoji: s.emoji, count: s.cards.length };
        });
      },
      currentSpread: function () { return SPREADS[this.spreadKey] || SPREADS.three; },
      /* 单张/三张用更扁的舞台，凯尔特十字需要正方形 */
      stageAspect: function () { return this.spreadKey === 'celtic' ? '1 / 1' : '4 / 3'; },
      busy: function () { return this.phase === 'shuffling'; },
      primaryBtnText: function () {
        if (this.phase === 'shuffling') return '洗 牌 中 …';
        if (this.phase === 'draw') return '重 新 洗 牌';
        if (this.phase === 'reveal' || this.phase === 'done') return '再 占 一 次';
        return '开 始 占 卜';
      },
      fanList: function () { return this.visualDeck.filter(function (d) { return d.slot < 0; }); },
      remainingDraw: function () { return Math.max(0, this.currentSpread.cards.length - this.drawn.length); },
      flippedCount: function () { return this.drawn.filter(function (d) { return d.flipped; }).length; },
      allFlipped: function () { return this.drawn.length > 0 && this.drawn.every(function (d) { return d.flipped; }); },
      aiReady: function () { return !!(this.aiCfg.key && this.aiCfg.base); },
      aiHtml: function () { return AI ? AI.render(this.aiText, this.aiState === 'loading') : ''; },
      showAiCard: function () { return !!this.question.trim() && !!this.analysis; },
      filters: function () {
        var self = this;
        return [
          { key: 'all', label: '全部' }, { key: 'major', label: '大阿尔卡纳' },
          { key: 'wands', label: '权杖' }, { key: 'cups', label: '圣杯' },
          { key: 'swords', label: '宝剑' }, { key: 'pentacles', label: '星币' }
        ].map(function (f) { f.count = self.countOf(f.key); return f; });
      },
      filteredCards: function () {
        var q = this.learnQuery.trim().toLowerCase();
        var f = this.learnFilter;
        return DATA.filter(function (c) {
          if (f === 'major' && c.arcana !== 'major') return false;
          if (f !== 'major' && f !== 'all' && c.suit !== f) return false;
          if (!q) return true;
          return (c.name + ' ' + c.en + ' ' + (c.keywords || []).join(' ') + ' ' + (c.astrology || ''))
            .toLowerCase().indexOf(q) >= 0;
        });
      }
    },

    watch: {
      allFlipped: function (v) {
        if (v && this.showAiCard && this.aiReady && this.aiState === 'idle') this.runAi();
      }
    },

    mounted: function () {
      this.updateUnit();
      window.addEventListener('resize', this.onResize);
      window.addEventListener('pointermove', this.onPointerMove, { passive: true });
      window.addEventListener('pointerup', this.onPointerUp);
      window.addEventListener('pointercancel', this.onPointerCancel);
    },
    beforeUnmount: function () {
      window.removeEventListener('resize', this.onResize);
      window.removeEventListener('pointermove', this.onPointerMove);
      window.removeEventListener('pointerup', this.onPointerUp);
      window.removeEventListener('pointercancel', this.onPointerCancel);
      if (this.autoTimer) clearInterval(this.autoTimer);
      if (this.aiAbort) this.aiAbort.abort();
    },

    methods: {
      /* ---------- 基础 ---------- */
      cardOf: function (d) { return byId[d.cardId] || FALLBACK_CARD; },
      imgOf: function (d) { return './images/card_' + d.cardId + '.jpg'; },
      markBroken: function (id) { this.broken[id] = true; },
      arcanaLabel: function (c) { return c.arcana === 'major' ? '大阿尔卡纳' : '小阿尔卡纳 · ' + (SUIT_CN[c.suit] || ''); },
      numeralOf: function (c) {
        if (!c) return '';
        if (c.arcana === 'major') return ROMAN[c.number] || String(c.number);
        return (SUIT_ICON[c.suit] || '') + ' ' + (c.number <= 10 ? ROMAN[c.number] : (COURT[c.number] || c.number));
      },
      countOf: function (key) {
        if (key === 'all') return DATA.length;
        if (key === 'major') return DATA.filter(function (c) { return c.arcana === 'major'; }).length;
        return DATA.filter(function (c) { return c.suit === key; }).length;
      },
      switchTab: function (t) {
        this.tab = t;
        if (t === 'divine') { var self = this; this.$nextTick(function () { self.updateUnit(); self.onResize(); }); }
      },
      openCard: function (c) { this.selected = c; },

      slotStyle: function (c) {
        return {
          left: c.x + '%', top: c.y + '%', width: c.w + '%',
          height: (c.w * RATIO) + '%',
          transform: 'translate(-50%, -50%) rotate(' + (c.rot || 0) + 'deg) scale(' + (c.w / BASE_W) + ')'
        };
      },
      slotFilled: function (i) { return this.landed > i; },
      canFlip: function (d) { return this.phase === 'reveal' && d.slot >= 0 && !d.flipped; },

      /* ---------- 尺寸 ---------- */
      updateUnit: function () {
        var stage = this.$refs.stage;
        if (!stage) return;
        var w = stage.clientWidth || 600;
        var boost = w < 520 ? 1.28 : 1;
        this.unit = (w / 100) * boost;
        stage.style.fontSize = this.unit + 'px';
        this.updateFanSpace();
      },
      updateFanSpace: function () {
        var stage = this.$refs.stage;
        if (!stage) return;
        var W = stage.clientWidth || 600;
        var R = W * FAN.radius;
        var drop = R * (1 - Math.cos(FAN.fadeHalf * Math.PI / 180));
        var cardH = W * BASE_W / 100 * RATIO;
        this.fanSpace = Math.round(W * FAN.topPad + drop + cardH * 0.9 + W * 0.05);
      },
      onResize: function () {
        var self = this;
        clearTimeout(this.resizeTimer);
        this.resizeTimer = setTimeout(function () {
          self.updateUnit();
          self.placeDealt();
          self.layoutFan(false);
        }, 120);
      },

      /* ---------- 扇形几何（虚拟窗口：始终只有 ±10 张可见） ---------- */
      fanGeo: function (i, cursor, W) {
        var stage = this.$refs.stage;
        var H = (stage && stage.clientHeight) || W;
        var step = stepOf(W);
        var theta = (i - cursor) * step;
        var rad = theta * Math.PI / 180;
        var R = W * FAN.radius;
        var a = Math.abs(theta);
        var op = a <= FAN.visHalf ? 1 : 1 - (a - FAN.visHalf) / (FAN.fadeHalf - FAN.visHalf);
        return {
          visible: a <= FAN.fadeHalf,
          x: W / 2 + R * Math.sin(rad),
          y: H + W * FAN.topPad + R * (1 - Math.cos(rad)),
          rot: theta,
          opacity: clamp(op, 0, 1)
        };
      },
      elementMap: function () {
        var stage = this.$refs.stage;
        var map = {};
        if (!stage) return map;
        var els = stage.querySelectorAll('.card-el');
        for (var i = 0; i < els.length; i++) map[els[i].getAttribute('data-uid')] = els[i];
        return map;
      },
      layoutFan: function (animate) {
        var stage = this.$refs.stage;
        if (!stage || !window.gsap) return;
        if (this.phase !== 'draw') return;      /* 只在抽牌阶段维护牌扇，避免复位已淡出的牌 */
        var gsap = window.gsap;
        var W = stage.clientWidth || 600;
        var list = this.fanList;
        var n = list.length;
        if (!n) return;
        var cursor = clamp(this.fanCursor, 0, n - 1);
        var map = this.elementMap();

        for (var i = 0; i < n; i++) {
          var el = map[list[i].uid];
          if (!el) continue;
          var g = this.fanGeo(i, cursor, W);
          if (!g.visible) {
            if (el.style.opacity !== '0') gsap.set(el, { opacity: 0, pointerEvents: 'none' });
            continue;
          }
          var vars = {
            xPercent: -50, yPercent: -50, x: g.x, y: g.y,
            rotation: g.rot, scale: 1, opacity: g.opacity, pointerEvents: 'auto'
          };
          if (animate) { vars.duration = 0.4; vars.ease = 'power2.out'; gsap.to(el, vars); }
          else gsap.set(el, vars);
        }
      },

      /* ---------- 开始占卜 ---------- */
      startDivination: function () {
        if (this.busy) return;
        this.stopAnimation();
        if (this.autoTimer) { clearInterval(this.autoTimer); this.autoTimer = null; }
        this.visualDeck = [];
        this.drawn = [];
        this.analysis = null;
        this.landed = 0;
        this.fanHover = null;
        this.phase = 'idle';
        this.aiState = 'idle'; this.aiText = ''; this.aiError = '';
        if (this.aiAbort) { this.aiAbort.abort(); this.aiAbort = null; }

        var ids = pickIndices(DATA.length, DATA.length);
        this.visualDeck = ids.map(function (id, i) {
          return { uid: i, cardId: id, reversed: Math.random() < 0.5, slot: -1, flipped: false };
        });
        this.fanCursor = (DATA.length - 1) / 2;
        this.phase = 'shuffling';

        var self = this;
        this.$nextTick(function () {
          self.updateUnit();
          self.runShuffle();
        });
      },

      runShuffle: function () {
        var self = this;
        var stage = this.$refs.stage;
        var els = Array.prototype.slice.call(stage.querySelectorAll('.card-el'));
        if (!els.length || !window.gsap) {
          this.phase = 'draw';
          this.$nextTick(function () { self.layoutFan(false); });
          return;
        }

        var gsap = window.gsap;
        var W = stage.clientWidth || 600;
        var H = stage.clientHeight || W;
        var cx = W / 2, cy = H * 0.44;

        gsap.killTweensOf(els);
        gsap.set(els, {
          xPercent: -50, yPercent: -50, x: cx, y: cy,
          rotation: function () { return gsap.utils.random(-6, 6); },
          scale: 0.92, opacity: 1, pointerEvents: 'none'
        });

        var tl = gsap.timeline();
        this.tl = tl;

        for (var r = 0; r < 2; r++) {
          tl.to(els, {
            duration: 0.6,
            x: function () { return cx + gsap.utils.random(-0.36, 0.36) * W; },
            y: function () { return cy + gsap.utils.random(-0.3, 0.3) * H; },
            rotation: function () { return gsap.utils.random(-70, 70); },
            stagger: { each: 0.006, from: 'random' }, ease: 'power2.out'
          });
          tl.to(els, {
            duration: 0.54, x: cx, y: cy,
            rotation: function () { return gsap.utils.random(-10, 10); },
            stagger: { each: 0.005, from: 'random' }, ease: 'power3.inOut'
          }, '+=0.12');
        }

        /* 铺成扇形 */
        var n = this.visualDeck.length;
        var cursor = (n - 1) / 2;
        gsap.set(els, { pointerEvents: 'auto' });
        tl.to(els, {
          duration: 0.95,
          x: function (idx) { return self.fanGeo(idx, cursor, W).visible ? self.fanGeo(idx, cursor, W).x : cx; },
          y: function (idx) { return self.fanGeo(idx, cursor, W).visible ? self.fanGeo(idx, cursor, W).y : cy; },
          rotation: function (idx) { return self.fanGeo(idx, cursor, W).visible ? self.fanGeo(idx, cursor, W).rot : 0; },
          opacity: function (idx) { return self.fanGeo(idx, cursor, W).opacity; },
          scale: 1,
          stagger: { each: 0.004, from: 'center' },
          ease: 'back.out(1.1)'
        });
        tl.call(function () {
          self.fanCursor = cursor;
          self.phase = 'draw';
          self.$nextTick(function () {
            self.updateFanSpace();
            self.layoutFan(false);
          });
        });
      },

      /* ---------- 抽牌 ---------- */
      onFanEnter: function (d, ev) {
        if (ev && ev.pointerType && ev.pointerType !== 'mouse') return;
        if (this.phase === 'draw' && d.slot < 0) this.fanHover = d.uid;
      },
      onFanLeave: function (d, ev) {
        if (ev && ev.pointerType && ev.pointerType !== 'mouse') return;
        if (this.fanHover === d.uid) this.fanHover = null;
      },
      onPointerDown: function (d, ev) {
        if (this.phase !== 'draw' || d.slot >= 0 || d.uid === undefined) return;
        var list = this.fanList;
        var idx = -1;
        for (var i = 0; i < list.length; i++) if (list[i].uid === d.uid) { idx = i; break; }
        if (idx < 0) return;
        this.drag = {
          card: d, fanIndex: idx, moved: false,
          sx: ev.clientX, sy: ev.clientY, base: this.fanCursor, t0: Date.now()
        };
      },
      onPointerMove: function (ev) {
        var g = this.drag;
        if (!g) return;
        var dx = ev.clientX - g.sx, dy = ev.clientY - g.sy;
        if (!g.moved) {
          if (Math.abs(dx) < 7 || Math.abs(dx) < Math.abs(dy)) return;
          g.moved = true;
        }
        var stage = this.$refs.stage;
        var W = (stage && stage.clientWidth) || 600;
        var R = W * FAN.radius;
        var step = stepOf(W) * Math.PI / 180;
        this.fanCursor = clamp(g.base - dx / (R * step), 0, this.fanList.length - 1);
        this.layoutFan(false);
      },
      onPointerUp: function (ev) {
        var g = this.drag;
        this.drag = null;
        if (!g) return;
        if (g.moved) { this.snapFan(); return; }
        var quick = Date.now() - g.t0 < 400;
        if (quick) this.drawCard(g.card);
        else this.drawCard(g.card);
      },
      onPointerCancel: function () { this.drag = null; },
      snapFan: function () {
        if (!window.gsap) { this.fanCursor = Math.round(this.fanCursor); return; }
        var self = this;
        var target = clamp(Math.round(this.fanCursor), 0, this.fanList.length - 1);
        var proxy = { v: this.fanCursor };
        window.gsap.to(proxy, {
          v: target, duration: 0.32, ease: 'power3.out',
          onUpdate: function () { self.fanCursor = proxy.v; self.layoutFan(false); }
        });
      },
      drawCard: function (card) {
        if (this.phase !== 'draw' || !card || card.slot >= 0) return;
        var spread = this.currentSpread;
        var idx = this.drawn.length;
        if (idx >= spread.cards.length) return;

        var list = this.fanList;
        var fanIndex = -1;
        for (var i = 0; i < list.length; i++) if (list[i].uid === card.uid) { fanIndex = i; break; }
        if (fanIndex < 0) return;

        card.slot = idx;
        this.drawn.push(card);
        if (fanIndex < this.fanCursor) this.fanCursor = Math.max(0, this.fanCursor - 1);
        this.fanHover = null;

        var self = this;
        var stage = this.$refs.stage;
        var W = stage.clientWidth || 600;
        var u = W / 100;
        var slot = spread.cards[idx];
        var el = stage.querySelector('.card-el[data-uid="' + card.uid + '"]');

        if (el && window.gsap) {
          var gsap = window.gsap;
          var fromX = gsap.getProperty(el, 'x') || 0;
          var fromY = gsap.getProperty(el, 'y') || 0;
          var toX = slot.x * u, toY = slot.y * u;
          var dist = Math.sqrt(Math.pow(toX - fromX, 2) + Math.pow(toY - fromY, 2));
          var total = dist < 160 ? 0.22 : (dist < 300 ? 0.32 : 0.42);
          var midX = (fromX + toX) / 2 + (toX > fromX ? 1 : -1) * Math.min(60, dist * 0.18);
          var midY = Math.min(fromY, toY) - Math.min(120, dist * 0.28);

          var tl = gsap.timeline({ onComplete: function () { el.style.zIndex = ''; } });
          tl.set(el, { zIndex: 12 });
          tl.to(el, { duration: total * 0.45, x: midX, y: midY, rotation: (slot.rot || 0) * 0.4, ease: 'power1.out' });
          tl.to(el, {
            duration: total * 0.55, x: toX, y: toY,
            rotation: slot.rot || 0, scale: slot.w / BASE_W, ease: 'power2.inOut'
          });
          if (dist > 200) {
            tl.to(el, { duration: 0.16, scale: (slot.w / BASE_W) * 1.06, ease: 'power2.out' }, '>-0.16');
            tl.to(el, { duration: 0.16, scale: slot.w / BASE_W, ease: 'power2.inOut' });
          }
        }

        this.$nextTick(function () {
          if (self.drawn.length >= spread.cards.length) self.finishDraw();
          else self.layoutFan(true);
        });
      },
      autoDraw: function () {
        if (this.phase !== 'draw') return;
        var self = this;
        if (this.autoTimer) clearInterval(this.autoTimer);
        this.autoTimer = setInterval(function () {
          if (self.phase !== 'draw' || self.remainingDraw <= 0) {
            clearInterval(self.autoTimer); self.autoTimer = null; return;
          }
          var list = self.fanList;
          if (!list.length) return;
          var center = clamp(Math.round(self.fanCursor), 0, list.length - 1);
          self.drawCard(list[center]);
        }, 460);
      },

      finishDraw: function () {
        var self = this;
        var spread = this.currentSpread;
        this.analysis = buildAnalysis(this.question.trim(), spread, this.drawn);
        this.phase = 'reveal';
        this.landed = spread.cards.length;

        var stage = this.$refs.stage;
        var map = this.elementMap();
        var drawnUids = {};
        this.drawn.forEach(function (d) { drawnUids[String(d.uid)] = 1; });
        var rest = [];
        Object.keys(map).forEach(function (uid) { if (!drawnUids[uid]) rest.push(map[uid]); });
        if (window.gsap && rest.length) {
          /* 先把牌扇遗留的补间全部杀掉，再统一淡出，否则会有漏网的牌留在桌上 */
          window.gsap.killTweensOf(rest);
          window.gsap.to(rest, {
            duration: 0.5, opacity: 0, scale: 0.86,
            stagger: { each: 0.006, from: 'random' }, ease: 'power2.in', overwrite: true,
            onComplete: function () { rest.forEach(function (el) { el.style.pointerEvents = 'none'; }); }
          });
        }
        this.$nextTick(function () {
          self.updateUnit();
          self.placeDealt();
          var t = self.$refs.table;
          if (t && t.scrollIntoView) t.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      },

      placeDealt: function () {
        var stage = this.$refs.stage;
        if (!stage || !window.gsap) return;
        var W = stage.clientWidth || 600;
        var u = W / 100;
        var spread = this.currentSpread;
        var map = this.elementMap();
        this.drawn.forEach(function (d) {
          var el = map[d.uid];
          var slot = spread.cards[d.slot];
          if (!el || !slot) return;
          window.gsap.set(el, {
            xPercent: -50, yPercent: -50, x: slot.x * u, y: slot.y * u,
            rotation: slot.rot || 0, scale: slot.w / BASE_W, opacity: 1, pointerEvents: 'auto'
          });
        });
      },

      /* ---------- 翻牌 ---------- */
      onCardClick: function (d, ev) {
        if (!this.canFlip(d)) return;
        var el = ev && ev.currentTarget ? ev.currentTarget : null;
        var inner = el ? el.querySelector('.card-inner') : null;
        var idx = d.slot;
        var self = this;

        d.flipped = true;
        if (this.analysis && this.analysis.lines[idx]) this.analysis.lines[idx].flipped = true;

        var done = function () {
          if (self.allFlipped) {
            self.phase = 'done';
            if (self.showAiCard && self.aiReady && self.aiState === 'idle') self.runAi();
          }
        };

        if (window.gsap && inner) {
          window.gsap.fromTo(inner, { rotationY: 0 },
            { rotationY: 180, duration: 0.44, ease: 'power2.inOut', onComplete: done });
          window.gsap.fromTo(el, { z: 0 }, { z: 70, duration: 0.36, yoyo: true, repeat: 1, ease: 'power2.out' });
        } else if (inner) {
          inner.style.transition = 'transform .44s ease';
          inner.style.transform = 'rotateY(180deg)';
          setTimeout(done, 460);
        } else { done(); }
      },

      /* ---------- 复位 ---------- */
      stopAnimation: function () {
        if (this.tl) { this.tl.kill(); this.tl = null; }
        var stage = this.$refs.stage;
        if (stage && window.gsap) {
          window.gsap.killTweensOf(stage.querySelectorAll('.card-el'));
          window.gsap.killTweensOf(stage.querySelectorAll('.card-inner'));
        }
      },
      resetDivination: function () {
        this.stopAnimation();
        if (this.autoTimer) { clearInterval(this.autoTimer); this.autoTimer = null; }
        if (this.aiAbort) { this.aiAbort.abort(); this.aiAbort = null; }
        this.visualDeck = [];
        this.drawn = [];
        this.analysis = null;
        this.landed = 0;
        this.fanHover = null;
        this.phase = 'idle';
        this.aiState = 'idle'; this.aiText = ''; this.aiError = '';
        var self = this;
        this.$nextTick(function () { self.updateUnit(); });
      },

      /* =========================================================
         AI 深度解读
         ========================================================= */
      applyPreset: function (key) {
        var p = AI.presetOf(key);
        this.aiForm.preset = key;
        if (p.base) this.aiForm.base = p.base;
        if (p.model) this.aiForm.model = p.model;
      },
      saveAi: function () {
        this.aiCfg = {
          preset: this.aiForm.preset, base: this.aiForm.base,
          model: this.aiForm.model, key: this.aiForm.key
        };
        saveAiCfg(this.aiCfg);
        if (!this.aiCfg.key) { this.aiTestMsg = '已清除本机保存的配置'; this.aiTestOk = false; }
      },
      testAi: function () {
        var self = this;
        this.saveAi();
        if (!this.aiReady) { this.aiTestOk = false; this.aiTestMsg = '请先填写接口地址与 API Key'; return; }
        this.aiTesting = true; this.aiTestMsg = '';
        AI.chat(this.aiCfg, [{ role: 'user', content: '请只回复两个字：已连接' }], function () {}, null)
          .then(function (t) {
            self.aiTesting = false; self.aiTestOk = true;
            self.aiTestMsg = '连接成功：' + String(t || '').trim().slice(0, 24);
          })
          .catch(function (e) {
            self.aiTesting = false; self.aiTestOk = false;
            self.aiTestMsg = String(e.message || e).slice(0, 160);
          });
      },
      runAi: function (force) {
        if (!this.aiReady) { this.aiOpen = true; return; }
        if (!this.question.trim() || !this.drawn.length) return;
        if (this.aiState === 'loading' && !force) return;
        if (this.aiAbort) this.aiAbort.abort();

        var self = this;
        var spread = this.currentSpread;
        var payload = {
          question: this.question.trim(),
          spreadName: spread.name,
          spreadSub: spread.sub,
          cards: this.drawn.map(function (d, i) {
            var card = byId[d.cardId] || FALLBACK_CARD;
            return {
              pos: spread.positions[i].pos, name: card.name, en: card.en,
              reversed: d.reversed, keywords: card.keywords || [],
              meaning: d.reversed ? card.reversed : card.upright
            };
          })
        };

        var ctrl = new AbortController();
        this.aiAbort = ctrl;
        this.aiState = 'loading';
        this.aiText = '';
        this.aiError = '';

        AI.chat(this.aiCfg, AI.buildMessages(payload), function (delta) {
          self.aiText += delta;
        }, ctrl.signal)
          .then(function (full) {
            if (self.aiAbort !== ctrl) return;
            self.aiState = 'done';
            if (!self.aiText && full) self.aiText = full;
          })
          .catch(function (e) {
            if (self.aiAbort !== ctrl || (e && e.name === 'AbortError')) return;
            self.aiState = 'error';
            self.aiError = String(e.message || e);
          });
      },
      copyAi: function () {
        var self = this;
        var text = this.aiText;
        var ok = function () { self.copyMsg = '已复制'; setTimeout(function () { self.copyMsg = ''; }, 1600); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(ok).catch(function () { self.fallbackCopy(text, ok); });
        } else { this.fallbackCopy(text, ok); }
      },
      fallbackCopy: function (text, ok) {
        try {
          var ta = document.createElement('textarea');
          ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta); ta.select(); document.execCommand('copy');
          document.body.removeChild(ta); ok();
        } catch (e) {}
      }
    }
  });

  var mount = function () {
    if (!window.Vue) {
      document.body.insertAdjacentHTML('afterbegin',
        '<div style="padding:60px 24px;text-align:center;color:#f5e2a8;font-family:Georgia,serif;line-height:2">' +
        '✦ 未能加载 Vue 3 运行库 ✦<br><span style="color:#bdb6d6;font-size:14px">' +
        '请确认 vendor/vue.global.prod.js 存在，或检查网络后刷新页面。</span></div>');
      return;
    }
    app.mount('#app');
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();