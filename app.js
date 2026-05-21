/* =========================================
   FinTrack – app.js
   ========================================= */

/* ---- CONSTANTS & STATE ---- */
const STORAGE_KEY   = 'fintrack_expenses';
const BUDGET_KEY    = 'fintrack_budget';
const THEME_KEY     = 'fintrack_theme';

const CATEGORY_ICONS = {
  Food: '🍔', Transport: '🚗', Shopping: '🛍️',
  Entertainment: '🎬', Health: '💊', Education: '📚',
  Bills: '💡', Other: '📦'
};

const CATEGORY_COLORS = [
  '#4f46e5','#0d9488','#d97706','#dc2626',
  '#16a34a','#7c3aed','#db2777','#0891b2'
];

let expenses   = [];
let budget     = 0;
let editingId  = null;
let deleteId   = null;
let pieChart   = null;
let barChart   = null;

/* ---- DOM REFS ---- */
const expTitleEl    = document.getElementById('expTitle');
const expAmountEl   = document.getElementById('expAmount');
const expDateEl     = document.getElementById('expDate');
const expCategoryEl = document.getElementById('expCategory');
const expNoteEl     = document.getElementById('expNote');
const addExpBtn     = document.getElementById('addExpBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const formTitle     = document.getElementById('formTitle');
const formError     = document.getElementById('formError');

const budgetInput   = document.getElementById('budgetInput');
const setBudgetBtn  = document.getElementById('setBudgetBtn');

const searchInput      = document.getElementById('searchInput');
const filterCategory   = document.getElementById('filterCategory');
const sortSelect       = document.getElementById('sortSelect');
const clearFiltersBtn  = document.getElementById('clearFiltersBtn');

const expenseList   = document.getElementById('expenseList');
const emptyState    = document.getElementById('emptyState');
const listCount     = document.getElementById('listCount');

const summaryBudget    = document.getElementById('summaryBudget');
const summarySpent     = document.getElementById('summarySpent');
const summaryRemaining = document.getElementById('summaryRemaining');
const summaryCount     = document.getElementById('summaryCount');

const budgetProgressBar = document.getElementById('budgetProgressBar');
const budgetBarLabel    = document.getElementById('budgetBarLabel');

const exportBtn        = document.getElementById('exportBtn');
const themeToggle      = document.getElementById('themeToggle');
const themeIcon        = document.getElementById('themeIcon');

const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
const deleteModal      = new bootstrap.Modal(document.getElementById('deleteModal'));

const toast            = document.getElementById('toast');

/* ============================================================
   INIT
   ============================================================ */
function init() {
  loadData();
  loadTheme();
  setDefaultDate();
  render();
  attachListeners();
}

function loadData() {
  const stored = localStorage.getItem(STORAGE_KEY);
  expenses = stored ? JSON.parse(stored) : [];
  budget   = parseFloat(localStorage.getItem(BUDGET_KEY)) || 0;
  if (budget) budgetInput.value = budget;
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
  localStorage.setItem(BUDGET_KEY, budget);
}

function setDefaultDate() {
  expDateEl.value = new Date().toISOString().split('T')[0];
}

/* ============================================================
   RENDER PIPELINE
   ============================================================ */
function render() {
  updateSummary();
  renderExpenseList();
  renderCharts();
  renderTopCategories();
}

/* ---- SUMMARY ---- */
function updateSummary() {
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const remaining = budget - total;
  const pct = budget > 0 ? Math.min((total / budget) * 100, 100) : 0;

  summaryBudget.textContent    = fmt(budget);
  summarySpent.textContent     = fmt(total);
  summaryRemaining.textContent = fmt(remaining);
  summaryCount.textContent     = expenses.length;

  budgetProgressBar.style.width = pct.toFixed(1) + '%';
  budgetProgressBar.setAttribute('aria-valuenow', pct.toFixed(1));
  budgetProgressBar.classList.remove('bg-warning', 'bg-danger');
  if (pct >= 100) budgetProgressBar.classList.add('bg-danger');
  else if (pct >= 75) budgetProgressBar.classList.add('bg-warning');

  if (budget > 0) {
    budgetBarLabel.textContent = pct >= 100
      ? `⚠️ Over budget by ${fmt(Math.abs(remaining))}`
      : `${fmt(total)} spent of ${fmt(budget)} (${pct.toFixed(0)}%)`;
  } else {
    budgetBarLabel.textContent = 'Set a budget to track progress';
  }
}

/* ---- EXPENSE LIST ---- */
function renderExpenseList() {
  const query  = searchInput.value.trim().toLowerCase();
  const cat    = filterCategory.value;
  const sort   = sortSelect.value;

  let filtered = expenses.filter(e => {
    const matchCat  = cat === 'All' || e.category === cat;
    const matchQ    = !query ||
      e.title.toLowerCase().includes(query) ||
      e.category.toLowerCase().includes(query) ||
      (e.note && e.note.toLowerCase().includes(query));
    return matchCat && matchQ;
  });

  filtered.sort((a, b) => {
    if (sort === 'date-desc')   return new Date(b.date) - new Date(a.date);
    if (sort === 'date-asc')    return new Date(a.date) - new Date(b.date);
    if (sort === 'amount-desc') return b.amount - a.amount;
    if (sort === 'amount-asc')  return a.amount - b.amount;
    return 0;
  });

  listCount.textContent = filtered.length;

  if (filtered.length === 0) {
    expenseList.innerHTML = '';
    expenseList.appendChild(emptyState);
    emptyState.classList.remove('d-none');
    return;
  }

  emptyState.classList.add('d-none');
  const frag = document.createDocumentFragment();

  filtered.forEach(exp => {
    const item = document.createElement('div');
    item.className = 'ft-expense-item';
    item.dataset.id = exp.id;

    const formattedDate = new Date(exp.date + 'T00:00:00').toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    });

    item.innerHTML = `
      <div class="ft-exp-icon">${CATEGORY_ICONS[exp.category] || '📦'}</div>
      <div class="ft-exp-info">
        <div class="ft-exp-title">${escHtml(exp.title)}</div>
        <div class="ft-exp-meta">
          <span class="ft-cat-badge">${exp.category}</span>
          <span class="ms-1">${formattedDate}</span>
          ${exp.note ? `<span class="ms-1 d-none d-sm-inline">· ${escHtml(exp.note)}</span>` : ''}
        </div>
      </div>
      <div class="ft-exp-amount">−${fmt(exp.amount)}</div>
      <div class="ft-exp-actions">
        <button class="edit-btn" title="Edit" data-id="${exp.id}"><i class="bi bi-pencil"></i></button>
        <button class="del-btn"  title="Delete" data-id="${exp.id}"><i class="bi bi-trash3"></i></button>
      </div>`;
    frag.appendChild(item);
  });

  expenseList.innerHTML = '';
  expenseList.appendChild(frag);
}

/* ---- CHARTS ---- */
function renderCharts() {
  renderPieChart();
  renderBarChart();
}

function renderPieChart() {
  const pieNoData = document.getElementById('pieNoData');
  const pieCanvas = document.getElementById('pieChart');

  const totals = {};
  expenses.forEach(e => { totals[e.category] = (totals[e.category] || 0) + e.amount; });
  const labels = Object.keys(totals);

  if (labels.length === 0) {
    pieCanvas.style.display = 'none';
    pieNoData.classList.remove('d-none');
    if (pieChart) { pieChart.destroy(); pieChart = null; }
    return;
  }

  pieCanvas.style.display = '';
  pieNoData.classList.add('d-none');
  const data = labels.map(l => totals[l]);
  const colors = labels.map((_, i) => CATEGORY_COLORS[i % CATEGORY_COLORS.length]);

  if (pieChart) pieChart.destroy();
  pieChart = new Chart(pieCanvas, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: getComputedStyle(document.body).getPropertyValue('--ft-surface').trim() || '#fff', hoverOffset: 6 }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '62%',
      plugins: {
        legend: {
          position: 'bottom', labels: {
            padding: 12, font: { size: 11 },
            color: getComputedStyle(document.documentElement).getPropertyValue('--ft-text').trim() || '#1a1d2e',
            boxWidth: 12, usePointStyle: true, pointStyle: 'circle'
          }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${fmt(ctx.parsed)} (${((ctx.parsed / expenses.reduce((s,e)=>s+e.amount,0))*100).toFixed(1)}%)`
          }
        }
      }
    }
  });
}

function renderBarChart() {
  const barNoData = document.getElementById('barNoData');
  const barCanvas = document.getElementById('barChart');

  // Last 7 days
  const days = [];
  const amounts = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
    const total = expenses.filter(e => e.date === key).reduce((s, e) => s + e.amount, 0);
    days.push(label);
    amounts.push(total);
  }

  if (amounts.every(a => a === 0)) {
    barCanvas.style.display = 'none';
    barNoData.classList.remove('d-none');
    if (barChart) { barChart.destroy(); barChart = null; }
    return;
  }

  barCanvas.style.display = '';
  barNoData.classList.add('d-none');

  if (barChart) barChart.destroy();
  barChart = new Chart(barCanvas, {
    type: 'bar',
    data: {
      labels: days,
      datasets: [{
        label: 'Spent',
        data: amounts,
        backgroundColor: 'rgba(79,70,229,.7)',
        borderRadius: 5,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ' ' + fmt(ctx.parsed.y) } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 }, color: getComputedStyle(document.documentElement).getPropertyValue('--ft-text-muted').trim() } },
        y: { grid: { color: 'rgba(0,0,0,.05)' }, ticks: { font: { size: 10 }, color: getComputedStyle(document.documentElement).getPropertyValue('--ft-text-muted').trim(), callback: v => '₹' + v } }
      }
    }
  });
}

/* ---- TOP CATEGORIES ---- */
function renderTopCategories() {
  const el = document.getElementById('topCategories');
  if (expenses.length === 0) {
    el.innerHTML = '<p class="text-secondary small mb-0">Add expenses to see your top spending categories.</p>';
    return;
  }

  const totals = {};
  expenses.forEach(e => { totals[e.category] = (totals[e.category] || 0) + e.amount; });
  const total = Object.values(totals).reduce((a, b) => a + b, 0);
  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 5);

  el.innerHTML = sorted.map(([cat, amt], i) => {
    const pct = total > 0 ? (amt / total) * 100 : 0;
    const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
    return `
      <div class="ft-cat-row">
        <div class="ft-cat-name">${CATEGORY_ICONS[cat] || '📦'} ${cat}</div>
        <div class="ft-cat-bar-wrap">
          <div class="ft-cat-bar-fill" style="width:${pct.toFixed(1)}%; background:${color}"></div>
        </div>
        <div class="ft-cat-pct">${pct.toFixed(0)}%</div>
      </div>`;
  }).join('');
}

/* ============================================================
   EXPENSE CRUD
   ============================================================ */
function addOrUpdateExpense() {
  const title    = expTitleEl.value.trim();
  const amount   = parseFloat(expAmountEl.value);
  const date     = expDateEl.value;
  const category = expCategoryEl.value;
  const note     = expNoteEl.value.trim();

  if (!title)          return showError('Please enter a title.');
  if (!amount || amount <= 0) return showError('Please enter a valid amount.');
  if (!date)           return showError('Please select a date.');
  if (!category)       return showError('Please select a category.');

  hideError();

  if (editingId !== null) {
    const idx = expenses.findIndex(e => e.id === editingId);
    if (idx !== -1) expenses[idx] = { ...expenses[idx], title, amount, date, category, note };
    showToast('Expense updated ✓');
    cancelEdit();
  } else {
    expenses.unshift({ id: Date.now(), title, amount, date, category, note });
    showToast('Expense added ✓');
    resetForm();
  }

  saveData();
  render();
}

function startEdit(id) {
  const exp = expenses.find(e => e.id === id);
  if (!exp) return;

  editingId = id;
  expTitleEl.value     = exp.title;
  expAmountEl.value    = exp.amount;
  expDateEl.value      = exp.date;
  expCategoryEl.value  = exp.category;
  expNoteEl.value      = exp.note || '';

  formTitle.innerHTML  = '<i class="bi bi-pencil-square me-2"></i>Edit Expense';
  addExpBtn.innerHTML  = '<i class="bi bi-check-lg me-1"></i> Update Expense';
  cancelEditBtn.classList.remove('d-none');

  expTitleEl.focus();
  expTitleEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelEdit() {
  editingId = null;
  resetForm();
  formTitle.innerHTML  = '<i class="bi bi-plus-circle me-2"></i>Add Expense';
  addExpBtn.innerHTML  = '<i class="bi bi-plus-lg me-1"></i> Add Expense';
  cancelEditBtn.classList.add('d-none');
}

function confirmDelete(id) {
  deleteId = id;
  deleteModal.show();
}

function deleteExpense() {
  expenses = expenses.filter(e => e.id !== deleteId);
  deleteId = null;
  deleteModal.hide();
  saveData();
  render();
  showToast('Expense deleted');
}

/* ============================================================
   BUDGET
   ============================================================ */
function setBudget() {
  const val = parseFloat(budgetInput.value);
  if (!val || val <= 0) { showToast('Enter a valid budget amount'); return; }
  budget = val;
  saveData();
  updateSummary();
  showToast('Budget set to ' + fmt(budget));
}

/* ============================================================
   EXPORT CSV
   ============================================================ */
function exportCSV() {
  if (expenses.length === 0) { showToast('No expenses to export'); return; }

  const headers = ['Title', 'Amount (₹)', 'Category', 'Date', 'Note'];
  const rows = expenses.map(e => [
    `"${e.title.replace(/"/g, '""')}"`,
    e.amount.toFixed(2),
    e.category,
    e.date,
    `"${(e.note || '').replace(/"/g, '""')}"`
  ]);

  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `fintrack-expenses-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exported ✓');
}

/* ============================================================
   THEME
   ============================================================ */
function loadTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'light';
  applyTheme(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(current === 'light' ? 'dark' : 'light');
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  if (theme === 'dark') {
    themeIcon.className = 'bi bi-sun-fill';
    themeToggle.title   = 'Switch to light mode';
  } else {
    themeIcon.className = 'bi bi-moon-fill';
    themeToggle.title   = 'Switch to dark mode';
  }
  // Rebuild charts after theme change so colors update
  setTimeout(() => { renderCharts(); }, 50);
}

/* ============================================================
   HELPERS
   ============================================================ */
function fmt(n) {
  return '₹' + (Math.round(n * 100) / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 0, maximumFractionDigits: 2
  });
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function resetForm() {
  expTitleEl.value    = '';
  expAmountEl.value   = '';
  expCategoryEl.value = '';
  expNoteEl.value     = '';
  setDefaultDate();
  hideError();
}

function showError(msg) {
  formError.textContent = msg;
  formError.classList.remove('d-none');
}

function hideError() { formError.classList.add('d-none'); }

let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

/* ============================================================
   EVENT LISTENERS
   ============================================================ */
function attachListeners() {
  addExpBtn.addEventListener('click', addOrUpdateExpense);
  cancelEditBtn.addEventListener('click', cancelEdit);
  setBudgetBtn.addEventListener('click', setBudget);
  budgetInput.addEventListener('keydown', e => e.key === 'Enter' && setBudget());

  searchInput.addEventListener('input', renderExpenseList);
  filterCategory.addEventListener('change', renderExpenseList);
  sortSelect.addEventListener('change', renderExpenseList);

  clearFiltersBtn.addEventListener('click', () => {
    searchInput.value     = '';
    filterCategory.value  = 'All';
    renderExpenseList();
  });

  expenseList.addEventListener('click', e => {
    const editBtn = e.target.closest('.edit-btn');
    const delBtn  = e.target.closest('.del-btn');
    if (editBtn) startEdit(parseInt(editBtn.dataset.id));
    if (delBtn)  confirmDelete(parseInt(delBtn.dataset.id));
  });

  confirmDeleteBtn.addEventListener('click', deleteExpense);
  exportBtn.addEventListener('click', exportCSV);
  themeToggle.addEventListener('click', toggleTheme);

  // Allow Enter key on form inputs
  [expTitleEl, expAmountEl, expDateEl, expCategoryEl, expNoteEl].forEach(el => {
    el.addEventListener('keydown', e => { if (e.key === 'Enter') addOrUpdateExpense(); });
  });
}

/* ---- KICK OFF ---- */
document.addEventListener('DOMContentLoaded', init);
