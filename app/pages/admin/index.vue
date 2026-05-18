<script setup lang="ts">
definePageMeta({ layout: 'default' })

const supabase = useSupabaseClient()

const { data: stockData } = await useAsyncData('dash-stock', async () => {
  const { data } = await supabase.from('stock_ledger').select('type, volume_liter, created_at')
  return data ?? []
})

const { data: cashData } = await useAsyncData('dash-cash', async () => {
  const { data } = await supabase.from('cash_ledger').select('type, amount, category, created_at')
  return data ?? []
})

const { data: pendingReports } = await useAsyncData('dash-pending', async () => {
  const { data } = await supabase.from('pickup_reports').select('id').eq('status', 'pending')
  return data ?? []
})

const { data: saleData } = await useAsyncData('dash-sales', async () => {
  const { data } = await supabase
    .from('sale_transactions')
    .select('total_amount, volume_liter, sale_date, payment_status')
  return data ?? []
})

const totalStok = computed(() => {
  const masuk = stockData.value?.filter(s => s.type === 'in').reduce((a, b) => a + Number(b.volume_liter), 0) ?? 0
  const keluar = stockData.value?.filter(s => s.type === 'out').reduce((a, b) => a + Number(b.volume_liter), 0) ?? 0
  return masuk - keluar
})

const totalKas = computed(() => {
  const masuk = cashData.value?.filter(c => c.type === 'in').reduce((a, b) => a + Number(b.amount), 0) ?? 0
  const keluar = cashData.value?.filter(c => c.type === 'out').reduce((a, b) => a + Number(b.amount), 0) ?? 0
  return masuk - keluar
})

const totalRevenue = computed(() =>
  saleData.value?.filter(s => s.payment_status === 'paid').reduce((a, b) => a + Number(b.total_amount), 0) ?? 0
)

const totalBeliMinyak = computed(() =>
  cashData.value?.filter(c => c.category === 'reimburse').reduce((a, b) => a + Number(b.amount), 0) ?? 0
)

const totalOperasional = computed(() =>
  cashData.value?.filter(c => c.category === 'operational').reduce((a, b) => a + Number(b.amount), 0) ?? 0
)

const netIncome = computed(() => totalRevenue.value - totalBeliMinyak.value - totalOperasional.value)

function formatRupiah(amount: number) {
  if (Math.abs(amount) >= 1000000) return 'Rp ' + (amount / 1000000).toFixed(1) + ' Jt'
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount)
}

const weeklyVolume = computed(() => {
  const days = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
  const now = new Date()
  const currentDay = now.getDay()
  const monday = new Date(now)
  const diff = currentDay === 0 ? -6 : 1 - currentDay
  monday.setDate(now.getDate() + diff)
  monday.setHours(0, 0, 0, 0)

  return days.map((label, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    
    // Gunakan tanggal lokal bukan UTC
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`

    const volume = stockData.value
      ?.filter(s => {
        if (s.type !== 'in') return false
        // Convert UTC ke lokal untuk perbandingan
        const localDate = new Date(s.created_at)
        const localYear = localDate.getFullYear()
        const localMonth = String(localDate.getMonth() + 1).padStart(2, '0')
        const localDay = String(localDate.getDate()).padStart(2, '0')
        return `${localYear}-${localMonth}-${localDay}` === dateStr
      })
      .reduce((a, b) => a + Number(b.volume_liter), 0) ?? 0
    
    return { label, volume }
  })
})

const monthlyRevenue = computed(() => {
  const months = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const year = d.getFullYear()
    const month = d.getMonth()
    const label = d.toLocaleDateString('id-ID', { month: 'short' })
    const revenue = saleData.value
      ?.filter(s => {
        const sd = new Date(s.sale_date)
        return sd.getFullYear() === year && sd.getMonth() === month && s.payment_status === 'paid'
      })
      .reduce((a, b) => a + Number(b.total_amount), 0) ?? 0
    months.push({ label, revenue })
  }
  return months
})

const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

function barHeight(value: number, data: number[]) {
  const max = Math.max(...data, 1)
  return value > 0 ? Math.max((value / max) * 88, 8) + 'px' : '3px'
}
</script>

<template>
  <div>
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-2xl font-bold text-gray-800">Dashboard</h2>
        <p class="text-gray-400 text-sm mt-0.5">{{ today }}</p>
      </div>
      <NuxtLink
        to="/admin/pickup/buat"
        class="flex items-center gap-2 text-sm font-semibold text-white px-4 py-2 rounded-xl"
        style="background-color:#16a34a"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Buat Jadwal
      </NuxtLink>
    </div>

    <!-- Stat Cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
      <div class="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs font-medium text-gray-400 uppercase tracking-wide">Posisi Kas</span>
          <div class="w-8 h-8 rounded-xl flex items-center justify-center" style="background-color:#dcfce7">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" style="color:#16a34a" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
        </div>
        <p class="text-2xl font-bold text-gray-800">{{ formatRupiah(totalKas) }}</p>
        <p class="text-xs text-gray-400 mt-1">Saldo tersedia</p>
      </div>

      <div class="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs font-medium text-gray-400 uppercase tracking-wide">Revenue</span>
          <div class="w-8 h-8 rounded-xl flex items-center justify-center" style="background-color:#fff7ed">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" style="color:#ea580c" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
        </div>
        <p class="text-2xl font-bold text-gray-800">{{ formatRupiah(totalRevenue) }}</p>
        <p class="text-xs text-gray-400 mt-1">Total penjualan lunas</p>
      </div>

      <div class="rounded-2xl p-4 shadow-sm" style="background:linear-gradient(135deg,#16a34a,#15803d)">
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs font-medium text-green-200 uppercase tracking-wide">Net Income</span>
          <div class="w-8 h-8 rounded-xl flex items-center justify-center" style="background:rgba(255,255,255,0.2)">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
        </div>
        <p class="text-2xl font-bold text-white">{{ formatRupiah(netIncome) }}</p>
        <p class="text-xs text-green-200 mt-1">Laba bersih</p>
      </div>

      <div class="rounded-2xl p-4 shadow-sm" style="background:linear-gradient(135deg,#ea580c,#c2410c)">
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs font-medium text-orange-200 uppercase tracking-wide">Stok Gudang</span>
          <div class="w-8 h-8 rounded-xl flex items-center justify-center" style="background:rgba(255,255,255,0.2)">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
        </div>
        <p class="text-2xl font-bold text-white">{{ totalStok.toFixed(1) }} <span class="text-lg font-normal text-orange-200">L</span></p>
        <p class="text-xs text-orange-200 mt-1">Liter tersedia</p>
      </div>
    </div>

    <!-- Charts -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

      <!-- Weekly Volume -->
      <div class="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div class="mb-4">
          <h3 class="text-sm font-semibold text-gray-700">Volume Pengambilan</h3>
          <p class="text-xs text-gray-400">Minggu ini (liter)</p>
        </div>
        <div class="flex items-end gap-2" style="height:120px">
          <div
            v-for="(d, i) in weeklyVolume"
            :key="i"
            class="flex-1 flex flex-col items-center gap-1 h-full justify-end"
          >
            <span class="text-xs font-medium" style="color:#16a34a;min-height:16px">
              {{ d.volume > 0 ? d.volume : '' }}
            </span>
            <div
              class="w-full rounded-t-lg"
              :style="{
                height: barHeight(d.volume, weeklyVolume.map(w => w.volume)),
                backgroundColor: d.volume > 0 ? '#16a34a' : '#f0fdf4'
              }"
            />
            <span class="text-xs text-gray-400">{{ d.label }}</span>
          </div>
        </div>
      </div>

      <!-- Monthly Revenue -->
      <div class="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div class="mb-4">
          <h3 class="text-sm font-semibold text-gray-700">Revenue Penjualan</h3>
          <p class="text-xs text-gray-400">6 bulan terakhir</p>
        </div>
        <div class="flex items-end gap-2" style="height:120px">
          <div
            v-for="(d, i) in monthlyRevenue"
            :key="i"
            class="flex-1 flex flex-col items-center gap-1 h-full justify-end"
          >
            <span class="text-xs font-medium" style="color:#ea580c;min-height:16px;font-size:10px">
              {{ d.revenue > 0 ? (d.revenue >= 1000000 ? (d.revenue/1000000).toFixed(1)+'Jt' : (d.revenue/1000).toFixed(0)+'Rb') : '' }}
            </span>
            <div
              class="w-full rounded-t-lg"
              :style="{
                height: barHeight(d.revenue, monthlyRevenue.map(m => m.revenue)),
                backgroundColor: d.revenue > 0 ? '#ea580c' : '#fff7ed'
              }"
            />
            <span class="text-xs text-gray-400">{{ d.label }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
      <NuxtLink
        to="/admin/pickup"
        class="flex items-center gap-3 bg-white border border-gray-100 rounded-xl p-4 hover:border-green-200 hover:bg-green-50 transition-all shadow-sm"
      >
        <div class="rounded-xl p-2.5" style="background-color:#dcfce7">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" style="color:#16a34a" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </div>
        <div>
          <p class="text-sm font-semibold text-gray-700">Review Laporan</p>
          <p class="text-xs text-gray-400">{{ pendingReports?.length ? `${pendingReports.length} menunggu` : 'Semua beres' }}</p>
        </div>
      </NuxtLink>

      <NuxtLink
        to="/admin/finance"
        class="flex items-center gap-3 bg-white border border-gray-100 rounded-xl p-4 hover:border-orange-200 hover:bg-orange-50 transition-all shadow-sm"
      >
        <div class="rounded-xl p-2.5" style="background-color:#fff7ed">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" style="color:#ea580c" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p class="text-sm font-semibold text-gray-700">Keuangan</p>
          <p class="text-xs text-gray-400">Kas & transaksi</p>
        </div>
      </NuxtLink>

      <NuxtLink
        to="/admin/stok"
        class="flex items-center gap-3 bg-white border border-gray-100 rounded-xl p-4 hover:border-green-200 hover:bg-green-50 transition-all shadow-sm"
      >
        <div class="rounded-xl p-2.5" style="background-color:#dcfce7">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" style="color:#16a34a" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
        <div>
          <p class="text-sm font-semibold text-gray-700">Stok Gudang</p>
          <p class="text-xs text-gray-400">{{ totalStok.toFixed(1) }} L tersedia</p>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>