<script setup lang="ts">
definePageMeta({ layout: 'default' })

const supabase = useSupabaseClient()

const { data: cashLedger, refresh: refreshCash } = await useAsyncData('cash-data', async () => {
  const { data } = await supabase.from('cash_ledger').select('*').order('created_at', { ascending: false })
  return data ?? []
})

const { data: pendingReimburse, refresh: refreshReimburse } = await useAsyncData('reimburse-data', async () => {
  const { data } = await supabase
    .from('pickup_reports')
    .select('*, members(full_name), kurir:users!pickup_reports_kurir_id_fkey(full_name), pickup_schedules(scheduled_date)')
    .eq('status', 'approved')
    .eq('reimburse_status', 'pending')
    .order('approved_at', { ascending: false })
  return data ?? []
})

const { data: sales, refresh: refreshSales } = await useAsyncData('sales-data', async () => {
  const { data } = await supabase
    .from('sale_transactions')
    .select('*, offtakers(company_name)')
    .order('sale_date', { ascending: false })
  return data ?? []
})

const { data: expenses, refresh: refreshExpenses } = await useAsyncData('expenses-data', async () => {
  const { data } = await supabase
    .from('operational_expenses')
    .select('*')
    .order('expense_date', { ascending: false })
  return data ?? []
})

const { data: capitals, refresh: refreshCapitals } = await useAsyncData('capitals-data', async () => {
  const { data } = await supabase
    .from('capital_entries')
    .select('*')
    .order('entry_date', { ascending: false })
  return data ?? []
})

const { data: offtakers } = await useAsyncData('offtakers-finance', async () => {
  const { data } = await supabase.from('offtakers').select('id, company_name').eq('is_active', true)
  return data ?? []
})

// Kalkulasi
const totalKas = computed(() => {
  const masuk = cashLedger.value?.filter(c => c.type === 'in').reduce((a, b) => a + Number(b.amount), 0) ?? 0
  const keluar = cashLedger.value?.filter(c => c.type === 'out').reduce((a, b) => a + Number(b.amount), 0) ?? 0
  return masuk - keluar
})
const totalMasuk = computed(() => cashLedger.value?.filter(c => c.type === 'in').reduce((a, b) => a + Number(b.amount), 0) ?? 0)
const totalKeluar = computed(() => cashLedger.value?.filter(c => c.type === 'out').reduce((a, b) => a + Number(b.amount), 0) ?? 0)

function formatRupiah(amount: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount)
}
function formatDate(date: string) {
  return new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}
function formatDateTime(date: string) {
  return new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const categoryLabel: Record<string, string> = {
  reimburse: 'Reimburse Kurir',
  sale_income: 'Penjualan',
  capital: 'Penambahan Modal',
  operational: 'Operasional',
}

const activeTab = ref('kas')

// Reimburse
const reimburseLoading = ref<string | null>(null)
async function approveReimburse(reportId: string) {
  reimburseLoading.value = reportId
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('pickup_reports').update({
    reimburse_status: 'approved',
    reimburse_approved_by: user?.id,
    reimburse_approved_at: new Date().toISOString(),
  }).eq('id', reportId)
  reimburseLoading.value = null
  refreshReimburse()
  refreshCash()
}

// Modal Penjualan
const showSaleModal = ref(false)
const saleLoading = ref(false)
const saleError = ref('')
const saleForm = reactive({ offtaker_id: '', volume_liter: '', price_per_liter: '', sale_date: new Date().toISOString().split('T')[0], notes: '' })
const saleTotalAmount = computed(() => !saleForm.volume_liter || !saleForm.price_per_liter ? 0 : Number(saleForm.volume_liter) * Number(saleForm.price_per_liter))

async function onOfftakerChange() {
  if (!saleForm.offtaker_id) return
  const { data } = await supabase.from('sell_price_configs').select('price_per_liter').eq('offtaker_id', saleForm.offtaker_id).order('effective_date', { ascending: false }).limit(1).single()
  if (data) saleForm.price_per_liter = data.price_per_liter.toString()
}

async function submitSale() {
  if (!saleForm.offtaker_id || !saleForm.volume_liter || !saleForm.price_per_liter) { saleError.value = 'Semua field wajib diisi'; return }
  saleLoading.value = true; saleError.value = ''
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase.from('sale_transactions').insert({
    offtaker_id: saleForm.offtaker_id, volume_liter: Number(saleForm.volume_liter),
    price_per_liter: Number(saleForm.price_per_liter), total_amount: saleTotalAmount.value,
    sale_date: saleForm.sale_date, notes: saleForm.notes || null, created_by: user?.id,
  })
  if (error) { saleError.value = 'Gagal menyimpan'; saleLoading.value = false; return }
  showSaleModal.value = false
  Object.assign(saleForm, { offtaker_id: '', volume_liter: '', price_per_liter: '', sale_date: new Date().toISOString().split('T')[0], notes: '' })
  saleLoading.value = false
  refreshSales(); refreshCash()
}

async function markPaid(saleId: string) {
  await supabase.from('sale_transactions').update({ payment_status: 'paid', payment_date: new Date().toISOString().split('T')[0] }).eq('id', saleId)
  refreshSales(); refreshCash()
}

// Modal Pengeluaran
const showExpenseModal = ref(false)
const expenseLoading = ref(false)
const expenseError = ref('')

async function submitExpense() {
  if (!expenseForm.amount || !expenseForm.description) { expenseError.value = 'Jumlah dan keterangan wajib diisi'; return }
  expenseLoading.value = true; expenseError.value = ''
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase.from('operational_expenses').insert({
    category: expenseForm.category, amount: Number(expenseForm.amount),
    expense_date: expenseForm.expense_date, description: expenseForm.description, created_by: user?.id,
  })
  if (error) { expenseError.value = 'Gagal menyimpan'; expenseLoading.value = false; return }
  showExpenseModal.value = false
  Object.assign(expenseForm, { category: 'Transportasi', amount: '', expense_date: new Date().toISOString().split('T')[0], description: '' })
  expenseLoading.value = false
  refreshExpenses(); refreshCash()
}

async function deleteExpense(id: string) {
  await supabase.from('operational_expenses').delete().eq('id', id)
  refreshExpenses(); refreshCash()
}

// Modal Modal
const showCapitalModal = ref(false)
const capitalLoading = ref(false)
const capitalError = ref('')
const capitalForm = reactive({ amount: '', source: '', entry_date: new Date().toISOString().split('T')[0], notes: '' })

async function submitCapital() {
  if (!capitalForm.amount || !capitalForm.source) { capitalError.value = 'Jumlah dan sumber wajib diisi'; return }
  capitalLoading.value = true; capitalError.value = ''
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase.from('capital_entries').insert({
    amount: Number(capitalForm.amount), source: capitalForm.source,
    entry_date: capitalForm.entry_date, notes: capitalForm.notes || null, created_by: user?.id,
  })
  if (error) { capitalError.value = 'Gagal menyimpan'; capitalLoading.value = false; return }
  showCapitalModal.value = false
  Object.assign(capitalForm, { amount: '', source: '', entry_date: new Date().toISOString().split('T')[0], notes: '' })
  capitalLoading.value = false
  refreshCapitals(); refreshCash()
}

async function deleteCapital(id: string) {
  await supabase.from('capital_entries').delete().eq('id', id)
  refreshCapitals(); refreshCash()
}

// Kategori Pengeluaran Custom
const { data: expenseCategories, refresh: refreshCategories } = await useAsyncData('expense-cats', async () => {
  const { data } = await supabase
    .from('expense_categories')
    .select('*')
    .order('name')
  return data ?? []
})

const categoryNames = computed(() => expenseCategories.value?.map(c => c.name) ?? [])

const expenseForm = reactive({ 
  category: '', // kosongkan dulu, akan diisi dari kategori pertama
  amount: '', 
  expense_date: new Date().toISOString().split('T')[0], 
  description: '' 
})

const showCategoryModal = ref(false)
const newCategory = ref('')

async function addCategory() {
  if (!newCategory.value) return
  await supabase.from('expense_categories').insert({ name: newCategory.value })
  newCategory.value = ''
  refreshCategories()
}

async function removeCategory(id: string) {
  await supabase.from('expense_categories').delete().eq('id', id)
  refreshCategories()
}

</script>

<template>
  <div>
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-2xl font-bold text-gray-800">Keuangan</h2>
        <p class="text-gray-400 text-sm mt-0.5">Posisi kas dan transaksi keuangan</p>
      </div>
      <div class="flex gap-2">
        <button
          v-if="activeTab === 'jual'"
          class="flex items-center gap-2 text-sm font-semibold text-white px-4 py-2.5 rounded-xl hover:opacity-90"
          style="background-color:#16a34a"
          @click="showSaleModal = true"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
          Catat Penjualan
        </button>
        <button
            v-if="activeTab === 'keluar'"
            class="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
            style="color:#374151"
            @click="showCategoryModal = true"
        >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Kategori
        </button>
        <button
            v-if="activeTab === 'keluar'"
            class="flex items-center gap-2 text-sm font-semibold text-white px-4 py-2.5 rounded-xl hover:opacity-90"
            style="background-color:#ea580c"
            @click="showExpenseModal = true"
        >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
            Catat Pengeluaran
        </button>
        <button
          v-if="activeTab === 'modal'"
          class="flex items-center gap-2 text-sm font-semibold text-white px-4 py-2.5 rounded-xl hover:opacity-90"
          style="background-color:#2563eb"
          @click="showCapitalModal = true"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
          Tambah Modal
        </button>
      </div>
    </div>

    <!-- Stat Cards -->
    <div class="grid grid-cols-3 gap-4 mb-6">
      <div class="rounded-2xl p-4 shadow-sm" style="background:linear-gradient(135deg,#16a34a,#15803d)">
        <p class="text-xs text-green-200 uppercase tracking-wide mb-2">Posisi Kas</p>
        <p class="text-2xl font-bold text-white">{{ formatRupiah(totalKas) }}</p>
        <p class="text-xs text-green-200 mt-1">Saldo tersedia</p>
      </div>
      <div class="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <p class="text-xs text-gray-400 uppercase tracking-wide mb-2">Total Masuk</p>
        <p class="text-2xl font-bold text-gray-800">{{ formatRupiah(totalMasuk) }}</p>
        <p class="text-xs text-gray-400 mt-1">Semua pemasukan</p>
      </div>
      <div class="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <p class="text-xs text-gray-400 uppercase tracking-wide mb-2">Total Keluar</p>
        <p class="text-2xl font-bold text-gray-800">{{ formatRupiah(totalKeluar) }}</p>
        <p class="text-xs text-gray-400 mt-1">Semua pengeluaran</p>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 mb-4 bg-gray-100 p-1 rounded-xl w-fit overflow-x-auto">
      <button v-for="tab in [
        { key: 'kas', label: 'Mutasi Kas' },
        { key: 'reimburse', label: `Reimburse${pendingReimburse?.length ? ` (${pendingReimburse.length})` : ''}` },
        { key: 'jual', label: 'Penjualan' },
        { key: 'keluar', label: 'Pengeluaran' },
        { key: 'modal', label: 'Modal' },
      ]" :key="tab.key"
        class="px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap"
        :class="activeTab === tab.key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Tab: Mutasi Kas -->
    <div v-if="activeTab === 'kas'">
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table class="w-full text-sm text-left">
          <thead>
            <tr style="background-color:#f9fafb">
              <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Waktu</th>
              <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Kategori</th>
              <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Tipe</th>
              <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Jumlah</th>
              <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!cashLedger?.length">
              <td colspan="5" class="py-12 text-center text-gray-400">Belum ada mutasi kas</td>
            </tr>
            <tr v-for="c in cashLedger" :key="c.id" class="border-t border-gray-50 hover:bg-gray-50">
              <td class="py-3 px-4 text-xs" style="color:#6b7280">{{ formatDateTime(c.created_at) }}</td>
              <td class="py-3 px-4" style="color:#374151">{{ categoryLabel[c.category] ?? c.category }}</td>
              <td class="py-3 px-4">
                <span class="text-xs font-medium px-2 py-1 rounded-lg" :style="c.type === 'in' ? 'background:#f0fdf4;color:#16a34a' : 'background:#fef2f2;color:#dc2626'">
                  {{ c.type === 'in' ? '↓ Masuk' : '↑ Keluar' }}
                </span>
              </td>
              <td class="py-3 px-4 font-bold" :style="c.type === 'in' ? 'color:#16a34a' : 'color:#dc2626'">
                {{ c.type === 'in' ? '+' : '-' }}{{ formatRupiah(c.amount) }}
              </td>
              <td class="py-3 px-4 text-xs" style="color:#6b7280">{{ c.notes ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Tab: Reimburse -->
    <div v-if="activeTab === 'reimburse'">
      <div v-if="!pendingReimburse?.length" class="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center text-gray-400">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-10 h-10 mx-auto mb-3" style="color:#16a34a" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p class="font-medium">Tidak ada reimburse yang menunggu</p>
      </div>
      <div v-else class="space-y-3">
        <div v-for="r in pendingReimburse" :key="r.id" class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div class="flex items-start justify-between">
            <div>
              <div class="flex items-center gap-2 mb-1">
                <p class="font-semibold text-gray-800">{{ r.kurir?.full_name }}</p>
                <span class="text-xs px-2 py-0.5 rounded-lg font-medium" style="background:#fffbeb;color:#d97706">Pending</span>
              </div>
              <p class="text-sm text-gray-500 mb-3">Pickup: <strong>{{ r.members?.full_name }}</strong> · {{ formatDate(r.pickup_schedules?.scheduled_date) }}</p>
              <div class="flex gap-3">
                <div class="bg-gray-50 rounded-xl px-3 py-2">
                  <p class="text-xs text-gray-400">Volume</p>
                  <p class="font-bold text-gray-800">{{ r.actual_volume_liter }} L</p>
                </div>
                <div class="bg-red-50 rounded-xl px-3 py-2">
                  <p class="text-xs text-red-400">Jumlah Reimburse</p>
                  <p class="font-bold text-red-600">{{ formatRupiah(r.total_paid) }}</p>
                </div>
              </div>
            </div>
            <button
              class="flex items-center gap-2 text-sm font-semibold text-white px-4 py-2 rounded-xl"
              style="background-color:#16a34a"
              :disabled="reimburseLoading === r.id"
              @click="approveReimburse(r.id)"
            >
              {{ reimburseLoading === r.id ? 'Proses...' : 'Approve' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Tab: Penjualan -->
    <div v-if="activeTab === 'jual'">
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table class="w-full text-sm text-left">
          <thead>
            <tr style="background-color:#f9fafb">
              <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Tanggal</th>
              <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Offtaker</th>
              <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Volume</th>
              <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Total</th>
              <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!sales?.length">
              <td colspan="5" class="py-12 text-center text-gray-400">Belum ada penjualan</td>
            </tr>
            <tr v-for="s in sales" :key="s.id" class="border-t border-gray-50 hover:bg-gray-50">
              <td class="py-3 px-4" style="color:#374151">{{ formatDate(s.sale_date) }}</td>
              <td class="py-3 px-4 font-medium" style="color:#1f2937">{{ s.offtakers?.company_name }}</td>
              <td class="py-3 px-4" style="color:#374151">{{ s.volume_liter }} L</td>
              <td class="py-3 px-4 font-bold" style="color:#16a34a">{{ formatRupiah(s.total_amount) }}</td>
              <td class="py-3 px-4">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-medium px-2 py-1 rounded-lg" :style="s.payment_status === 'paid' ? 'background:#f0fdf4;color:#16a34a' : 'background:#fffbeb;color:#d97706'">
                    {{ s.payment_status === 'paid' ? 'Lunas' : 'Belum Lunas' }}
                  </span>
                  <button
                    v-if="s.payment_status === 'unpaid'"
                    class="text-xs font-medium px-2 py-1 rounded-lg"
                    style="background:#f0fdf4;color:#16a34a"
                    @click="markPaid(s.id)"
                  >
                    Tandai Lunas
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Tab: Pengeluaran -->
    <div v-if="activeTab === 'keluar'">
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table class="w-full text-sm text-left">
          <thead>
            <tr style="background-color:#f9fafb">
              <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Tanggal</th>
              <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Kategori</th>
              <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Keterangan</th>
              <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Jumlah</th>
              <th class="py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!expenses?.length">
              <td colspan="5" class="py-12 text-center text-gray-400">Belum ada pengeluaran</td>
            </tr>
            <tr v-for="e in expenses" :key="e.id" class="border-t border-gray-50 hover:bg-gray-50">
              <td class="py-3 px-4" style="color:#374151">{{ formatDate(e.expense_date) }}</td>
              <td class="py-3 px-4">
                <span class="text-xs font-medium px-2 py-1 rounded-lg" style="background:#fff7ed;color:#ea580c">{{ e.category }}</span>
              </td>
              <td class="py-3 px-4" style="color:#374151">{{ e.description }}</td>
              <td class="py-3 px-4 font-bold" style="color:#dc2626">{{ formatRupiah(e.amount) }}</td>
              <td class="py-3 px-4">
                <button class="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors" @click="deleteExpense(e.id)">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Tab: Modal -->
    <div v-if="activeTab === 'modal'">
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table class="w-full text-sm text-left">
          <thead>
            <tr style="background-color:#f9fafb">
              <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Tanggal</th>
              <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Sumber</th>
              <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Jumlah</th>
              <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Catatan</th>
              <th class="py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!capitals?.length">
              <td colspan="5" class="py-12 text-center text-gray-400">Belum ada penambahan modal</td>
            </tr>
            <tr v-for="c in capitals" :key="c.id" class="border-t border-gray-50 hover:bg-gray-50">
              <td class="py-3 px-4" style="color:#374151">{{ formatDate(c.entry_date) }}</td>
              <td class="py-3 px-4 font-medium" style="color:#1f2937">{{ c.source }}</td>
              <td class="py-3 px-4 font-bold" style="color:#16a34a">{{ formatRupiah(c.amount) }}</td>
              <td class="py-3 px-4 text-gray-400">{{ c.notes ?? '—' }}</td>
              <td class="py-3 px-4">
                <button class="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors" @click="deleteCapital(c.id)">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ===== MODALS ===== -->

    <!-- Modal Penjualan -->
    <div v-if="showSaleModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background:rgba(0,0,0,0.4)">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 class="text-lg font-bold text-gray-800">Catat Penjualan</h3>
          <button class="text-gray-400 hover:text-gray-600" @click="showSaleModal = false">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div class="px-6 py-4 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Offtaker <span class="text-red-500">*</span></label>
            <select v-model="saleForm.offtaker_id" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500" @change="onOfftakerChange">
              <option value="">Pilih offtaker</option>
              <option v-for="o in offtakers" :key="o.id" :value="o.id">{{ o.company_name }}</option>
            </select>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Volume (L) <span class="text-red-500">*</span></label>
              <input v-model="saleForm.volume_liter" type="number" step="0.1" placeholder="0" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Harga/L (Rp) <span class="text-red-500">*</span></label>
              <input v-model="saleForm.price_per_liter" type="number" placeholder="0" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          </div>
          <div v-if="saleTotalAmount > 0" class="bg-green-50 rounded-xl p-3 border border-green-100">
            <p class="text-xs text-green-500">Total Penjualan</p>
            <p class="text-xl font-bold text-green-700">{{ formatRupiah(saleTotalAmount) }}</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Tanggal</label>
            <input v-model="saleForm.sale_date" type="date" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Catatan</label>
            <input v-model="saleForm.notes" type="text" placeholder="Opsional" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div v-if="saleError" class="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{{ saleError }}</div>
        </div>
        <div class="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
          <button class="px-4 py-2 text-sm text-gray-500 font-medium" @click="showSaleModal = false">Batal</button>
          <button :disabled="saleLoading" class="px-5 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50" style="background-color:#16a34a" @click="submitSale">
            {{ saleLoading ? 'Menyimpan...' : 'Simpan Penjualan' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Pengeluaran -->
    <div v-if="showExpenseModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background:rgba(0,0,0,0.4)">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 class="text-lg font-bold text-gray-800">Catat Pengeluaran</h3>
          <button class="text-gray-400 hover:text-gray-600" @click="showExpenseModal = false">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div class="px-6 py-4 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Kategori <span class="text-red-500">*</span></label>
            <select v-model="expenseForm.category" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500">
            <option v-for="cat in categoryNames" :key="cat" :value="cat">{{ cat }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Jumlah (Rp) <span class="text-red-500">*</span></label>
            <input v-model="expenseForm.amount" type="number" placeholder="0" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Tanggal</label>
            <input v-model="expenseForm.expense_date" type="date" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Keterangan <span class="text-red-500">*</span></label>
            <textarea v-model="expenseForm.description" rows="2" placeholder="Contoh: Bensin motor kurir 2L" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"></textarea>
          </div>
          <div v-if="expenseError" class="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{{ expenseError }}</div>
        </div>
        <div class="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
          <button class="px-4 py-2 text-sm text-gray-500 font-medium" @click="showExpenseModal = false">Batal</button>
          <button :disabled="expenseLoading" class="px-5 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50" style="background-color:#ea580c" @click="submitExpense">
            {{ expenseLoading ? 'Menyimpan...' : 'Simpan Pengeluaran' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Modal/Capital -->
    <div v-if="showCapitalModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background:rgba(0,0,0,0.4)">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 class="text-lg font-bold text-gray-800">Tambah Modal</h3>
          <button class="text-gray-400 hover:text-gray-600" @click="showCapitalModal = false">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div class="px-6 py-4 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Jumlah (Rp) <span class="text-red-500">*</span></label>
            <input v-model="capitalForm.amount" type="number" placeholder="0" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Sumber Modal <span class="text-red-500">*</span></label>
            <input v-model="capitalForm.source" type="text" placeholder="Contoh: Investor A, Pinjaman Bank" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Tanggal</label>
            <input v-model="capitalForm.entry_date" type="date" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Catatan</label>
            <textarea v-model="capitalForm.notes" rows="2" placeholder="Opsional" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"></textarea>
          </div>
          <div v-if="capitalError" class="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{{ capitalError }}</div>
        </div>
        <div class="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
          <button class="px-4 py-2 text-sm text-gray-500 font-medium" @click="showCapitalModal = false">Batal</button>
          <button :disabled="capitalLoading" class="px-5 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50" style="background-color:#2563eb" @click="submitCapital">
            {{ capitalLoading ? 'Menyimpan...' : 'Simpan Modal' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Kelola Kategori -->
    <div v-if="showCategoryModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background:rgba(0,0,0,0.4)">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 class="text-lg font-bold text-gray-800">Kelola Kategori</h3>
          <button class="text-gray-400 hover:text-gray-600" @click="showCategoryModal = false">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div class="px-6 py-4">
          <!-- Tambah kategori -->
          <div class="flex gap-2 mb-4">
            <input v-model="newCategory" type="text" placeholder="Nama kategori baru" class="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500" @keyup.enter="addCategory" />
            <button class="px-3 py-2 text-sm font-semibold text-white rounded-xl" style="background-color:#16a34a" @click="addCategory">
              Tambah
            </button>
          </div>
          <!-- List kategori -->
          <div class="space-y-2">
            <div
            v-for="cat in expenseCategories"
            :key="cat.id"
              class="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-xl"
            >
              <span class="text-sm font-medium text-gray-700">{{ cat.name }}</span>
              <button class="text-gray-300 hover:text-red-500 transition-colors" @click="removeCategory(cat.id)">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        <div class="px-6 py-4 border-t border-gray-100 flex justify-end">
          <button class="px-4 py-2 text-sm font-medium text-white rounded-xl" style="background-color:#16a34a" @click="showCategoryModal = false">Selesai</button>
        </div>
      </div>
    </div>

  </div>
</template>