(function () {
    if (document.getElementById('kui-bulk-producer-root')) {
        alert('Bulk Producer UI is already open.'); return;
    }

    // ---------- API ----------
    const api = {
        async json(url, init) {
            const res = await fetch(url, { credentials: 'same-origin', ...init });
            if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
            return res.json();
        },
        async listClusters() {
            const rows = await this.json(`${location.origin}/api/clusters`);
            return rows.map(r => ({
                name: r.name || r.clusterName || r.id || String(r),
                brokers: r.brokersCount ?? r.brokers ?? r.brokerCount ?? null,
                partitions: r.partitions ?? null,
                version: r.version ?? r.kafkaVersion ?? null
            }));
        },
        async listAllTopics(cluster) {
            const origin = location.origin;
            const enc = encodeURIComponent(cluster);
            const perPage = 1000;
            const names = new Set();
            let page = 1;
            while (true) {
                const url = `${origin}/api/clusters/${enc}/topics?page=${page}&perPage=${perPage}`;
                let data;
                try { data = await this.json(url); }
                catch { break; }
                let items = [];
                if (Array.isArray(data)) items = data;
                else if (data?.data || data?.items)
                    items = data.data || data.items;
                else {
                    const arr = Object.values(data || {}).find(v => Array.isArray(v));
                    if (arr) items = arr;
                }
                items.forEach(x => names.add(x.name ?? x.topicName ?? x));
                const totalPages = data?.totalPages ?? data?.pageCount ?? null;
                if (totalPages != null) {
                    if (page >= totalPages) break;
                    page++;
                } else if (items.length < perPage) break;
                else page++;
            }
            return Array.from(names).filter(Boolean).sort();
        },
        async send(cluster, topic, partition, contentStr) {
            const url = `${location.origin}/api/clusters/${encodeURIComponent(cluster)}/topics/${encodeURIComponent(topic)}/messages`;
            const body = {
                partition, key: null,
                content: contentStr,
                keySerde: 'String', valueSerde: 'String'
            };
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'accept': '*/*', 'content-type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify(body)
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        }
    };

    const detectedCluster = (location.pathname.match(/\/ui\/clusters\/([^/]+)/) || [])[1];
    const detectedTopic = (location.pathname.match(/\/ui\/clusters\/[^/]+\/(?:all-)?topics\/([^/]+)/) || [])[1];

    // ---------- UI ----------
    const host = document.createElement('div');
    host.id = 'kui-bulk-producer-root';
    Object.assign(host.style, {
        position: 'fixed', inset: '20px 20px auto auto', zIndex: 2147483647,
        width: '700px', maxHeight: '85vh', overflow: 'hidden',
        borderRadius: '16px', boxShadow: '0 12px 24px rgba(0,0,0,.15)'
    });
    document.body.appendChild(host);
    const root = host.attachShadow({ mode: 'open' });

    root.innerHTML = `
      <style>
        * { box-sizing: border-box; font-family: Inter, system-ui, sans-serif; }
        .card { background:#ffffff; color:#111827; border:1px solid #d1d5db; padding:16px; border-radius:16px; }
        .title { font-size:17px; font-weight:700; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; color:#1f2937; }
        .row { margin:12px 0; }
        .hint { color:#6b7280; font-size:12px; }
        select, input, textarea {
          width:100%; background:#f9fafb; color:#111827; border:1px solid #d1d5db;
          border-radius:8px; padding:8px; font-size:14px;
        }
        select:disabled { background:#f3f4f6; color:#9ca3af; }
        textarea {
          min-height:160px; resize:vertical;
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        }
        .inline { display:flex; align-items:center; gap:6px; }
        .grid2 { display:grid; grid-template-columns: 1fr 160px; gap:10px; }
        .search { width:100%; margin:6px 0; }
        .count { color:#9ca3af; font-size:12px; margin-left:6px; }
        .status {
          max-height:140px; overflow:auto; border:1px solid #d1d5db;
          border-radius:8px; padding:8px; background:#f9fafb;
          font-family: ui-monospace, monospace; font-size:12px; white-space:pre-wrap;
        }
        .footer { display:flex; gap:8px; justify-content:flex-end; margin-top:10px; }
        button {
          border:none; padding:9px 14px; border-radius:8px; cursor:pointer; font-weight:600;
          font-size:14px; transition:background .15s;
        }
        button.primary { background:#2563eb; color:white; }
        button.primary:hover { background:#1d4ed8; }
        button.secondary { background:#e5e7eb; color:#111827; }
        button.secondary:hover { background:#d1d5db; }
        button:disabled { opacity:.5; cursor:not-allowed; }
        .close { background:#ef4444; color:white; }
        .close:hover { background:#dc2626; }
      </style>
      <div class="card">
        <div class="title">
          <span>Kafka UI – Bulk Producer</span>
          <button class="close" id="btnClose">✖</button>
        </div>
  
        <div class="row">
          <div class="hint">1) Cluster (type to search) <span id="clusterCount" class="count"></span></div>
          <input id="clusterSearch" class="search" placeholder="Search clusters…">
          <select id="clusterSel"><option>Loading clusters…</option></select>
        </div>
  
        <div class="row">
          <div class="hint">2) Topic (type to search) <span id="topicCount" class="count"></span></div>
          <input id="topicSearch" class="search" placeholder="Search topics (client-side)…">
          <div class="grid2">
            <select id="topicSel" disabled><option>Pick a cluster first…</option></select>
            <div class="inline">
              <input id="partInput" type="number" value="0" style="width:90px">
              <label class="hint"><input id="autoPart" type="checkbox"> auto/null</label>
            </div>
          </div>
        </div>
  
        <div class="row">
          <div class="hint">3) Paste NDJSON (one JSON per line)</div>
          <textarea id="msgBox" placeholder='{"messageType":"REQUEST","messageId":"mid","uri":"update","data":{"s":"ABC123","is":"KAFI"}}'></textarea>
        </div>
  
        <div class="row status" id="statusBox"></div>
  
        <div class="footer">
          <button class="primary" id="btnSend" disabled>Send</button>
        </div>
      </div>
    `;

    // ---------- Elements ----------
    const $ = id => root.getElementById(id);
    const els = {
        clusterSel: $('clusterSel'),
        clusterSearch: $('clusterSearch'),
        clusterCount: $('clusterCount'),
        topicSel: $('topicSel'),
        topicSearch: $('topicSearch'),
        topicCount: $('topicCount'),
        partInput: $('partInput'),
        autoPart: $('autoPart'),
        msgBox: $('msgBox'),
        status: $('statusBox'),
        btnSend: $('btnSend'),
        btnClose: $('btnClose'),
    };

    const log = (line) => {
        els.status.textContent += (els.status.textContent ? '\n' : '') + line;
        els.status.scrollTop = els.status.scrollHeight;
    };

    els.btnClose.onclick = () => host.remove();

    // ---------- Load clusters ----------
    let clustersAll = [];

    (async () => {
        try {
            clustersAll = await api.listClusters();
            renderClusterSelect(clustersAll);

            // Prefer cluster from URL if present, otherwise pick the first one
            const detected = detectedCluster ? decodeURIComponent(detectedCluster) : null;
            if (detected && clustersAll.some(c => c.name === detected)) {
                els.clusterSel.value = detected;
            } else if (els.clusterSel.options.length > 0) {
                els.clusterSel.selectedIndex = 0;         // <-- pick first cluster
            }

            // IMPORTANT: fire change so topics load immediately
            els.clusterSel.dispatchEvent(new Event('change'));

        } catch (e) {
            els.clusterSel.innerHTML = `<option>Error loading clusters: ${e.message}</option>`;
        }
    })();

    // Keep current selection when filtering; if selection disappears, select first and load topics
    function renderClusterSelect(list) {
        const prev = els.clusterSel.value;
        const filter = els.clusterSearch.value.trim().toLowerCase();
        const filtered = filter ? list.filter(c => c.name.toLowerCase().includes(filter)) : list;

        els.clusterSel.innerHTML = filtered.map(c => {
            const meta = [
                c.version ? `v${c.version}` : null,
                c.brokers != null ? `${c.brokers} brokers` : null,
                c.partitions != null ? `${c.partitions} partitions` : null
            ].filter(Boolean).join(' • ');
            return `<option value="${c.name}">${c.name}${meta ? ` — ${meta}` : ''}</option>`;
        }).join('');

        els.clusterCount.textContent = `${filtered.length}/${list.length}`;
        els.btnSend.disabled = !filtered.length;

        // restore selection if still visible; otherwise pick first (but don't auto-send until user stops typing)
        if (filtered.some(c => c.name === prev)) {
            els.clusterSel.value = prev;
        } else if (filtered.length) {
            els.clusterSel.selectedIndex = 0;
        }
    }
    els.clusterSearch.oninput = () => renderClusterSelect(clustersAll);

    // ---------- Cluster change → load topics ----------
    els.clusterSel.addEventListener('change', async () => {
        const cluster = els.clusterSel.value;
        els.topicSel.disabled = true;
        els.topicSel.innerHTML = `<option>Loading topics…</option>`;
        els.topicSearch.value = '';
        els.topicCount.textContent = '';
        els.btnSend.disabled = true;
        log(`Fetching topics for cluster "${cluster}"…`);

        try {
            const topics = await api.listAllTopics(cluster);
            if (!topics.length) {
                els.topicSel.innerHTML = `<option value="">(no topics found)</option>`;
                log('No topics found.'); return;
            }
            els.topicSel.dataset.allTopics = JSON.stringify(topics);
            filterTopics('');
            els.topicSel.disabled = false;
            els.btnSend.disabled = false;
            if (detectedTopic && topics.includes(decodeURIComponent(detectedTopic))) {
                els.topicSel.value = decodeURIComponent(detectedTopic);
            }
            log(`Loaded ${topics.length} topics.`);
        } catch (e) {
            els.topicSel.innerHTML = `<option>Error: ${e.message}</option>`;
            log(`❌ ${e.message}`);
        }
    });

    const filterTopics = (term) => {
        const all = JSON.parse(els.topicSel.dataset.allTopics || '[]');
        const t = term.trim().toLowerCase();
        const filtered = t ? all.filter(x => x.toLowerCase().includes(t)) : all;
        els.topicSel.innerHTML = filtered.map(x => `<option value="${x}">${x}</option>`).join('');
        els.topicCount.textContent = `${filtered.length}/${all.length}`;
    };
    els.topicSearch.oninput = () => filterTopics(els.topicSearch.value);

    els.autoPart.onchange = () => { els.partInput.disabled = els.autoPart.checked; };

    // ---------- Send ----------
    els.btnSend.onclick = async () => {
        const cluster = els.clusterSel.value;
        if (!cluster) return alert('Pick a cluster.');
        const topic = els.topicSel.value;
        if (!topic) return alert('Pick a topic.');
        const partition = els.autoPart.checked ? null : Number(els.partInput.value || 0);
        if (partition !== null && Number.isNaN(partition)) return alert('Partition must be a number.');
        const raw = els.msgBox.value || '';
        const lines = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        if (!lines.length) return alert('Paste at least one JSON line.');

        const payloads = [];
        for (let i = 0; i < lines.length; i++) {
            try {
                const obj = JSON.parse(lines[i]);
                const s = JSON.stringify(obj);
                payloads.push(s.endsWith('\n') ? s : s + '\n');
            } catch {
                alert(`Line ${i + 1} invalid JSON:\n${lines[i]}`);
                return;
            }
        }

        els.btnSend.disabled = true;
        log(`➡️ Cluster: ${cluster}`);
        log(`➡️ Topic: ${topic}`);
        log(`➡️ Partition: ${partition === null ? 'auto (null)' : partition}`);
        log(`➡️ Sending ${payloads.length} messages…`);

        try {
            for (let i = 0; i < payloads.length; i++) {
                await api.send(cluster, topic, partition, payloads[i]);
                log(`✅ [${i + 1}/${payloads.length}] sent`);
                await new Promise(r => setTimeout(r, 25));
            }
            log('🎉 Done. All messages sent.');
        } catch (e) {
            log(`❌ Error: ${e.message}`);
        } finally {
            els.btnSend.disabled = false;
        }
    };
})();
