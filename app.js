/**
 * BelanjaCalc Pro - Kalkulator Pembelian Barang Multi-Satuan
 * Logika perhitungan per unit, kg, gram, liter, diskon, pajak, cetak & ekspor
 */

// STATE UTAMA
let state = {
  items: [],
  globalDiscount: { type: 'nominal', val: 0 },
  tax: { enabled: false, percent: 11 },
  shippingFee: 0,
  notes: '',
  theme: 'light',
  history: []
};

// SATUAN DICTIONARY
const UNIT_LABELS = {
  unit: 'Unit / Pcs',
  kg: 'Kg',
  gram: 'Gram',
  liter: 'Liter',
  ml: 'ml',
  box: 'Box / Dus',
  pack: 'Pack',
  lusin: 'Lusin',
  kodi: 'Kodi',
  rim: 'Rim',
  sak: 'Sak',
  ikat: 'Ikat',
  meter: 'Meter'
};

// INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadHistoryFromStorage();
  loadDraftFromStorage();
  initEventListeners();
  render();
  lucide.createIcons();
});

// ==========================================
// TEMA (DARK / LIGHT MODE)
// ==========================================
function initTheme() {
  const savedTheme = localStorage.getItem('belanjacalc_theme') || 
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  setTheme(savedTheme);
}

function setTheme(theme) {
  state.theme = theme;
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
    document.getElementById('theme-icon-dark').classList.add('hidden');
    document.getElementById('theme-icon-light').classList.remove('hidden');
  } else {
    document.documentElement.classList.remove('dark');
    document.getElementById('theme-icon-light').classList.add('hidden');
    document.getElementById('theme-icon-dark').classList.remove('hidden');
  }
  localStorage.setItem('belanjacalc_theme', theme);
  lucide.createIcons();
}

function toggleTheme() {
  setTheme(state.theme === 'dark' ? 'light' : 'dark');
}

// ==========================================
// FORMATTER & UTILITY FUNCTIONS
// ==========================================

// Format angka ke format Rupiah (Rp 1.000.000)
function formatRupiah(amount, withPrefix = true) {
  const num = Math.round(Number(amount) || 0);
  const formatted = new Intl.NumberFormat('id-ID').format(num);
  return withPrefix ? `Rp ${formatted}` : formatted;
}

// Mengurai string angka/Rupiah kembali ke tipe Float/Number murni
function parseFormattedNumber(str) {
  if (typeof str === 'number') return str;
  if (!str) return 0;
  // Hapus semua karakter kecuali angka dan titik/koma desimal
  const cleaned = str.toString().replace(/[^0-9,-]/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

// Terbilang Rupiah dalam Bahasa Indonesia
function angkaTerbilang(nominal) {
  const bilangan = Math.floor(Math.abs(nominal));
  if (bilangan === 0) return 'Nol rupiah';

  const satuan = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];

  function proses(n) {
    let hasil = '';
    if (n < 12) {
      hasil = satuan[n];
    } else if (n < 20) {
      hasil = proses(n - 10) + ' belas';
    } else if (n < 100) {
      hasil = proses(Math.floor(n / 10)) + ' puluh ' + proses(n % 10);
    } else if (n < 200) {
      hasil = 'seratus ' + proses(n - 100);
    } else if (n < 1000) {
      hasil = proses(Math.floor(n / 100)) + ' ratus ' + proses(n % 100);
    } else if (n < 2000) {
      hasil = 'seribu ' + proses(n - 1000);
    } else if (n < 1000000) {
      hasil = proses(Math.floor(n / 1000)) + ' ribu ' + proses(n % 1000);
    } else if (n < 1000000000) {
      hasil = proses(Math.floor(n / 1000000)) + ' juta ' + proses(n % 1000000);
    } else if (n < 1000000000000) {
      hasil = proses(Math.floor(n / 1000000000)) + ' milyar ' + proses(n % 1000000000);
    } else if (n < 1000000000000000) {
      hasil = proses(Math.floor(n / 1000000000000)) + ' triliun ' + proses(n % 1000000000000);
    }
    return hasil.trim();
  }

  const hasilKata = proses(bilangan);
  return hasilKata.charAt(0).toUpperCase() + hasilKata.slice(1) + ' rupiah';
}

// Generate Unique ID
function generateId() {
  return 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
}

// ==========================================
// KALKULASI LOGIC
// ==========================================

function calculateItemSubtotal(item) {
  const qty = parseFloat(item.qty) || 0;
  const price = parseFloat(item.price) || 0;
  const grossTotal = qty * price;
  
  let discountAmount = 0;
  if (item.hasDiscount && item.discountVal > 0) {
    if (item.discountType === 'percent') {
      discountAmount = grossTotal * (Math.min(100, Math.max(0, item.discountVal)) / 100);
    } else {
      discountAmount = Math.min(grossTotal, Math.max(0, item.discountVal));
    }
  }

  const subtotal = Math.max(0, grossTotal - discountAmount);
  return {
    grossTotal,
    discountAmount,
    subtotal
  };
}

function calculateSummary() {
  let subtotal = 0;
  let totalQtyMap = {};

  state.items.forEach(item => {
    const { subtotal: itemSub } = calculateItemSubtotal(item);
    subtotal += itemSub;

    // Unit Breakdown
    const u = item.unit || 'unit';
    const q = parseFloat(item.qty) || 0;
    totalQtyMap[u] = (totalQtyMap[u] || 0) + q;
  });

  // Global Discount
  let discountGlobalAmount = 0;
  if (state.globalDiscount.val > 0) {
    if (state.globalDiscount.type === 'percent') {
      discountGlobalAmount = subtotal * (Math.min(100, state.globalDiscount.val) / 100);
    } else {
      discountGlobalAmount = Math.min(subtotal, state.globalDiscount.val);
    }
  }
  const afterDiscount = Math.max(0, subtotal - discountGlobalAmount);

  // Pajak (PPN)
  let taxAmount = 0;
  if (state.tax.enabled && state.tax.percent > 0) {
    taxAmount = afterDiscount * (state.tax.percent / 100);
  }

  // Shipping
  const shipping = Math.max(0, state.shippingFee || 0);

  // Grand Total
  const grandTotal = afterDiscount + taxAmount + shipping;

  return {
    subtotal,
    discountGlobalAmount,
    taxAmount,
    shipping,
    grandTotal,
    totalKinds: state.items.length,
    totalQtyMap
  };
}

// ==========================================
// RENDER & UI UPDATES
// ==========================================

function render() {
  renderItemsTable();
  renderSummary();
  saveDraftToStorage();
  lucide.createIcons();
}

function renderItemsTable() {
  const tbody = document.getElementById('items-table-body');
  const emptyState = document.getElementById('empty-state');
  const tableWrapper = document.getElementById('items-table-wrapper');
  const tableFooter = document.getElementById('items-table-footer');
  const badgeCount = document.getElementById('badge-total-items');

  badgeCount.textContent = `${state.items.length} Item`;

  if (state.items.length === 0) {
    emptyState.classList.remove('hidden');
    tableWrapper.classList.add('hidden');
    tableFooter.classList.add('hidden');
    tbody.innerHTML = '';
    return;
  }

  emptyState.classList.add('hidden');
  tableWrapper.classList.remove('hidden');
  tableFooter.classList.remove('hidden');

  tbody.innerHTML = state.items.map((item, index) => {
    const calc = calculateItemSubtotal(item);
    const unitText = item.unit === 'custom' ? (item.customUnit || 'Satuan') : (UNIT_LABELS[item.unit] || item.unit);

    return `
      <tr class="table-row-animate hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors" data-id="${item.id}">
        <!-- Index -->
        <td class="py-3 px-4 text-center text-slate-400 text-xs font-mono">
          ${index + 1}
        </td>

        <!-- Item Name (Editable inline) -->
        <td class="py-2 px-4 table-input-cell">
          <input type="text" value="${escapeHtml(item.name)}" placeholder="Nama barang"
            class="w-full px-2 py-1 bg-transparent border-0 focus:ring-1 focus:ring-brand-500 rounded text-slate-900 dark:text-white font-medium text-xs sm:text-sm"
            onchange="updateItemField('${item.id}', 'name', this.value)">
          ${item.hasDiscount && item.discountVal > 0 ? `
            <span class="inline-block text-[10px] text-rose-500 font-medium px-1.5 py-0.2 bg-rose-50 dark:bg-rose-950/50 rounded border border-rose-200 dark:border-rose-900 mt-0.5">
              Disc: ${item.discountType === 'percent' ? item.discountVal + '%' : formatRupiah(item.discountVal)}
            </span>
          ` : ''}
        </td>

        <!-- Satuan -->
        <td class="py-2 px-3 text-center">
          <span class="inline-block px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            ${escapeHtml(unitText)}
          </span>
        </td>

        <!-- Jumlah / Kuantitas (Editable inline) -->
        <td class="py-2 px-3 text-right table-input-cell">
          <input type="number" step="any" min="0.0001" value="${item.qty}"
            class="w-20 px-2 py-1 bg-transparent border border-slate-200 dark:border-slate-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-lg text-right font-mono text-xs sm:text-sm text-slate-900 dark:text-white"
            onchange="updateItemField('${item.id}', 'qty', parseFloat(this.value) || 0)">
        </td>

        <!-- Harga Satuan (Editable inline) -->
        <td class="py-2 px-4 text-right table-input-cell">
          <div class="relative inline-block w-28 sm:w-32">
            <input type="text" value="${formatRupiah(item.price, false)}"
              class="w-full px-2 py-1 bg-transparent border border-slate-200 dark:border-slate-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-lg text-right font-mono text-xs sm:text-sm text-slate-900 dark:text-white"
              onfocus="this.value = '${item.price}'"
              onblur="updateItemField('${item.id}', 'price', parseFormattedNumber(this.value))">
          </div>
        </td>

        <!-- Total Item -->
        <td class="py-2 px-4 text-right">
          <div class="font-bold text-slate-900 dark:text-white font-mono text-xs sm:text-sm">
            ${formatRupiah(calc.subtotal)}
          </div>
          ${calc.discountAmount > 0 ? `
            <div class="text-[10px] text-slate-400 line-through font-mono">
              ${formatRupiah(calc.grossTotal)}
            </div>
          ` : ''}
        </td>

        <!-- Actions -->
        <td class="py-2 px-3 text-center">
          <div class="flex items-center justify-center gap-1">
            <button onclick="duplicateItem('${item.id}')" title="Duplikat Item"
              class="p-1 rounded-md text-slate-400 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
              <i data-lucide="copy" class="w-3.5 h-3.5"></i>
            </button>
            <button onclick="deleteItem('${item.id}')" title="Hapus Item"
              class="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Update Footer Summary
  const summary = calculateSummary();
  document.getElementById('foot-total-kinds').textContent = `${summary.totalKinds} macam`;
  
  // Format unit breakdown string (cth: 5.5 kg, 3 unit, 2 liter)
  const breakdownParts = Object.entries(summary.totalQtyMap).map(([u, q]) => {
    const label = UNIT_LABELS[u] || u;
    // Format desimal rapi
    const formattedQty = (Math.round(q * 1000) / 1000).toString();
    return `${formattedQty} ${label}`;
  });
  document.getElementById('foot-unit-breakdown').textContent = breakdownParts.length > 0 ? `Total: ${breakdownParts.join(', ')}` : '';
  document.getElementById('foot-subtotal-val').textContent = formatRupiah(summary.subtotal);
}

function renderSummary() {
  const summary = calculateSummary();

  document.getElementById('summary-subtotal').textContent = formatRupiah(summary.subtotal);
  document.getElementById('summary-discount-amount').textContent = `- ${formatRupiah(summary.discountGlobalAmount)}`;
  document.getElementById('summary-tax-amount').textContent = `+ ${formatRupiah(summary.taxAmount)}`;
  document.getElementById('summary-shipping-amount').textContent = `+ ${formatRupiah(summary.shipping)}`;
  document.getElementById('summary-grand-total').textContent = formatRupiah(summary.grandTotal);
  
  // Render Terbilang
  document.getElementById('summary-terbilang').textContent = `(${angkaTerbilang(summary.grandTotal)})`;
}

// ==========================================
// ITEM OPERATIONS
// ==========================================

function addItem(itemData) {
  state.items.push({
    id: generateId(),
    name: itemData.name || 'Barang Baru',
    unit: itemData.unit || 'unit',
    customUnit: itemData.customUnit || '',
    qty: parseFloat(itemData.qty) || 1,
    price: parseFloat(itemData.price) || 0,
    hasDiscount: !!itemData.hasDiscount,
    discountType: itemData.discountType || 'percent',
    discountVal: parseFloat(itemData.discountVal) || 0
  });

  render();
  showToast('Barang berhasil ditambahkan!');
}

function updateItemField(id, field, value) {
  const item = state.items.find(i => i.id === id);
  if (item) {
    item[field] = value;
    render();
  }
}

function duplicateItem(id) {
  const item = state.items.find(i => i.id === id);
  if (item) {
    const copy = { ...item, id: generateId(), name: `${item.name} (Salinan)` };
    state.items.push(copy);
    render();
    showToast('Barang diduplikasi!');
  }
}

function deleteItem(id) {
  state.items = state.items.filter(i => i.id !== id);
  render();
  showToast('Barang dihapus dari daftar.', 'warning');
}

function clearAllItems() {
  if (state.items.length === 0) return;
  if (confirm('Apakah Anda yakin ingin mengosongkan seluruh daftar pembelian?')) {
    state.items = [];
    state.globalDiscount.val = 0;
    state.shippingFee = 0;
    document.getElementById('discount-global-val').value = '';
    document.getElementById('input-shipping-fee').value = '';
    document.getElementById('input-transaction-notes').value = '';
    state.notes = '';
    render();
    showToast('Seluruh daftar belanja telah dikosongkan.');
  }
}

// ==========================================
// EVENT LISTENERS & FORM BINDING
// ==========================================

function initEventListeners() {
  // Theme Toggle
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

  // Form Add Item
  const formAdd = document.getElementById('form-add-item');
  const inputName = document.getElementById('input-item-name');
  const selectUnit = document.getElementById('input-item-unit');
  const inputCustomUnit = document.getElementById('input-item-custom-unit');
  const inputQty = document.getElementById('input-item-qty');
  const inputPrice = document.getElementById('input-item-price');
  const toggleDiscount = document.getElementById('toggle-item-discount');
  const discountFields = document.getElementById('item-discount-fields');
  const inputDiscountVal = document.getElementById('input-item-discount-val');
  const selectDiscountType = document.getElementById('input-item-discount-type');
  const previewSubtotal = document.getElementById('preview-item-subtotal');

  // Show/hide Custom Unit input
  selectUnit.addEventListener('change', () => {
    if (selectUnit.value === 'custom') {
      inputCustomUnit.classList.remove('hidden');
      inputCustomUnit.focus();
    } else {
      inputCustomUnit.classList.add('hidden');
    }
  });

  // Toggle Item Discount Box
  toggleDiscount.addEventListener('change', () => {
    if (toggleDiscount.checked) {
      discountFields.classList.remove('hidden');
      discountFields.classList.add('flex');
    } else {
      discountFields.classList.add('hidden');
      discountFields.classList.remove('flex');
      inputDiscountVal.value = '';
    }
    updateAddFormPreview();
  });

  // Real-time calculation in Add Form
  function updateAddFormPreview() {
    const qty = parseFloat(inputQty.value) || 0;
    const price = parseFormattedNumber(inputPrice.value) || 0;
    const gross = qty * price;
    let disc = 0;
    if (toggleDiscount.checked) {
      const discVal = parseFloat(inputDiscountVal.value) || 0;
      if (selectDiscountType.value === 'percent') {
        disc = gross * (Math.min(100, discVal) / 100);
      } else {
        disc = Math.min(gross, discVal);
      }
    }
    const sub = Math.max(0, gross - disc);
    previewSubtotal.textContent = formatRupiah(sub);
  }

  [inputQty, inputDiscountVal, selectDiscountType].forEach(el => {
    el.addEventListener('input', updateAddFormPreview);
  });

  // Price formatting as user types
  inputPrice.addEventListener('input', (e) => {
    const cursorPosition = e.target.selectionStart;
    const raw = parseFormattedNumber(e.target.value);
    if (!isNaN(raw) && raw > 0) {
      e.target.value = new Intl.NumberFormat('id-ID').format(raw);
    }
    updateAddFormPreview();
  });

  // Form Submit Handler
  formAdd.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = inputName.value.trim();
    if (!name) return;

    addItem({
      name,
      unit: selectUnit.value,
      customUnit: inputCustomUnit.value.trim(),
      qty: parseFloat(inputQty.value) || 1,
      price: parseFormattedNumber(inputPrice.value) || 0,
      hasDiscount: toggleDiscount.checked,
      discountType: selectDiscountType.value,
      discountVal: parseFloat(inputDiscountVal.value) || 0
    });

    // Reset Form
    inputName.value = '';
    inputQty.value = '1';
    inputPrice.value = '';
    inputDiscountVal.value = '';
    if (selectUnit.value === 'custom') {
      selectUnit.value = 'unit';
      inputCustomUnit.classList.add('hidden');
    }
    toggleDiscount.checked = false;
    discountFields.classList.add('hidden');
    previewSubtotal.textContent = 'Rp 0';
    inputName.focus();
  });

  // Preset Buttons
  document.querySelectorAll('.btn-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      addItem({
        name: btn.dataset.name,
        unit: btn.dataset.unit,
        qty: parseFloat(btn.dataset.qty),
        price: parseFloat(btn.dataset.price),
        hasDiscount: false
      });
    });
  });

  // Quick Add Blank Row
  document.getElementById('btn-quick-add-blank').addEventListener('click', () => {
    addItem({
      name: 'Item ' + (state.items.length + 1),
      unit: 'unit',
      qty: 1,
      price: 0
    });
  });

  // Clear All Button
  document.getElementById('btn-clear-all').addEventListener('click', clearAllItems);

  // Global Discount Binding
  const discountGlobalVal = document.getElementById('discount-global-val');
  const discountGlobalType = document.getElementById('discount-global-type');
  discountGlobalVal.addEventListener('input', () => {
    state.globalDiscount.val = parseFloat(discountGlobalVal.value) || 0;
    render();
  });
  discountGlobalType.addEventListener('change', () => {
    state.globalDiscount.type = discountGlobalType.value;
    render();
  });

  // Tax Binding
  const toggleTax = document.getElementById('toggle-tax');
  const taxPercentVal = document.getElementById('tax-percent-val');
  toggleTax.addEventListener('change', () => {
    state.tax.enabled = toggleTax.checked;
    render();
  });
  taxPercentVal.addEventListener('input', () => {
    state.tax.percent = parseFloat(taxPercentVal.value) || 0;
    render();
  });

  // Shipping Fee Binding
  const inputShipping = document.getElementById('input-shipping-fee');
  inputShipping.addEventListener('input', (e) => {
    const raw = parseFormattedNumber(e.target.value);
    state.shippingFee = raw;
    if (!isNaN(raw) && raw > 0) {
      e.target.value = new Intl.NumberFormat('id-ID').format(raw);
    }
    render();
  });

  // Notes Binding
  const inputNotes = document.getElementById('input-transaction-notes');
  inputNotes.addEventListener('input', () => {
    state.notes = inputNotes.value;
    saveDraftToStorage();
  });

  // Export CSV
  document.getElementById('btn-export-csv').addEventListener('click', exportToCSV);

  // Export JSON
  document.getElementById('btn-export-json').addEventListener('click', exportToJSON);

  // Modal Invoice Actions
  document.getElementById('btn-open-invoice').addEventListener('click', openInvoiceModal);
  document.getElementById('btn-close-invoice').addEventListener('click', closeInvoiceModal);
  document.getElementById('btn-close-invoice-2').addEventListener('click', closeInvoiceModal);
  document.getElementById('btn-trigger-print').addEventListener('click', () => {
    window.print();
  });

  // Live update invoice header when inputs change
  document.getElementById('invoice-store-name').addEventListener('input', (e) => {
    document.getElementById('inv-render-store').textContent = e.target.value.toUpperCase() || 'TOKO SAYA';
  });
  document.getElementById('invoice-customer-name').addEventListener('input', (e) => {
    document.getElementById('inv-render-customer').textContent = e.target.value || 'Pelanggan Umum';
  });

  // History Modal Actions
  document.getElementById('btn-open-history').addEventListener('click', openHistoryModal);
  document.getElementById('btn-close-history').addEventListener('click', closeHistoryModal);
  document.getElementById('btn-close-history-2').addEventListener('click', closeHistoryModal);
  document.getElementById('btn-save-draft').addEventListener('click', saveCurrentToHistory);
  document.getElementById('btn-clear-history').addEventListener('click', clearAllHistory);
}

// ==========================================
// INVOICE / NOTA STRUK MODAL
// ==========================================

function openInvoiceModal() {
  if (state.items.length === 0) {
    showToast('Tambahkan setidaknya 1 barang untuk mencetak struk!', 'warning');
    return;
  }

  const summary = calculateSummary();
  const dateStr = new Intl.DateTimeFormat('id-ID', { dateStyle: 'full', timeStyle: 'short' }).format(new Date());
  const invoiceNo = '#INV-' + new Date().toISOString().slice(2,10).replace(/-/g,'') + '-' + Math.floor(1000 + Math.random() * 9000);

  document.getElementById('inv-render-date').textContent = `Tanggal: ${dateStr}`;
  document.getElementById('inv-render-no').textContent = `No: ${invoiceNo}`;

  // Render Table in Invoice
  const invTbody = document.getElementById('invoice-table-body');
  invTbody.innerHTML = state.items.map(item => {
    const calc = calculateItemSubtotal(item);
    const unitText = item.unit === 'custom' ? (item.customUnit || 'Satuan') : (UNIT_LABELS[item.unit] || item.unit);
    return `
      <tr class="border-b border-slate-100">
        <td class="py-1.5 font-semibold text-slate-800">${escapeHtml(item.name)}</td>
        <td class="py-1.5 text-center font-mono">${item.qty} ${escapeHtml(unitText)}</td>
        <td class="py-1.5 text-right font-mono">${formatRupiah(item.price)}</td>
        <td class="py-1.5 text-right font-mono font-bold">${formatRupiah(calc.subtotal)}</td>
      </tr>
    `;
  }).join('');

  // Render Summary in Invoice
  document.getElementById('inv-subtotal').textContent = formatRupiah(summary.subtotal);

  const rowDisc = document.getElementById('inv-row-discount');
  if (summary.discountGlobalAmount > 0) {
    rowDisc.classList.remove('hidden');
    document.getElementById('inv-discount').textContent = `- ${formatRupiah(summary.discountGlobalAmount)}`;
  } else {
    rowDisc.classList.add('hidden');
  }

  const rowTax = document.getElementById('inv-row-tax');
  if (summary.taxAmount > 0) {
    rowTax.classList.remove('hidden');
    document.getElementById('inv-tax').textContent = `+ ${formatRupiah(summary.taxAmount)}`;
  } else {
    rowTax.classList.add('hidden');
  }

  const rowShipping = document.getElementById('inv-row-shipping');
  if (summary.shipping > 0) {
    rowShipping.classList.remove('hidden');
    document.getElementById('inv-shipping').textContent = `+ ${formatRupiah(summary.shipping)}`;
  } else {
    rowShipping.classList.add('hidden');
  }

  document.getElementById('inv-grand-total').textContent = formatRupiah(summary.grandTotal);
  document.getElementById('inv-terbilang').textContent = `(Terbilang: ${angkaTerbilang(summary.grandTotal)})`;

  // Notes
  const notesContainer = document.getElementById('inv-notes-container');
  if (state.notes.trim()) {
    notesContainer.classList.remove('hidden');
    document.getElementById('inv-notes-text').textContent = state.notes;
  } else {
    notesContainer.classList.add('hidden');
  }

  document.getElementById('modal-invoice').classList.remove('hidden');
}

function closeInvoiceModal() {
  document.getElementById('modal-invoice').classList.add('hidden');
}

// ==========================================
// EXPORT DATA (CSV & JSON)
// ==========================================

function exportToCSV() {
  if (state.items.length === 0) {
    showToast('Daftar barang masih kosong!', 'warning');
    return;
  }

  const summary = calculateSummary();
  let csv = '\uFEFF'; // UTF-8 BOM agar rapi di Microsoft Excel
  
  // Headers
  csv += 'No,Nama Barang,Satuan,Jumlah,Harga Satuan,Diskon Item,Total Item\n';

  state.items.forEach((item, idx) => {
    const calc = calculateItemSubtotal(item);
    const unitText = item.unit === 'custom' ? (item.customUnit || 'Satuan') : (UNIT_LABELS[item.unit] || item.unit);
    const nameSanitized = `"${item.name.replace(/"/g, '""')}"`;
    const discountText = item.hasDiscount ? (item.discountType === 'percent' ? `${item.discountVal}%` : item.discountVal) : '0';
    
    csv += `${idx + 1},${nameSanitized},"${unitText}",${item.qty},${item.price},"${discountText}",${calc.subtotal}\n`;
  });

  // Summary Rows
  csv += `\n,,,,Subtotal Pembelian,,${summary.subtotal}\n`;
  if (summary.discountGlobalAmount > 0) {
    csv += `,,,,Diskon Tambahan,,-${summary.discountGlobalAmount}\n`;
  }
  if (summary.taxAmount > 0) {
    csv += `,,,,PPN (${state.tax.percent}%),,+${summary.taxAmount}\n`;
  }
  if (summary.shipping > 0) {
    csv += `,,,,Ongkir / Biaya Tambahan,,+${summary.shipping}\n`;
  }
  csv += `,,,,GRAND TOTAL SEMUA,,${summary.grandTotal}\n`;
  csv += `,,,,Terbilang: "${angkaTerbilang(summary.grandTotal)}",,\n`;

  // Download trigger
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Belanja_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast('File CSV berhasil diunduh!');
}

function exportToJSON() {
  if (state.items.length === 0) {
    showToast('Daftar barang masih kosong!', 'warning');
    return;
  }

  const payload = {
    exportDate: new Date().toISOString(),
    items: state.items,
    globalDiscount: state.globalDiscount,
    tax: state.tax,
    shippingFee: state.shippingFee,
    notes: state.notes,
    summary: calculateSummary()
  };

  const jsonStr = JSON.stringify(payload, null, 2);
  navigator.clipboard.writeText(jsonStr).then(() => {
    showToast('Data transaksi disalin ke Clipboard sebagai format JSON!');
  }).catch(() => {
    // Fallback if clipboard API is blocked
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Belanja_${Date.now()}.json`;
    link.click();
    showToast('Data JSON berhasil diunduh!');
  });
}

// ==========================================
// RIWAYAT TRANSAKSI & LOCAL STORAGE
// ==========================================

function saveDraftToStorage() {
  const draftData = {
    items: state.items,
    globalDiscount: state.globalDiscount,
    tax: state.tax,
    shippingFee: state.shippingFee,
    notes: state.notes
  };
  localStorage.setItem('belanjacalc_draft', JSON.stringify(draftData));
}

function loadDraftFromStorage() {
  try {
    const raw = localStorage.getItem('belanjacalc_draft');
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data.items)) state.items = data.items;
      if (data.globalDiscount) {
        state.globalDiscount = data.globalDiscount;
        document.getElementById('discount-global-type').value = data.globalDiscount.type || 'nominal';
        document.getElementById('discount-global-val').value = data.globalDiscount.val || '';
      }
      if (data.tax) {
        state.tax = data.tax;
        document.getElementById('toggle-tax').checked = !!data.tax.enabled;
        document.getElementById('tax-percent-val').value = data.tax.percent || 11;
      }
      if (data.shippingFee) {
        state.shippingFee = data.shippingFee;
        document.getElementById('input-shipping-fee').value = formatRupiah(data.shippingFee, false);
      }
      if (data.notes) {
        state.notes = data.notes;
        document.getElementById('input-transaction-notes').value = data.notes;
      }
    }
  } catch (e) {
    console.error('Failed to load draft:', e);
  }
}

function loadHistoryFromStorage() {
  try {
    const raw = localStorage.getItem('belanjacalc_history');
    state.history = raw ? JSON.parse(raw) : [];
    updateHistoryBadge();
  } catch (e) {
    state.history = [];
  }
}

function updateHistoryBadge() {
  const badge = document.getElementById('history-badge');
  if (state.history.length > 0) {
    badge.textContent = state.history.length;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function saveCurrentToHistory() {
  if (state.items.length === 0) {
    showToast('Tambahkan item belanja terlebih dahulu!', 'warning');
    return;
  }

  const summary = calculateSummary();
  const newEntry = {
    id: 'tx_' + Date.now(),
    date: new Date().toLocaleString('id-ID'),
    itemCount: state.items.length,
    grandTotal: summary.grandTotal,
    items: JSON.parse(JSON.stringify(state.items)),
    globalDiscount: { ...state.globalDiscount },
    tax: { ...state.tax },
    shippingFee: state.shippingFee,
    notes: state.notes
  };

  state.history.unshift(newEntry);
  // Simpan maksimal 30 transaksi
  if (state.history.length > 30) state.history.pop();
  localStorage.setItem('belanjacalc_history', JSON.stringify(state.history));
  updateHistoryBadge();
  showToast('Transaksi berhasil disimpan ke Riwayat!');
}

function openHistoryModal() {
  const modal = document.getElementById('modal-history');
  const emptyView = document.getElementById('history-empty');
  const listView = document.getElementById('history-list');

  if (state.history.length === 0) {
    emptyView.classList.remove('hidden');
    listView.innerHTML = '';
  } else {
    emptyView.classList.add('hidden');
    listView.innerHTML = state.history.map(item => `
      <div class="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center justify-between gap-3">
        <div class="flex-1">
          <div class="flex items-center gap-2">
            <span class="font-bold text-sm text-slate-900 dark:text-white font-mono">${formatRupiah(item.grandTotal)}</span>
            <span class="text-xs px-2 py-0.5 rounded-full bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 font-semibold">${item.itemCount} Item</span>
          </div>
          <div class="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
            <span>📅 ${item.date}</span>
            ${item.notes ? `<span class="truncate max-w-[200px]">📝 ${escapeHtml(item.notes)}</span>` : ''}
          </div>
        </div>

        <div class="flex items-center gap-1.5">
          <button onclick="restoreHistoryItem('${item.id}')" class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-600 hover:bg-brand-700 text-white shadow-sm transition">
            Buka
          </button>
          <button onclick="deleteHistoryItem('${item.id}')" class="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition">
            <i data-lucide="trash" class="w-4 h-4"></i>
          </button>
        </div>
      </div>
    `).join('');
  }

  modal.classList.remove('hidden');
  lucide.createIcons();
}

function closeHistoryModal() {
  document.getElementById('modal-history').classList.add('hidden');
}

function restoreHistoryItem(id) {
  const entry = state.history.find(h => h.id === id);
  if (entry) {
    state.items = JSON.parse(JSON.stringify(entry.items));
    state.globalDiscount = { ...entry.globalDiscount };
    state.tax = { ...entry.tax };
    state.shippingFee = entry.shippingFee || 0;
    state.notes = entry.notes || '';

    // Update UI controls
    document.getElementById('discount-global-type').value = state.globalDiscount.type;
    document.getElementById('discount-global-val').value = state.globalDiscount.val || '';
    document.getElementById('toggle-tax').checked = !!state.tax.enabled;
    document.getElementById('tax-percent-val').value = state.tax.percent || 11;
    document.getElementById('input-shipping-fee').value = state.shippingFee ? formatRupiah(state.shippingFee, false) : '';
    document.getElementById('input-transaction-notes').value = state.notes;

    render();
    closeHistoryModal();
    showToast('Riwayat transaksi berhasil dimuat ke kalkulator!');
  }
}

function deleteHistoryItem(id) {
  state.history = state.history.filter(h => h.id !== id);
  localStorage.setItem('belanjacalc_history', JSON.stringify(state.history));
  updateHistoryBadge();
  openHistoryModal(); // Refresh modal view
  showToast('Satu riwayat dihapus.', 'warning');
}

function clearAllHistory() {
  if (state.history.length === 0) return;
  if (confirm('Hapus semua riwayat transaksi yang tersimpan?')) {
    state.history = [];
    localStorage.removeItem('belanjacalc_history');
    updateHistoryBadge();
    openHistoryModal();
    showToast('Semua riwayat telah dihapus.');
  }
}

// ==========================================
// TOAST NOTIFICATION UTILS
// ==========================================

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  
  const bgClass = type === 'warning' 
    ? 'bg-amber-600 text-white shadow-amber-600/30' 
    : (type === 'error' ? 'bg-rose-600 text-white shadow-rose-600/30' : 'bg-slate-900 dark:bg-emerald-600 text-white shadow-emerald-600/20');

  const icon = type === 'warning' ? 'alert-triangle' : (type === 'error' ? 'x-circle' : 'check-circle-2');

  toast.className = `pointer-events-auto px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2.5 text-xs sm:text-sm font-medium transition-all duration-300 transform translate-y-2 opacity-0 ${bgClass}`;
  toast.innerHTML = `<i data-lucide="${icon}" class="w-4 h-4 shrink-0"></i> <span>${escapeHtml(message)}</span>`;

  container.appendChild(toast);
  lucide.createIcons();

  // Animation trigger
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ==========================================
// HTML ESCAPING
// ==========================================
function escapeHtml(string) {
  if (!string) return '';
  return String(string)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
