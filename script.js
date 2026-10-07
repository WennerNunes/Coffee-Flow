// ============ DEFAULT CATEGORIES ============
const DEFAULT_CATEGORIES = {
  income: ['Coffee bag sales', 'Seedling sales', 'Other income'],
  expense: ['Fertilizer / Supplies', 'Shipping', 'Labor', 'Maintenance', 'Other expenses']
};

// ============ SAFE STORAGE (swap these for an API later) ============
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } };
function loadJSON(key, fallback) {
  try { return JSON.parse(lsGet(key, '')) ?? fallback; } catch { return fallback; }
}
const escapeHtml = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// ============ STATE ============
let transactions = loadJSON('coffeeflow_transactions', []);
let customCategories = loadJSON('coffeeflow_categories', { income: [], expense: [] });
let currentType = 'income';
let modalType = 'income';
let chart = null;

// ============ ELEMENTS ============
const elBalance = document.getElementById('balance');
const elIncome = document.getElementById('income');
const elExpenses = document.getElementById('expenses');
const elList = document.getElementById('list');
const elForm = document.getElementById('form');
const elAmount = document.getElementById('amount');
const elCategory = document.getElementById('category');
const elDescription = document.getElementById('description');
const elToast = document.getElementById('toast');
const elCategoryModal = document.getElementById('categoryModal');
const elNewCatName = document.getElementById('newCatName');
const elMonthFilter = document.getElementById('monthFilter');
const elListTitle = document.getElementById('listTitle');
const elThemeBtn = document.getElementById('themeBtn');
const elImportFile = document.getElementById('importFile');
const elDate = document.getElementById('date');

// ============ HELPERS ============
const formatMoney = (v) => {
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  const [int, dec] = abs.toFixed(2).split('.');
  const withCommas = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}$ ${withCommas}.${dec}`;
};

const formatDate = (iso) => {
  const d = new Date(iso + 'T00:00:00');
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const formatMonthLabel = (yyyymm) => {
  const [y, m] = yyyymm.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
};

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const save = () => {
  lsSet('coffeeflow_transactions', JSON.stringify(transactions));
};

const saveCategories = () => {
  lsSet('coffeeflow_categories', JSON.stringify(customCategories));
};

const showToast = (msg) => {
  elToast.textContent = msg;
  elToast.classList.add('show');
  setTimeout(() => elToast.classList.remove('show'), 2200);
};

const allCategories = (type) => [
  ...DEFAULT_CATEGORIES[type],
  ...customCategories[type]
];

// ============ THEME ============
function initTheme() {
  const saved = lsGet('coffeeflow_theme', 'light');
  document.body.classList.toggle('dark', saved === 'dark');
  elThemeBtn.textContent = saved === 'dark' ? '☀️' : '🌙';
}

function toggleTheme() {
  const isDark = document.body.classList.toggle('dark');
  lsSet('coffeeflow_theme', isDark ? 'dark' : 'light');
  elThemeBtn.textContent = isDark ? '☀️' : '🌙';
  elThemeBtn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
  updateChart();
}

// ============ FILTERS ============
function getFilteredTransactions() {
  const month = elMonthFilter.value;
  if (!month) return transactions;
  return transactions.filter((t) => t.date.startsWith(month));
}

function updateListTitle() {
  const month = elMonthFilter.value;
  elListTitle.textContent = month ? `Transactions — ${formatMonthLabel(month)}` : 'Transactions';
}

function resetFilters() {
  elMonthFilter.value = '';
  render();
  updateListTitle();
}

// ============ TYPE (income/expense) ============
function setType(type) {
  currentType = type;
  document.querySelectorAll('.type-toggle button').forEach((b) => {
    const isActive = b.dataset.type === type;
    b.classList.toggle('active', isActive);
    b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
  renderCategories();
}

function renderCategories() {
  const cats = allCategories(currentType);
  elCategory.innerHTML = cats
    .map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
    .join('');
}

// ============ RENDER ============
function renderSummary() {
  const list = getFilteredTransactions();
  const income = list
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0);
  const expenses = list
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);
  const balance = income - expenses;

  elIncome.textContent = formatMoney(income);
  elExpenses.textContent = formatMoney(expenses);
  elBalance.textContent = formatMoney(balance);
  elBalance.className = 'value ' + (balance >= 0 ? 'green' : 'red');
}

function renderList() {
  const list = getFilteredTransactions();

  if (list.length === 0) {
    elList.innerHTML = '<li class="empty">No transactions found.<br>Try changing the filter or adding one above ☕</li>';
    return;
  }

  const sorted = [...list].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

  elList.innerHTML = sorted
    .map((t) => {
      const sign = t.type === 'income' ? '+' : '−';
      const label = t.type === 'income' ? 'Income' : 'Expense';
      return `
        <li class="item ${t.type}">
          <span class="icon" aria-hidden="true">${t.type === 'income' ? '⬆️' : '⬇️'}</span>
          <div class="info">
            <div class="desc">${escapeHtml(t.category)}</div>
            <div class="meta">${t.description ? escapeHtml(t.description) + ' • ' : ''}${formatDate(t.date)}</div>
          </div>
          <span class="amount" aria-label="${label} of ${formatMoney(t.amount)}">${sign} ${formatMoney(t.amount)}</span>
          <button
            type="button"
            class="del"
            title="Delete"
            aria-label="Delete transaction"
            data-action="delete-transaction"
            data-id="${t.id}"
          >🗑️</button>
        </li>
      `;
    })
    .join('');
}

function render() {
  renderSummary();
  renderList();
}

// ============ CHART ============
function renderChart() {
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({
      key,
      label: d.toLocaleDateString('en-GB', { month: 'short' })
    });
  }

  const incomeData = months.map((m) =>
    transactions
      .filter((t) => t.type === 'income' && t.date.startsWith(m.key))
      .reduce((s, t) => s + t.amount, 0)
  );
  const expenseData = months.map((m) =>
    transactions
      .filter((t) => t.type === 'expense' && t.date.startsWith(m.key))
      .reduce((s, t) => s + t.amount, 0)
  );

  const isDark = document.body.classList.contains('dark');
  const textColor = isDark ? '#f0e9df' : '#2a1e14';
  const gridColor = isDark ? '#3a2e26' : '#e6e0d6';

  const ctx = document.getElementById('barChart');

  chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months.map((m) => m.label),
      datasets: [
        {
          label: 'Income',
          data: incomeData,
          backgroundColor: '#16a34a',
          borderRadius: 6
        },
        {
          label: 'Expenses',
          data: expenseData,
          backgroundColor: '#dc2626',
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: textColor,
            font: { family: 'Inter', size: 12 },
            boxWidth: 12,
            padding: 10
          }
        },
        tooltip: {
          callbacks: {
            label: (c) => `${c.dataset.label}: ${formatMoney(c.parsed.y)}`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: textColor, font: { size: 11 } },
          grid: { color: gridColor, display: false }
        },
        y: {
          ticks: { color: textColor, font: { size: 11 } },
          grid: { color: gridColor }
        }
      }
    }
  });
}

function updateChart() {
  if (chart) { chart.destroy(); chart = null; }
  renderChart();
}

// ============ NEW CATEGORY MODAL ============
function openCategoryModal() {
  setModalType(currentType);
  elNewCatName.value = '';
  elCategoryModal.classList.add('open');
  elCategoryModal.setAttribute('aria-hidden', 'false');
  setTimeout(() => elNewCatName.focus(), 150);
}

function closeCategoryModal() {
  elCategoryModal.classList.remove('open');
  elCategoryModal.setAttribute('aria-hidden', 'true');
}

function setModalType(type) {
  modalType = type;
  const elInc = document.getElementById('catTypeIncome');
  const elExp = document.getElementById('catTypeExpense');
  elInc.classList.toggle('active', type === 'income');
  elExp.classList.toggle('active', type === 'expense');
  elInc.setAttribute('aria-pressed', type === 'income' ? 'true' : 'false');
  elExp.setAttribute('aria-pressed', type === 'expense' ? 'true' : 'false');
}

function saveNewCategory() {
  const name = elNewCatName.value.trim();
  if (!name) {
    showToast('⚠️ Please enter a name');
    elNewCatName.focus();
    return;
  }

  const existing = allCategories(modalType).map((c) => c.toLowerCase());
  if (existing.includes(name.toLowerCase())) {
    showToast('⚠️ This category already exists');
    return;
  }

  customCategories[modalType].push(name);
  saveCategories();

  if (modalType === currentType) {
    renderCategories();
    elCategory.value = name;
  }

  closeCategoryModal();
  showToast('✅ Category added!');
}

elCategoryModal.addEventListener('click', (e) => {
  if (e.target === elCategoryModal) closeCategoryModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && elCategoryModal.classList.contains('open')) {
    closeCategoryModal();
  }
  if (
    e.key === 'Enter' &&
    elCategoryModal.classList.contains('open') &&
    document.activeElement === elNewCatName
  ) {
    e.preventDefault();
    saveNewCategory();
  }
});

// ============ ACTIONS ============
elForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const amount = parseFloat(elAmount.value);
  if (!amount || amount <= 0) return;

  transactions.push({
    id: Date.now(),
    type: currentType,
    amount,
    category: elCategory.value,
    description: elDescription.value.trim(),
    date: elDate.value || today()
  });

  save();
  render();
  updateChart();
  elForm.reset();
  elDate.value = today();
  renderCategories();
  showToast(currentType === 'income' ? '✅ Income recorded!' : '✅ Expense recorded!');
  elAmount.focus();
});

function removeTransaction(id) {
  if (!confirm('Delete this transaction?')) return;
  transactions = transactions.filter((t) => t.id !== id);
  save();
  render();
  updateChart();
  showToast('🗑️ Deleted');
}

function clearAll() {
  if (transactions.length === 0) return;
  if (!confirm('Delete ALL transactions? This action cannot be undone.')) return;
  transactions = [];
  save();
  render();
  updateChart();
  showToast('All cleared');
}

// ============ BACKUP (export / import) ============
const cleanCats = (arr) => [...new Set(
  (Array.isArray(arr) ? arr : [])
    .filter((c) => typeof c === 'string' && c.trim())
    .map((c) => c.trim().slice(0, 40))
)];

function sanitizeTransactions(arr) {
  if (!Array.isArray(arr)) return null;
  return arr
    .map((t, i) => ({
      id: Number.isFinite(t && t.id) ? t.id : Date.now() + i,
      type: t && t.type,
      amount: Number(t && t.amount),
      category: String((t && t.category) || 'Other').slice(0, 40),
      description: String((t && t.description) || '').slice(0, 120),
      date: t && /^\d{4}-\d{2}-\d{2}$/.test(t.date) ? t.date : today()
    }))
    .filter((t) => (t.type === 'income' || t.type === 'expense') && Number.isFinite(t.amount) && t.amount > 0);
}

function exportBackup() {
  const payload = { app: 'coffeeflow', version: 1, exportedAt: new Date().toISOString(), transactions, customCategories };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `coffeeflow-backup-${today()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('✅ Backup downloaded');
}

function importBackup(file) {
  if (!file || file.size > 2 * 1024 * 1024) { showToast('⚠️ Invalid backup file'); return; }
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      const list = sanitizeTransactions(data.transactions);
      if (!list) throw new Error('invalid');
      if (!confirm(`Replace current data with ${list.length} transactions from this backup?`)) return;
      transactions = list;
      const cats = data.customCategories || {};
      customCategories = { income: cleanCats(cats.income), expense: cleanCats(cats.expense) };
      save();
      saveCategories();
      renderCategories();
      render();
      updateChart();
      showToast('✅ Backup imported');
    } catch {
      showToast('⚠️ Invalid backup file');
    }
  };
  reader.readAsText(file);
}

// ============ EVENT DELEGATION (replaces inline onclick) ============
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  switch (btn.dataset.action) {
    case 'set-type':
      setType(btn.dataset.type);
      break;
    case 'open-category-modal':
      openCategoryModal();
      break;
    case 'close-category-modal':
      closeCategoryModal();
      break;
    case 'save-category':
      saveNewCategory();
      break;
    case 'set-modal-type':
      setModalType(btn.dataset.type);
      break;
    case 'delete-transaction':
      removeTransaction(Number(btn.dataset.id));
      break;
    case 'clear-all':
      clearAll();
      break;
  }
});

// ============ WIRE UP ============
document.getElementById('exportBtn').addEventListener('click', exportBackup);
document.getElementById('importBtn').addEventListener('click', () => elImportFile.click());
elImportFile.addEventListener('change', () => {
  importBackup(elImportFile.files[0]);
  elImportFile.value = '';
});
elMonthFilter.addEventListener('change', () => {
  render();
  updateListTitle();
});
elThemeBtn.addEventListener('click', toggleTheme);
document.getElementById('resetFilter').addEventListener('click', resetFilters);

let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    if (chart) chart.resize();
  }, 200);
});

// ============ INIT ============
initTheme();
elDate.value = today();
renderCategories();
render();
renderChart();
updateListTitle();
elAmount.focus();