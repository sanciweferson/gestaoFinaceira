// ─── STORAGE ──────────────────────────────────────────────
  const CH_MOV  = 'cf_movimentacoes_v4';
  const CH_PARC = 'cf_parcelamentos_v4';
  const CH_CFG  = 'cf_config_v2';

  let movimentacoes = JSON.parse(localStorage.getItem(CH_MOV))  || [];
  let parcelamentos  = JSON.parse(localStorage.getItem(CH_PARC)) || [];
  let graficoInstance = null;

  const CONFIG_PADRAO = {
    rendaMensal: 4750,
    limiteAlimentacao: 1000,
    metaDivida: 250
  };

  const CORES_CAT = {
    fixo:        '#58a6ff',
    alimentacao: '#d29922',
    transporte:  '#8b949e',
    saude:       '#3fb950',
    pessoal:     '#a78bfa',
    divida:      '#f85149',
    imprevisto:  '#fb923c',
    extra:       '#67e8f9',
  };

  // ─── UTILS ───────────────────────────────────────────────
  function fmt(v) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

  function fmtData(d) {
    if (!d) return '—';
    const [a, m, dia] = d.split('-');
    return `${dia}/${m}/${a}`;
  }

  // ─── CONFIGURAÇÕES PERSISTENTES ───────────────────────────
  // A configuração agora tem dois níveis:
  // 1) geral  -> usada quando não existe configuração do mês filtrado
  // 2) mensal -> sobrescreve a geral quando o usuário salva algo para um mês específico
  function lerStoreConfiguracoes() {
    const bruto = JSON.parse(localStorage.getItem(CH_CFG)) || {};

    return {
      geral: {
        rendaMensal: Number(bruto?.geral?.rendaMensal ?? bruto?.rendaMensal ?? CONFIG_PADRAO.rendaMensal),
        limiteAlimentacao: Number(bruto?.geral?.limiteAlimentacao ?? bruto?.limiteAlimentacao ?? CONFIG_PADRAO.limiteAlimentacao),
        metaDivida: Number(bruto?.geral?.metaDivida ?? bruto?.metaDivida ?? CONFIG_PADRAO.metaDivida)
      },
      mensal: bruto?.mensal || {}
    };
  }

  function salvarStoreConfiguracoes(store) {
    localStorage.setItem(CH_CFG, JSON.stringify(store));
  }

  function coletarConfiguracaoDaTela() {
    return {
      rendaMensal: Number(document.getElementById('rendaMensal').value) || 0,
      limiteAlimentacao: Number(document.getElementById('limiteAlimentacao').value) || 0,
      metaDivida: Number(document.getElementById('metaDivida').value) || 0
    };
  }

  function obterMesFiltrado() {
    return document.getElementById('filtroMes').value;
  }

  function obterConfiguracaoAtiva() {
    const store = lerStoreConfiguracoes();
    const mes = obterMesFiltrado();

    if (mes && store.mensal[mes]) {
      return {
        ...store.geral,
        ...store.mensal[mes],
        _origem: `mensal (${mes})`
      };
    }

    return {
      ...store.geral,
      _origem: 'padrão geral'
    };
  }

  function atualizarInfoConfiguracao() {
    const info = document.getElementById('configInfo');
    const store = lerStoreConfiguracoes();
    const mes = obterMesFiltrado();
    const temMes = !!(mes && store.mensal[mes]);

    if (mes) {
      info.textContent = temMes
        ? `Configuração ativa: mensal de ${mes}. Qualquer alteração nos campos só fica permanente quando você clicar em “Salvar para o mês filtrado”.`
        : `Configuração ativa: padrão geral. O mês ${mes} ainda não tem configuração própria.`;
      return;
    }

    info.textContent = 'Configuração ativa: padrão geral. Use “Salvar padrão” para manter os valores depois de atualizar a página.';
  }

  function aplicarConfiguracoesNaTela() {
    const config = obterConfiguracaoAtiva();

    document.getElementById('rendaMensal').value = config.rendaMensal;
    document.getElementById('limiteAlimentacao').value = config.limiteAlimentacao;
    document.getElementById('metaDivida').value = config.metaDivida;

    atualizarInfoConfiguracao();
  }

  function salvarConfiguracaoPadrao() {
    const store = lerStoreConfiguracoes();
    store.geral = coletarConfiguracaoDaTela();
    salvarStoreConfiguracoes(store);
    atualizarInfoConfiguracao();
    abrirModal('Configuração padrão salva com sucesso. Agora, quando você atualizar a página sem filtro de mês, esses valores continuam no site.', 'Configuração salva', 'sucesso');
  }

  function salvarConfiguracaoDoMes() {
    const mes = obterMesFiltrado();
    if (!mes) {
      return abrirModal('Escolha primeiro um mês no filtro para salvar uma configuração mensal.', 'Mês obrigatório', 'aviso');
    }

    const store = lerStoreConfiguracoes();
    store.mensal[mes] = coletarConfiguracaoDaTela();
    salvarStoreConfiguracoes(store);
    atualizarInfoConfiguracao();
    abrirModal(`Configuração do mês ${mes} salva com sucesso. Quando esse mês for selecionado, o sistema carregará esses valores automaticamente.`, 'Configuração mensal salva', 'sucesso');
  }

  async function resetarConfiguracaoAtual() {
    const mes = obterMesFiltrado();
    const store = lerStoreConfiguracoes();

    if (mes) {
      const ok = await confirmar(`Deseja remover a configuração personalizada do mês ${mes}? O sistema voltará a usar a configuração padrão geral nesse mês.`, 'Resetar mês');
      if (!ok) return;
      delete store.mensal[mes];
      salvarStoreConfiguracoes(store);
      aplicarConfiguracoesNaTela();
      atualizarTela();
      return abrirModal(`A configuração específica do mês ${mes} foi removida.`, 'Configuração resetada', 'sucesso');
    }

    const ok = await confirmar('Deseja restaurar a configuração padrão geral para os valores originais?', 'Resetar padrão');
    if (!ok) return;
    store.geral = { ...CONFIG_PADRAO };
    salvarStoreConfiguracoes(store);
    aplicarConfiguracoesNaTela();
    atualizarTela();
    abrirModal('A configuração padrão geral voltou para os valores originais.', 'Configuração resetada', 'sucesso');
  }

  function aoAlterarFiltroMes() {
    // Quando o mês muda, carregamos a configuração correta desse mês
    // antes de recalcular os cards e o restante da tela.
    aplicarConfiguracoesNaTela();
    atualizarTela();
  }

  function salvarDados() {
    localStorage.setItem(CH_MOV,  JSON.stringify(movimentacoes));
    localStorage.setItem(CH_PARC, JSON.stringify(parcelamentos));
  }

  function alternarTema() {
    const html = document.documentElement;
    const atual = html.getAttribute('data-tema');
    html.setAttribute('data-tema', atual === 'escuro' ? 'claro' : 'escuro');
    document.querySelector('.tema-btn').textContent = atual === 'escuro' ? '🌙' : '☀️';
    if (graficoInstance) {
      graficoInstance.destroy();
      graficoInstance = null;
      renderizarGrafico(calcularTotais().resumoCategorias);
    }
  }

  // ─── MODAL ───────────────────────────────────────────────
  function fecharModal() { document.getElementById('modalOverlay').classList.remove('ativo'); }

  // Abre o modal padrão do sistema.
  // Essa versão é usada para avisos, erros e sucessos simples.
  function abrirModal(msg, titulo = 'Aviso', tipo = 'aviso') {
    const box      = document.getElementById('modalBox');
    const tituloEl = document.getElementById('modalTitulo');
    const msgEl    = document.getElementById('modalMensagem');
    const iconeEl  = document.getElementById('modalIcone');
    const btnCanc  = document.getElementById('modalCancelar');
    const btnConf  = document.getElementById('modalConfirmar');
    const btnFech  = document.getElementById('modalFechar');
    const overlay  = document.getElementById('modalOverlay');

    // Reseta o modal para o modo normal.
    box.className = `modal ${tipo}`;
    box.classList.remove('modal-grande');

    tituloEl.textContent = titulo;

    // innerHTML permite exibir textos com quebra de linha ou HTML formatado.
    // Como aqui o conteúdo é gerado pelo próprio sistema, fica seguro usar.
    msgEl.innerHTML = msg;

    iconeEl.textContent  = tipo === 'sucesso' ? '✓' : tipo === 'erro' ? '✕' : '!';
    btnCanc.style.display = 'none';
    btnConf.textContent   = 'OK';
    overlay.classList.add('ativo');

    return new Promise(res => {
      btnFech.onclick = overlay.onclick = (e) => {
        if (e.target === overlay || e.target === btnFech) {
          fecharModal();
          res(false);
        }
      };

      btnConf.onclick = () => {
        fecharModal();
        res(true);
      };
    });
  }

  // Abre um modal maior, pensado para mostrar o relatório detalhado.
  function abrirModalRelatorio(html, titulo = 'Relatório PRO', tipo = 'aviso') {
    const box      = document.getElementById('modalBox');
    const tituloEl = document.getElementById('modalTitulo');
    const msgEl    = document.getElementById('modalMensagem');
    const iconeEl  = document.getElementById('modalIcone');
    const btnCanc  = document.getElementById('modalCancelar');
    const btnConf  = document.getElementById('modalConfirmar');
    const btnFech  = document.getElementById('modalFechar');
    const overlay  = document.getElementById('modalOverlay');

    // Aqui o box recebe a classe de modal grande.
    box.className = `modal modal-grande ${tipo}`;
    tituloEl.textContent = titulo;
    msgEl.innerHTML = html;
    iconeEl.textContent = '📊';

    btnCanc.style.display = 'none';
    btnConf.textContent   = 'Fechar';
    overlay.classList.add('ativo');

    return new Promise(res => {
      btnFech.onclick = overlay.onclick = (e) => {
        if (e.target === overlay || e.target === btnFech) {
          fecharModal();
          res(false);
        }
      };

      btnConf.onclick = () => {
        fecharModal();
        res(true);
      };
    });
  }

  function confirmar(msg, titulo = 'Confirmar') {
    const box     = document.getElementById('modalBox');
    const tituloEl= document.getElementById('modalTitulo');
    const msgEl   = document.getElementById('modalMensagem');
    const iconeEl = document.getElementById('modalIcone');
    const btnCanc = document.getElementById('modalCancelar');
    const btnConf = document.getElementById('modalConfirmar');
    const btnFech = document.getElementById('modalFechar');
    const overlay = document.getElementById('modalOverlay');

    box.className = 'modal aviso';
    tituloEl.textContent  = titulo;
    msgEl.textContent     = msg;
    iconeEl.textContent   = '?';
    btnCanc.style.display = 'inline-flex';
    btnConf.textContent   = 'Confirmar';
    overlay.classList.add('ativo');

    return new Promise(res => {
      const fechar = (v) => { fecharModal(); res(v); };
      btnFech.onclick  = () => fechar(false);
      btnCanc.onclick  = () => fechar(false);
      btnConf.onclick  = () => fechar(true);
      overlay.onclick  = (e) => { if (e.target === overlay) fechar(false); };
    });
  }

  // ─── PARCELAMENTOS ────────────────────────────────────────
  function montarDataVencimento(ano, mes, dia) {
    const ultimo = new Date(ano, mes, 0).getDate();
    return `${ano}-${String(mes).padStart(2,'0')}-${String(Math.min(dia, ultimo)).padStart(2,'0')}`;
  }

  function proximaDataParc(p) {
    if (p.parcelasPagas >= p.totalParcelas) return null;
    const base  = new Date(p.primeiraData + 'T12:00:00');
    const mesAbs = base.getFullYear() * 12 + base.getMonth() + p.parcelasPagas;
    const ano   = Math.floor(mesAbs / 12);
    const mes   = (mesAbs % 12) + 1;
    return montarDataVencimento(ano, mes, p.diaVencimento);
  }

  function gerarMovimentacoesParcelamentos() {
    return parcelamentos
      .filter(p => p.parcelasPagas < p.totalParcelas)
      .map(p => ({
        id: `auto-${p.id}`,
        descricao: p.descricao,
        valor: p.valorParcela,
        tipo: 'gasto',
        categoria: p.categoria,
        data: proximaDataParc(p),
        origem: 'parcelamento',
        parcelamentoId: p.id,
        parcelaAtual: p.parcelasPagas + 1,
        totalParcelas: p.totalParcelas
      }));
  }

  function todosLancamentos() {
    return [...movimentacoes, ...gerarMovimentacoesParcelamentos()];
  }

  function lancamentosFiltrados() {
    const tipo = document.getElementById('filtroTipo').value;
    const cat  = document.getElementById('filtroCategoria').value;
    const mes  = document.getElementById('filtroMes').value;

    return todosLancamentos()
      .filter(i =>
        (tipo === 'todos' || i.tipo === tipo) &&
        (cat  === 'todas' || i.categoria === cat) &&
        (!mes || (i.data && i.data.startsWith(mes)))
      )
      .sort((a, b) => (a.data || '').localeCompare(b.data || ''));
  }

  // ─── CÁLCULOS ─────────────────────────────────────────────
  function calcularTotais() {
    const rendaBase       = Number(document.getElementById('rendaMensal').value) || 0;
    const filtroMes       = document.getElementById('filtroMes').value;
    const itens           = lancamentosFiltrados();
    let totalEntradas     = filtroMes ? rendaBase : rendaBase;
    let totalGastos       = 0;
    let totalAlimentacao  = 0;
    const resumoCategorias = {};

    for (const i of itens) {
      if (i.tipo === 'entrada') {
        totalEntradas += i.valor;
      } else {
        totalGastos += i.valor;
        resumoCategorias[i.categoria] = (resumoCategorias[i.categoria] || 0) + i.valor;
        if (i.categoria === 'alimentacao') totalAlimentacao += i.valor;
      }
    }

    return { totalEntradas, totalGastos, saldo: totalEntradas - totalGastos, totalAlimentacao, resumoCategorias };
  }

  // ─── RENDER RESUMO ────────────────────────────────────────
  function atualizarResumoCards() {
    const t = calcularTotais();
    const lim = Number(document.getElementById('limiteAlimentacao').value) || 0;
    const saldoClass = t.saldo >= 0 ? 'positivo' : 'negativo';

    document.getElementById('resumoCards').innerHTML = `
      <div class="resumo-card receita">
        <div class="resumo-label">Receitas totais</div>
        <div class="resumo-valor positivo">${fmt(t.totalEntradas)}</div>
        <div class="resumo-sub">Inclui renda base configurada</div>
      </div>
      <div class="resumo-card despesa">
        <div class="resumo-label">Despesas totais</div>
        <div class="resumo-valor negativo">${fmt(t.totalGastos)}</div>
        <div class="resumo-sub">${Object.keys(t.resumoCategorias).length} categoria(s)</div>
      </div>
      <div class="resumo-card saldo">
        <div class="resumo-label">Saldo do período</div>
        <div class="resumo-valor ${saldoClass}">${fmt(t.saldo)}</div>
        <div class="resumo-sub">${t.saldo >= 0 ? '✓ Positivo' : '✕ Negativo'}</div>
      </div>
      <div class="resumo-card alimento">
        <div class="resumo-label">Alimentação</div>
        <div class="resumo-valor">${fmt(t.totalAlimentacao)}</div>
        <div class="resumo-sub">Limite: ${fmt(lim)}</div>
      </div>
    `;
  }

  function atualizarAlertas() {
    const t   = calcularTotais();
    const lim = Number(document.getElementById('limiteAlimentacao').value) || 0;
    const meta= Number(document.getElementById('metaDivida').value) || 0;
    const dividas = t.resumoCategorias.divida || 0;
    const alertas = [];

    if (t.totalAlimentacao > lim && lim > 0)
      alertas.push({ tipo: 'danger', msg: `⚠ Alimentação acima do limite: ${fmt(t.totalAlimentacao)} de ${fmt(lim)} permitidos.` });
    if (dividas < meta && meta > 0)
      alertas.push({ tipo: 'warning', msg: `⚠ Dívidas pagas: ${fmt(dividas)}. Meta definida: ${fmt(meta)}.` });
    if (t.saldo < 0)
      alertas.push({ tipo: 'danger', msg: `⚠ Saldo negativo no período filtrado: ${fmt(t.saldo)}.` });

    document.getElementById('alertasContainer').innerHTML =
      alertas.map(a => `<div class="alerta-box ${a.tipo}" style="margin-bottom:12px">${a.msg}</div>`).join('');
  }

  function atualizarProgressBars() {
    const t    = calcularTotais();
    const lim  = Number(document.getElementById('limiteAlimentacao').value) || 0;
    const meta = Number(document.getElementById('metaDivida').value) || 0;
    const dividas = t.resumoCategorias.divida || 0;
    let html = '';

    if (lim > 0) {
      const pct = Math.min((t.totalAlimentacao / lim) * 100, 100);
      const cls = pct >= 100 ? 'excesso' : pct >= 80 ? 'alerta' : 'ok';
      html += `
        <div style="margin-bottom:14px">
          <div class="progress-label">
            <span>Limite de alimentação</span>
            <span>${fmt(t.totalAlimentacao)} / ${fmt(lim)} (${pct.toFixed(0)}%)</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill ${cls}" style="width:${pct}%"></div>
          </div>
        </div>`;
    }

    if (meta > 0) {
      const pct = Math.min((dividas / meta) * 100, 100);
      const cls = pct >= 100 ? 'ok' : pct >= 50 ? 'alerta' : 'excesso';
      html += `
        <div>
          <div class="progress-label">
            <span>Meta de pagamento de dívidas</span>
            <span>${fmt(dividas)} / ${fmt(meta)} (${pct.toFixed(0)}%)</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill ${cls}" style="width:${pct}%"></div>
          </div>
        </div>`;
    }

    document.getElementById('progressBars').innerHTML = html || '<p style="color:var(--text3);font-size:.82rem">Configure limites acima para ver as barras de progresso.</p>';
  }

  // ─── GRÁFICO ──────────────────────────────────────────────
  function renderizarGrafico(resumoCategorias) {
    const container = document.getElementById('chartContainer');
    const cats = Object.keys(resumoCategorias);

    if (!cats.length) {
      if (graficoInstance) { graficoInstance.destroy(); graficoInstance = null; }
      container.innerHTML = '<div class="empty">Nenhum gasto registrado para exibir o gráfico.</div>';
      return;
    }

    const total   = Object.values(resumoCategorias).reduce((a, b) => a + b, 0);
    const cores   = cats.map(c => CORES_CAT[c] || '#8b949e');
    const valores = cats.map(c => resumoCategorias[c]);

    if (graficoInstance) { graficoInstance.destroy(); graficoInstance = null; }

    const isDark = document.documentElement.getAttribute('data-tema') !== 'claro';

    container.innerHTML = `
      <div class="chart-grid">
        <div class="chart-canvas-wrap"><canvas id="donutChart"></canvas></div>
        <div class="chart-legenda" id="chartLegenda"></div>
      </div>`;

    const ctx = document.getElementById('donutChart').getContext('2d');
    graficoInstance = new Chart(ctx, {
      type: 'doughnut',
      data: { labels: cats, datasets: [{ data: valores, backgroundColor: cores, borderWidth: 2, borderColor: isDark ? '#161b22' : '#ffffff', hoverOffset: 8 }] },
      options: {
        cutout: '68%',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ${fmt(ctx.raw)} (${((ctx.raw / total) * 100).toFixed(1)}%)` } }
        }
      }
    });

    document.getElementById('chartLegenda').innerHTML = cats.map((c, i) => `
      <div class="legenda-item">
        <div class="legenda-cor" style="background:${cores[i]}"></div>
        <span class="legenda-nome">${c}</span>
        <span class="legenda-valor">${fmt(valores[i])}</span>
        <span class="legenda-pct">${((valores[i] / total) * 100).toFixed(1)}%</span>
      </div>`).join('');
  }

  // ─── PARCELAMENTOS UI ─────────────────────────────────────
  function atualizarParcelamentos() {
    const container = document.getElementById('listaParcelamentos');

    if (!parcelamentos.length) {
      container.innerHTML = '<div class="empty">Nenhum parcelamento cadastrado.</div>';
      return;
    }

    container.innerHTML = parcelamentos.map(p => {
      const finalizado = p.parcelasPagas >= p.totalParcelas;
      const proxData   = proximaDataParc(p);
      const pct        = (p.parcelasPagas / p.totalParcelas) * 100;
      const statusCls  = finalizado ? 'status-finalizado' : 'status-pendente';
      const statusTxt  = finalizado ? '✓ Concluído' : `Faltam ${p.totalParcelas - p.parcelasPagas}`;

      return `
        <div class="parc-item">
          <div class="parc-top">
            <div>
              <div class="parc-desc">${p.descricao}</div>
              <div class="parc-meta">
                Parcela ${p.parcelasPagas}/${p.totalParcelas} &nbsp;·&nbsp;
                Próximo: ${proxData ? fmtData(proxData) : '—'} &nbsp;·&nbsp;
                <span class="${statusCls}">${statusTxt}</span>
              </div>
            </div>
            <div style="text-align:right">
              <div class="parc-valor">${fmt(p.valorParcela)}/parc</div>
              <div class="acoes" style="margin-top:8px;justify-content:flex-end">
                <button class="btn-primary" onclick="marcarParcelaComoPaga(${p.id})" ${finalizado ? 'disabled' : ''}>✓ Pago</button>
                <button class="btn-danger"  onclick="removerParcelamento(${p.id})">🗑</button>
              </div>
            </div>
          </div>
          <div class="parc-progress">
            <div class="parc-progress-label">
              <span>Progresso</span><span>${pct.toFixed(0)}%</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill ${finalizado ? 'ok' : 'alerta'}" style="width:${pct}%"></div>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  // ─── TABELA LANÇAMENTOS ───────────────────────────────────
  function togglePago(id) {
    const item = movimentacoes.find(m => m.id === id);
    if (!item) return;
    item.pago = !item.pago;
    salvarDados();
    atualizarTela();
  }

  function atualizarLista() {
    const tbody = document.getElementById('listaMovimentacoes');
    const itens = lancamentosFiltrados();
    tbody.innerHTML = '';

    if (!itens.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:32px">Nenhum lançamento encontrado com os filtros atuais.</td></tr>';
      return;
    }

    for (const item of itens) {
      const isParc    = item.origem === 'parcelamento';
      const isGasto   = item.tipo === 'gasto';
      const origemTxt = isParc ? `Parcela ${item.parcelaAtual}/${item.totalParcelas}` : 'Manual';
      const valCls    = item.tipo === 'entrada' ? 'valor-pos' : 'valor-neg';
      const valSinal  = item.tipo === 'entrada' ? '+' : '−';

      // Botão pago/pendente só para gastos manuais
      let btnStatusHTML = '';
      if (isGasto && !isParc) {
        const pago = !!item.pago;
        btnStatusHTML = pago
          ? `<button class="btn-pago"     onclick="togglePago(${item.id})">✓ Pago</button>`
          : `<button class="btn-pendente" onclick="togglePago(${item.id})">✗ Pendente</button>`;
      }

      const acoesManuais = !isParc
        ? `<button class="btn-ghost"  onclick="editarMovimentacao(${item.id})">✎ Editar</button>
           <button class="btn-danger" onclick="removerMovimentacao(${item.id})">🗑</button>`
        : `<button class="btn-primary" onclick="marcarParcelaComoPaga(${item.parcelamentoId})">✓ Pago</button>`;

      const tr = document.createElement('tr');
      if (isGasto && !isParc && item.pago) tr.classList.add('linha-paga');

      tr.innerHTML = `
        <td>${item.descricao}</td>
        <td><span class="tag tag-${item.tipo}">${item.tipo}</span></td>
        <td><span class="tag tag-${item.categoria}">${item.categoria}</span></td>
        <td style="color:var(--text2)">${fmtData(item.data)}</td>
        <td><span class="${valCls}">${valSinal} ${fmt(item.valor)}</span></td>
        <td style="color:var(--text3);font-size:.78rem">${origemTxt}</td>
        <td><div class="acoes">${btnStatusHTML}${acoesManuais}</div></td>
      `;
      tbody.appendChild(tr);
    }
  }

  // ─── FILTROS INFO ─────────────────────────────────────────
  function atualizarInfoFiltros() {
    const tipo = document.getElementById('filtroTipo').value;
    const cat  = document.getElementById('filtroCategoria').value;
    const mes  = document.getElementById('filtroMes').value;
    const p    = [];

    if (tipo !== 'todos') p.push(`tipo: ${tipo}`);
    if (cat  !== 'todas') p.push(`categoria: ${cat}`);
    if (mes)              p.push(`mês: ${mes}`);

    document.getElementById('filtrosInfo').textContent =
      p.length ? `Filtros ativos: ${p.join('  ·  ')}` : 'Exibindo todos os lançamentos.';
  }

  // ─── ATUALIZAR TELA ───────────────────────────────────────
  function atualizarTela() {
    atualizarInfoFiltros();
    atualizarResumoCards();
    atualizarAlertas();
    atualizarProgressBars();
    renderizarGrafico(calcularTotais().resumoCategorias);
    atualizarParcelamentos();
    atualizarLista();
  }

  // ─── CRUD LANÇAMENTOS ─────────────────────────────────────
  function salvarMovimentacao() {
    const editId = document.getElementById('editandoId').value;
    const descr  = document.getElementById('descricao').value.trim();
    const valor  = Number(document.getElementById('valor').value);
    const tipo   = document.getElementById('tipo').value;
    const cat    = document.getElementById('categoria').value;
    const data   = document.getElementById('data').value;

    if (!descr)          return abrirModal('Informe uma descrição.', 'Campo obrigatório', 'erro');
    if (!valor || valor <= 0) return abrirModal('Informe um valor maior que zero.', 'Valor inválido', 'erro');
    if (!data)           return abrirModal('Informe a data.', 'Campo obrigatório', 'erro');

    const dados = { descricao: descr, valor, tipo, categoria: cat, data, origem: 'manual' };

    if (editId) {
      movimentacoes = movimentacoes.map(i => i.id === Number(editId) ? { ...i, ...dados } : i);
    } else {
      // novos gastos começam como pendente
      movimentacoes.push({ id: Date.now(), pago: false, ...dados });
    }

    salvarDados();
    limparFormulario();
    atualizarTela();
  }

  function limparFormulario() {
    ['descricao','valor','data'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('tipo').value      = 'gasto';
    document.getElementById('categoria').value = 'fixo';
    document.getElementById('editandoId').value = '';
    document.getElementById('btnSalvarLancamento').textContent = '＋ Registrar';
  }

  function editarMovimentacao(id) {
    const item = movimentacoes.find(m => m.id === id);
    if (!item) return;
    document.getElementById('descricao').value  = item.descricao;
    document.getElementById('valor').value      = item.valor;
    document.getElementById('tipo').value       = item.tipo;
    document.getElementById('categoria').value  = item.categoria;
    document.getElementById('data').value       = item.data || '';
    document.getElementById('editandoId').value = item.id;
    document.getElementById('btnSalvarLancamento').textContent = '✓ Salvar alterações';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function removerMovimentacao(id) {
    confirmar('Deseja excluir este lançamento?', 'Excluir').then(ok => {
      if (!ok) return;
      movimentacoes = movimentacoes.filter(i => i.id !== id);
      salvarDados();
      atualizarTela();
    });
  }

  async function limparTudo() {
    const ok = await confirmar('Todos os lançamentos e parcelamentos serão removidos permanentemente.', 'Excluir tudo');
    if (!ok) return;
    movimentacoes = [];
    parcelamentos = [];
    salvarDados();
    atualizarTela();
  }

  // ─── CRUD PARCELAMENTOS ───────────────────────────────────
  function adicionarParcelamentoAutomatico() {
    const descr  = document.getElementById('parcDescricao').value.trim();
    const valor  = Number(document.getElementById('parcValor').value);
    const cat    = document.getElementById('parcCategoria').value;
    const total  = Number(document.getElementById('parcTotal').value);
    const pagas  = Number(document.getElementById('parcPagas').value);
    const data   = document.getElementById('parcPrimeiraData').value;
    const dia    = Number(document.getElementById('parcDiaVencimento').value);

    if (!descr || !valor || !data || !total || dia <= 0)
      return abrirModal('Preencha todos os campos do parcelamento.', 'Dados incompletos', 'erro');
    if (pagas < 0 || pagas > total)
      return abrirModal('Parcelas pagas deve ficar entre 0 e o total.', 'Valor inválido', 'erro');

    parcelamentos.push({ id: Date.now(), descricao: descr, valorParcela: valor, categoria: cat, totalParcelas: total, parcelasPagas: pagas, primeiraData: data, diaVencimento: dia });
    salvarDados();

    ['parcDescricao','parcValor','parcPrimeiraData'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('parcCategoria').value     = 'divida';
    document.getElementById('parcTotal').value         = 1;
    document.getElementById('parcPagas').value         = 0;
    document.getElementById('parcDiaVencimento').value = 10;

    atualizarTela();
    abrirModal('Parcelamento cadastrado com sucesso!', 'Concluído', 'sucesso');
  }

  function marcarParcelaComoPaga(id) {
    const p = parcelamentos.find(x => x.id === id);
    if (!p) return;
    if (p.parcelasPagas >= p.totalParcelas)
      return abrirModal('Este parcelamento já foi concluído.', 'Informação', 'aviso');

    p.parcelasPagas += 1;
    salvarDados();
    atualizarTela();
    abrirModal(`Parcela registrada! ${p.descricao}: ${p.parcelasPagas}/${p.totalParcelas}`, 'Pagamento registrado', 'sucesso');
  }

  function removerParcelamento(id) {
    confirmar('Deseja excluir este parcelamento?', 'Excluir parcelamento').then(ok => {
      if (!ok) return;
      parcelamentos = parcelamentos.filter(p => p.id !== id);
      salvarDados();
      atualizarTela();
    });
  }

  // ─── FILTROS ──────────────────────────────────────────────
  function limparFiltros() {
    document.getElementById('filtroTipo').value      = 'todos';
    document.getElementById('filtroCategoria').value = 'todas';
    document.getElementById('filtroMes').value       = '';
    aplicarConfiguracoesNaTela();
    atualizarTela();
  }

  // ─── RELATÓRIO PRO ────────────────────────────────────────
  // Monta um texto curto mostrando quais filtros estão ativos no momento.
  // Isso ajuda o usuário a entender sobre qual período o relatório foi gerado.
  function textoPeriodoFiltro() {
    const mes = document.getElementById('filtroMes').value;
    const tipo = document.getElementById('filtroTipo').value;
    const categoria = document.getElementById('filtroCategoria').value;

    const partes = [];

    if (mes) {
      const [ano, m] = mes.split('-');
      partes.push(`Mês filtrado: ${m}/${ano}`);
    } else {
      partes.push('Período: todos os meses');
    }

    partes.push(`Tipo: ${tipo === 'todos' ? 'todos' : tipo}`);
    partes.push(`Categoria: ${categoria === 'todas' ? 'todas' : categoria}`);

    return partes.join(' · ');
  }

  // Soma os gastos manuais marcados como pagos e pendentes.
  // Parcelamentos automáticos ficam de fora porque já possuem um fluxo próprio.
  function obterResumoPagamentosManuais(itens) {
    let totalPago = 0;
    let totalPendente = 0;
    let qtdPago = 0;
    let qtdPendente = 0;

    for (const item of itens) {
      if (item.tipo === 'gasto' && item.origem !== 'parcelamento') {
        if (item.pago) {
          totalPago += item.valor;
          qtdPago++;
        } else {
          totalPendente += item.valor;
          qtdPendente++;
        }
      }
    }

    return { totalPago, totalPendente, qtdPago, qtdPendente };
  }

  // Ordena as categorias do maior para o menor valor.
  // O parâmetro limite controla quantas categorias aparecem no relatório.
  function obterTopCategorias(resumoCategorias, limite = 5) {
    return Object.entries(resumoCategorias)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limite);
  }

  // Seleciona apenas os gastos e retorna os maiores valores.
  // Isso serve para mostrar os maiores impactos do período.
  function obterMaioresGastos(itens, limite = 5) {
    return itens
      .filter(item => item.tipo === 'gasto')
      .sort((a, b) => b.valor - a.valor)
      .slice(0, limite);
  }

  // Faz o download de um arquivo TXT com o conteúdo do relatório.
  function baixarRelatorioTXT(conteudo, nomeArquivo = null) {
    const blob = new Blob([conteudo], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');

    a.href = url;
    a.download = nomeArquivo || `relatorio-financeiro-${new Date().toISOString().slice(0,10)}.txt`;
    a.click();

    URL.revokeObjectURL(url);
  }

  // Gera a versão visual do relatório e mostra no modal grande.
  function gerarRelatorioPro() {
    const itens = lancamentosFiltrados();
    const totais = calcularTotais();
    const pagamentos = obterResumoPagamentosManuais(itens);
    const topCategorias = obterTopCategorias(totais.resumoCategorias, 5);
    const maioresGastos = obterMaioresGastos(itens, 5);

    // Separa parcelamentos ativos dos já concluídos.
    const parcelamentosAtivos = parcelamentos.filter(p => p.parcelasPagas < p.totalParcelas);
    const parcelamentosConcluidos = parcelamentos.filter(p => p.parcelasPagas >= p.totalParcelas);

    const qtdEntradas = itens.filter(i => i.tipo === 'entrada').length;
    const qtdGastos = itens.filter(i => i.tipo === 'gasto').length;

    const saldoClass = totais.saldo >= 0 ? 'positivo' : 'negativo';

    // Monta a lista HTML das categorias com maior gasto.
    const topCategoriasHTML = topCategorias.length
      ? `
        <div class="relatorio-lista">
          ${topCategorias.map(([categoria, valor], index) => `
            <div class="relatorio-item">
              <div class="relatorio-item-left">
                <div class="relatorio-item-titulo">#${index + 1} · ${categoria}</div>
                <div class="relatorio-item-sub">Participação nas despesas</div>
              </div>
              <div class="relatorio-item-valor">${fmt(valor)}</div>
            </div>
          `).join('')}
        </div>
      `
      : `<div class="relatorio-vazio">Nenhuma categoria de gasto encontrada no filtro atual.</div>`;

    // Monta a lista HTML dos maiores gastos do período.
    const maioresGastosHTML = maioresGastos.length
      ? `
        <div class="relatorio-lista">
          ${maioresGastos.map(item => `
            <div class="relatorio-item">
              <div class="relatorio-item-left">
                <div class="relatorio-item-titulo">${item.descricao}</div>
                <div class="relatorio-item-sub">
                  ${item.categoria} · ${fmtData(item.data)} · ${item.origem === 'parcelamento' ? 'Parcelamento' : 'Manual'}
                </div>
              </div>
              <div class="relatorio-item-valor">${fmt(item.valor)}</div>
            </div>
          `).join('')}
        </div>
      `
      : `<div class="relatorio-vazio">Nenhum gasto encontrado no filtro atual.</div>`;

    // HTML final do relatório mostrado no modal.
    const html = `
      <div class="relatorio-pro">
        <div class="relatorio-header">
          <div>
            <div class="relatorio-app-badge">💼 Relatório profissional · pronto para impressão</div>
            <h4>Resumo financeiro detalhado</h4>
            <p>${textoPeriodoFiltro()}</p>
          </div>
          <div class="relatorio-header-acoes">
            <button class="btn-dark" onclick="exportarRelatorioPDFProfissional()">🖨 Gerar PDF</button>
            <button class="btn-success" onclick="exportarRelatorioProTXT()">⬇ Baixar TXT</button>
          </div>
        </div>

        <div class="relatorio-bloco">
          <h5>Visão geral</h5>
          <div class="relatorio-metricas">
            <div class="relatorio-metrica">
              <div class="label">Receitas</div>
              <div class="valor positivo">${fmt(totais.totalEntradas)}</div>
            </div>
            <div class="relatorio-metrica">
              <div class="label">Despesas</div>
              <div class="valor negativo">${fmt(totais.totalGastos)}</div>
            </div>
            <div class="relatorio-metrica">
              <div class="label">Saldo</div>
              <div class="valor ${saldoClass}">${fmt(totais.saldo)}</div>
            </div>
            <div class="relatorio-metrica">
              <div class="label">Lançamentos</div>
              <div class="valor">${itens.length}</div>
            </div>
            <div class="relatorio-metrica">
              <div class="label">Entradas</div>
              <div class="valor">${qtdEntradas}</div>
            </div>
            <div class="relatorio-metrica">
              <div class="label">Gastos</div>
              <div class="valor">${qtdGastos}</div>
            </div>
          </div>
        </div>

        <div class="relatorio-bloco">
          <h5>Status dos gastos manuais</h5>
          <div class="relatorio-metricas">
            <div class="relatorio-metrica">
              <div class="label">Total pago</div>
              <div class="valor positivo">${fmt(pagamentos.totalPago)}</div>
            </div>
            <div class="relatorio-metrica">
              <div class="label">Total pendente</div>
              <div class="valor negativo">${fmt(pagamentos.totalPendente)}</div>
            </div>
            <div class="relatorio-metrica">
              <div class="label">Qtd. pagos</div>
              <div class="valor">${pagamentos.qtdPago}</div>
            </div>
            <div class="relatorio-metrica">
              <div class="label">Qtd. pendentes</div>
              <div class="valor">${pagamentos.qtdPendente}</div>
            </div>
          </div>
        </div>

        <div class="relatorio-bloco">
          <h5>Parcelamentos</h5>
          <div class="relatorio-metricas">
            <div class="relatorio-metrica">
              <div class="label">Ativos</div>
              <div class="valor">${parcelamentosAtivos.length}</div>
            </div>
            <div class="relatorio-metrica">
              <div class="label">Concluídos</div>
              <div class="valor">${parcelamentosConcluidos.length}</div>
            </div>
            <div class="relatorio-metrica">
              <div class="label">Total cadastrados</div>
              <div class="valor">${parcelamentos.length}</div>
            </div>
          </div>
        </div>

        <div class="relatorio-bloco">
          <h5>Top categorias</h5>
          ${topCategoriasHTML}
        </div>

        <div class="relatorio-bloco">
          <h5>Maiores gastos</h5>
          ${maioresGastosHTML}
        </div>
      </div>
    `;

    abrirModalRelatorio(html, 'Relatório PRO', 'aviso');
  }


  // Escapa textos para poder montar HTML com segurança na janela de impressão.
  // Isso evita quebrar o layout caso alguma descrição tenha caracteres especiais.
  function escaparHtml(texto) {
    return String(texto ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  // Centraliza os dados do relatório em um único objeto.
  // Assim a versão visual, a versão TXT e a versão PDF usam a mesma base.
  function montarDadosRelatorioPro() {
    const itens = lancamentosFiltrados();
    const totais = calcularTotais();
    const pagamentos = obterResumoPagamentosManuais(itens);
    const topCategorias = obterTopCategorias(totais.resumoCategorias, 5);
    const maioresGastos = obterMaioresGastos(itens, 5);
    const parcelamentosAtivos = parcelamentos.filter(p => p.parcelasPagas < p.totalParcelas);
    const parcelamentosConcluidos = parcelamentos.filter(p => p.parcelasPagas >= p.totalParcelas);
    const qtdEntradas = itens.filter(i => i.tipo === 'entrada').length;
    const qtdGastos = itens.filter(i => i.tipo === 'gasto').length;
    const mes = document.getElementById('filtroMes').value;
    const agora = new Date();

    return {
      itens,
      totais,
      pagamentos,
      topCategorias,
      maioresGastos,
      parcelamentosAtivos,
      parcelamentosConcluidos,
      qtdEntradas,
      qtdGastos,
      periodo: textoPeriodoFiltro(),
      mes,
      dataGeracao: agora.toLocaleDateString('pt-BR'),
      horaGeracao: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };
  }

  // Monta o HTML completo que será usado na janela de impressão/PDF.
  // A ideia é abrir uma página limpa, com cabeçalho bonito e layout pronto para "Salvar como PDF".
  function gerarHTMLRelatorioProfissional() {
    const dados = montarDadosRelatorioPro();
    const saldoClass = dados.totais.saldo >= 0 ? 'positivo' : 'negativo';

    const topCategoriasRows = dados.topCategorias.length
      ? dados.topCategorias.map(([categoria, valor], index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${escaparHtml(categoria)}</td>
            <td>${fmt(valor)}</td>
          </tr>
        `).join('')
      : `<tr><td colspan="3">Nenhuma categoria encontrada no período.</td></tr>`;

    const maioresGastosRows = dados.maioresGastos.length
      ? dados.maioresGastos.map((item, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${escaparHtml(item.descricao)}</td>
            <td>${escaparHtml(item.categoria)}</td>
            <td>${fmtData(item.data)}</td>
            <td>${item.origem === 'parcelamento' ? 'Parcelamento' : 'Manual'}</td>
            <td>${fmt(item.valor)}</td>
          </tr>
        `).join('')
      : `<tr><td colspan="6">Nenhum gasto encontrado no período.</td></tr>`;

    const ultimosLancamentosRows = dados.itens.length
      ? [...dados.itens]
          .sort((a, b) => (b.data || '').localeCompare(a.data || ''))
          .slice(0, 10)
          .map(item => `
            <tr>
              <td>${escaparHtml(item.descricao)}</td>
              <td>${item.tipo}</td>
              <td>${escaparHtml(item.categoria)}</td>
              <td>${fmtData(item.data)}</td>
              <td>${item.origem === 'parcelamento' ? 'Parcelamento' : 'Manual'}</td>
              <td>${item.tipo === 'gasto' && item.origem !== 'parcelamento' ? (item.pago ? 'Pago' : 'Pendente') : '—'}</td>
              <td>${fmt(item.valor)}</td>
            </tr>
          `).join('')
      : `<tr><td colspan="7">Nenhum lançamento encontrado no período.</td></tr>`;

    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Relatório Financeiro Profissional</title>
  <style>
    :root {
      --bg: #eef3f8;
      --paper: #ffffff;
      --surface: #f8fafc;
      --border: #dbe3ee;
      --text: #0f172a;
      --muted: #64748b;
      --primary: #2563eb;
      --success: #16a34a;
      --danger: #dc2626;
      --warning: #d97706;
      --shadow: 0 20px 50px rgba(15, 23, 42, .08);
      --radius: 18px;
      --mono: "DM Mono", monospace;
      --font: "DM Sans", Arial, sans-serif;
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: var(--font);
      padding: 28px;
    }

    .page {
      max-width: 1100px;
      margin: 0 auto;
      background: var(--paper);
      border-radius: 24px;
      box-shadow: var(--shadow);
      overflow: hidden;
      border: 1px solid rgba(37,99,235,.08);
    }

    .hero {
      padding: 34px 40px 28px;
      background:
        radial-gradient(circle at top right, rgba(37,99,235,.14), transparent 28%),
        radial-gradient(circle at top left, rgba(22,163,74,.12), transparent 24%),
        linear-gradient(135deg, #0f172a, #16243d 62%, #1e3a8a);
      color: #fff;
    }

    .hero-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      flex-wrap: wrap;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .brand-logo {
      width: 52px;
      height: 52px;
      border-radius: 16px;
      display: grid;
      place-items: center;
      background: rgba(255,255,255,.12);
      border: 1px solid rgba(255,255,255,.16);
      font-size: 1.4rem;
      backdrop-filter: blur(10px);
    }

    .brand-kicker {
      font-size: .8rem;
      text-transform: uppercase;
      letter-spacing: .12em;
      opacity: .78;
      margin-bottom: 6px;
    }

    .brand h1 {
      margin: 0;
      font-size: 2rem;
      line-height: 1.05;
      letter-spacing: -.03em;
    }

    .brand p {
      margin: 8px 0 0;
      color: rgba(255,255,255,.8);
      font-size: .95rem;
    }

    .hero-meta {
      min-width: 240px;
      padding: 16px 18px;
      background: rgba(255,255,255,.08);
      border: 1px solid rgba(255,255,255,.14);
      border-radius: 18px;
      backdrop-filter: blur(8px);
    }

    .hero-meta-line {
      display: flex;
      justify-content: space-between;
      gap: 18px;
      font-size: .85rem;
      padding: 6px 0;
      border-bottom: 1px solid rgba(255,255,255,.1);
    }

    .hero-meta-line:last-child { border-bottom: none; }
    .hero-meta-line span:first-child { color: rgba(255,255,255,.72); }

    .hero-periodo {
      margin-top: 18px;
      padding: 12px 14px;
      border-radius: 14px;
      background: rgba(255,255,255,.08);
      color: rgba(255,255,255,.86);
      font-size: .9rem;
      border: 1px solid rgba(255,255,255,.1);
    }

    .content {
      padding: 28px 32px 34px;
    }

    .grid-metricas {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 14px;
      margin-bottom: 22px;
    }

    .metric {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 16px;
    }

    .metric .label {
      color: var(--muted);
      font-size: .78rem;
      text-transform: uppercase;
      letter-spacing: .08em;
      margin-bottom: 8px;
    }

    .metric .value {
      font-size: 1.35rem;
      font-weight: 700;
      letter-spacing: -.03em;
      font-family: var(--mono);
    }

    .metric .sub {
      margin-top: 8px;
      color: var(--muted);
      font-size: .8rem;
    }

    .positivo { color: var(--success); }
    .negativo { color: var(--danger); }

    .section {
      margin-top: 18px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 20px;
      overflow: hidden;
      page-break-inside: avoid;
    }

    .section-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      padding: 16px 18px;
      border-bottom: 1px solid var(--border);
      background: rgba(37,99,235,.04);
    }

    .section-head h2 {
      margin: 0;
      font-size: 1rem;
      letter-spacing: -.02em;
    }

    .section-head p {
      margin: 0;
      color: var(--muted);
      font-size: .84rem;
    }

    .section-body {
      padding: 18px;
    }

    .mini-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
    }

    .mini-card {
      border: 1px solid var(--border);
      background: #fff;
      border-radius: 16px;
      padding: 14px;
    }

    .mini-card .mini-label {
      font-size: .76rem;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: .08em;
      margin-bottom: 7px;
    }

    .mini-card .mini-value {
      font-size: 1.05rem;
      font-weight: 700;
      font-family: var(--mono);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      background: #fff;
      border-radius: 14px;
      overflow: hidden;
    }

    th, td {
      text-align: left;
      padding: 12px 10px;
      border-bottom: 1px solid var(--border);
      font-size: .88rem;
    }

    th {
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: .06em;
      font-size: .73rem;
      background: #f8fbff;
    }

    tr:last-child td { border-bottom: none; }

    .footer {
      padding: 22px 32px 30px;
      color: var(--muted);
      font-size: .82rem;
      display: flex;
      justify-content: space-between;
      gap: 16px;
      border-top: 1px solid var(--border);
      flex-wrap: wrap;
    }

    @media (max-width: 920px) {
      body { padding: 0; background: #fff; }
      .page { border-radius: 0; box-shadow: none; }
      .grid-metricas, .mini-grid { grid-template-columns: repeat(2, 1fr); }
    }

    @media print {
      @page { size: A4; margin: 12mm; }

      body {
        background: #fff;
        padding: 0;
      }

      .page {
        max-width: none;
        box-shadow: none;
        border: none;
        border-radius: 0;
      }

      .hero {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .section, .metric, .mini-card, table {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <header class="hero">
      <div class="hero-top">
        <div>
          <div class="brand">
            <div class="brand-logo">💰</div>
            <div>
              <div class="brand-kicker">Controle Financeiro</div>
              <h1>Relatório Financeiro Profissional</h1>
              <p>Cabeçalho estilo app real, layout pronto para impressão e exportação em PDF.</p>
            </div>
          </div>
          <div class="hero-periodo">${escaparHtml(dados.periodo)}</div>
        </div>

        <div class="hero-meta">
          <div class="hero-meta-line"><span>Gerado em</span><strong>${dados.dataGeracao}</strong></div>
          <div class="hero-meta-line"><span>Horário</span><strong>${dados.horaGeracao}</strong></div>
          <div class="hero-meta-line"><span>Lançamentos</span><strong>${dados.itens.length}</strong></div>
          <div class="hero-meta-line"><span>Mês filtrado</span><strong>${dados.mes || 'Todos'}</strong></div>
        </div>
      </div>
    </header>

    <main class="content">
      <section class="grid-metricas">
        <article class="metric">
          <div class="label">Receitas</div>
          <div class="value positivo">${fmt(dados.totais.totalEntradas)}</div>
          <div class="sub">Inclui renda base configurada</div>
        </article>
        <article class="metric">
          <div class="label">Despesas</div>
          <div class="value negativo">${fmt(dados.totais.totalGastos)}</div>
          <div class="sub">${dados.qtdGastos} gasto(s) no período</div>
        </article>
        <article class="metric">
          <div class="label">Saldo</div>
          <div class="value ${saldoClass}">${fmt(dados.totais.saldo)}</div>
          <div class="sub">${dados.totais.saldo >= 0 ? 'Resultado positivo' : 'Atenção para ajuste do orçamento'}</div>
        </article>
        <article class="metric">
          <div class="label">Entradas</div>
          <div class="value">${dados.qtdEntradas}</div>
          <div class="sub">Quantidade de lançamentos de entrada</div>
        </article>
      </section>

      <section class="section">
        <div class="section-head">
          <div>
            <h2>Status dos gastos manuais</h2>
            <p>Separação entre gastos já quitados e os ainda pendentes.</p>
          </div>
        </div>
        <div class="section-body">
          <div class="mini-grid">
            <div class="mini-card">
              <div class="mini-label">Total pago</div>
              <div class="mini-value positivo">${fmt(dados.pagamentos.totalPago)}</div>
            </div>
            <div class="mini-card">
              <div class="mini-label">Total pendente</div>
              <div class="mini-value negativo">${fmt(dados.pagamentos.totalPendente)}</div>
            </div>
            <div class="mini-card">
              <div class="mini-label">Qtd. pagos</div>
              <div class="mini-value">${dados.pagamentos.qtdPago}</div>
            </div>
            <div class="mini-card">
              <div class="mini-label">Qtd. pendentes</div>
              <div class="mini-value">${dados.pagamentos.qtdPendente}</div>
            </div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section-head">
          <div>
            <h2>Parcelamentos</h2>
            <p>Visão rápida do andamento das parcelas cadastradas.</p>
          </div>
        </div>
        <div class="section-body">
          <div class="mini-grid">
            <div class="mini-card">
              <div class="mini-label">Ativos</div>
              <div class="mini-value">${dados.parcelamentosAtivos.length}</div>
            </div>
            <div class="mini-card">
              <div class="mini-label">Concluídos</div>
              <div class="mini-value">${dados.parcelamentosConcluidos.length}</div>
            </div>
            <div class="mini-card">
              <div class="mini-label">Total cadastrados</div>
              <div class="mini-value">${parcelamentos.length}</div>
            </div>
            <div class="mini-card">
              <div class="mini-label">Itens no relatório</div>
              <div class="mini-value">${dados.itens.length}</div>
            </div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section-head">
          <div>
            <h2>Top categorias</h2>
            <p>As categorias que mais pesaram nas despesas filtradas.</p>
          </div>
        </div>
        <div class="section-body">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Categoria</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>${topCategoriasRows}</tbody>
          </table>
        </div>
      </section>

      <section class="section">
        <div class="section-head">
          <div>
            <h2>Maiores gastos</h2>
            <p>Itens com maior impacto financeiro no período analisado.</p>
          </div>
        </div>
        <div class="section-body">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Data</th>
                <th>Origem</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>${maioresGastosRows}</tbody>
          </table>
        </div>
      </section>

      <section class="section">
        <div class="section-head">
          <div>
            <h2>Últimos lançamentos do filtro</h2>
            <p>Prévia dos registros mais recentes incluídos no relatório.</p>
          </div>
        </div>
        <div class="section-body">
          <table>
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Tipo</th>
                <th>Categoria</th>
                <th>Data</th>
                <th>Origem</th>
                <th>Status</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>${ultimosLancamentosRows}</tbody>
          </table>
        </div>
      </section>
    </main>

    <footer class="footer">
      <div>Documento gerado automaticamente pelo app Controle Financeiro.</div>
      <div>Dica: na impressão, escolha “Salvar como PDF” para baixar o relatório.</div>
    </footer>
  </div>
</body>
</html>
    `;
  }

  // Abre uma nova janela com o relatório pronto para impressão.
  // Depois chama a impressão automaticamente, permitindo salvar em PDF pelo navegador.
  function exportarRelatorioPDFProfissional() {
    const html = gerarHTMLRelatorioProfissional();
    const janela = window.open('', '_blank', 'width=1200,height=900');

    if (!janela) {
      abrirModal('O navegador bloqueou a nova janela do PDF. Permita pop-ups e tente novamente.', 'PDF profissional', 'erro');
      return;
    }

    janela.document.open();
    janela.document.write(html);
    janela.document.close();

    janela.onload = () => {
      setTimeout(() => {
        janela.focus();
        janela.print();
      }, 300);
    };
  }

  // Gera a versão em texto puro do relatório para download.
  function exportarRelatorioProTXT() {
    const dados = montarDadosRelatorioPro();

    const linhas = [
      'RELATÓRIO FINANCEIRO PRO',
      '========================================',
      dados.periodo,
      `Gerado em: ${dados.dataGeracao} às ${dados.horaGeracao}`,
      '',
      'VISÃO GERAL',
      `Receitas: ${fmt(dados.totais.totalEntradas)}`,
      `Despesas: ${fmt(dados.totais.totalGastos)}`,
      `Saldo: ${fmt(dados.totais.saldo)}`,
      `Lançamentos: ${dados.itens.length}`,
      '',
      'STATUS DOS GASTOS MANUAIS',
      `Total pago: ${fmt(dados.pagamentos.totalPago)}`,
      `Total pendente: ${fmt(dados.pagamentos.totalPendente)}`,
      `Quantidade paga: ${dados.pagamentos.qtdPago}`,
      `Quantidade pendente: ${dados.pagamentos.qtdPendente}`,
      '',
      'PARCELAMENTOS',
      `Ativos: ${dados.parcelamentosAtivos.length}`,
      `Concluídos: ${dados.parcelamentosConcluidos.length}`,
      `Total cadastrados: ${parcelamentos.length}`,
      '',
      'TOP CATEGORIAS'
    ];

    if (dados.topCategorias.length) {
      dados.topCategorias.forEach(([categoria, valor], i) => {
        linhas.push(`${i + 1}. ${categoria}: ${fmt(valor)}`);
      });
    } else {
      linhas.push('Nenhuma categoria encontrada.');
    }

    linhas.push('');
    linhas.push('MAIORES GASTOS');

    if (dados.maioresGastos.length) {
      dados.maioresGastos.forEach((item, i) => {
        linhas.push(`${i + 1}. ${item.descricao} | ${item.categoria} | ${fmtData(item.data)} | ${fmt(item.valor)}`);
      });
    } else {
      linhas.push('Nenhum gasto encontrado.');
    }

    baixarRelatorioTXT(linhas.join('\n'));
  }

  // ─── EXPORT CSV ───────────────────────────────────────────
  function exportarCSV() {
    const itens = lancamentosFiltrados();
    if (!itens.length) return abrirModal('Nenhum lançamento para exportar.', 'Exportar CSV', 'aviso');

    const linhas = [
      ['Descrição','Tipo','Categoria','Data','Valor','Origem','Status'],
      ...itens.map(i => [
        `"${i.descricao}"`,
        i.tipo,
        i.categoria,
        fmtData(i.data),
        i.valor.toFixed(2).replace('.', ','),
        i.origem === 'parcelamento' ? `Parcela ${i.parcelaAtual}/${i.totalParcelas}` : 'Manual',
        i.tipo === 'gasto' && i.origem !== 'parcelamento' ? (i.pago ? 'Pago' : 'Pendente') : '—'
      ])
    ];

    const csv  = linhas.map(l => l.join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `controle-financeiro-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── EXEMPLO ──────────────────────────────────────────────
  function carregarExemplo() {
    movimentacoes = [
      { id: 101, descricao: 'Aluguel',         valor: 800,  tipo: 'gasto',   categoria: 'fixo',        data: '2026-04-30', origem: 'manual', pago: true  },
      { id: 102, descricao: 'Escola',           valor: 770,  tipo: 'gasto',   categoria: 'fixo',        data: '2026-04-27', origem: 'manual', pago: false },
      { id: 103, descricao: 'Plano de saúde',   valor: 250,  tipo: 'gasto',   categoria: 'saude',       data: '2026-04-30', origem: 'manual', pago: false },
      { id: 104, descricao: 'Wi-Fi',            valor: 100,  tipo: 'gasto',   categoria: 'fixo',        data: '2026-04-12', origem: 'manual', pago: true  },
      { id: 105, descricao: 'Mercado semana 1', valor: 320,  tipo: 'gasto',   categoria: 'alimentacao', data: '2026-04-05', origem: 'manual', pago: true  },
      { id: 106, descricao: 'Restaurante',      valor: 120,  tipo: 'gasto',   categoria: 'alimentacao', data: '2026-04-14', origem: 'manual', pago: false },
      { id: 107, descricao: 'Uber',             valor: 45,   tipo: 'gasto',   categoria: 'transporte',  data: '2026-04-10', origem: 'manual', pago: false },
      { id: 108, descricao: 'Extra da esposa',  valor: 100,  tipo: 'entrada', categoria: 'extra',       data: '2026-04-22', origem: 'manual' },
    ];

    parcelamentos = [
      { id: 201, descricao: 'Livros',            valorParcela: 276, categoria: 'divida', totalParcelas: 5,  parcelasPagas: 2, primeiraData: '2026-02-10', diaVencimento: 10 },
      { id: 202, descricao: 'Cama',              valorParcela: 154, categoria: 'divida', totalParcelas: 10, parcelasPagas: 8, primeiraData: '2025-08-04', diaVencimento: 4  },
      { id: 203, descricao: 'Celular parcelado', valorParcela: 100, categoria: 'fixo',   totalParcelas: 4,  parcelasPagas: 0, primeiraData: '2026-04-12', diaVencimento: 12 },
    ];

    salvarDados();
    atualizarTela();
    abrirModal('Dados de exemplo carregados!', 'Concluído', 'sucesso');
  }

  // ─── INIT ─────────────────────────────────────────────────
  // Primeiro carregamos a configuração correta (geral ou mensal)
  // e só depois renderizamos o restante da tela.
  aplicarConfiguracoesNaTela();
  atualizarTela();
