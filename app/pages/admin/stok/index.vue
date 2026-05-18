<script setup lang="ts">
definePageMeta({ layout: 'default' })

const supabase = useSupabaseClient()

const { data: ledger } = await useAsyncData(`stock-ledger`, async () => {
  const { data } = await supabase
    .from('stock_ledger')
    .select('*')
    .order('created_at', { ascending: false })
  return data ?? []
})

const totalStok = computed(() => {
  const masuk = ledger.value?.filter(l => l.type === 'in').reduce((a, b) => a + Number(b.volume_liter), 0) ?? 0
  const keluar = ledger.value?.filter(l => l.type === 'out').reduce((a, b) => a + Number(b.volume_liter), 0) ?? 0
  return masuk - keluar
})

const totalMasuk = computed(() =>
  ledger.value?.filter(l => l.type === 'in').reduce((a, b) => a + Number(b.volume_liter), 0) ?? 0
)

const totalKeluar = computed(() =>
  ledger.value?.filter(l => l.type === 'out').reduce((a, b) => a + Number(b.volume_liter), 0) ?? 0
)

const selectedFilter = ref('all')

const filteredLedger = computed(() => {
  if (selectedFilter.value === 'all') return ledger.value ?? []
  return ledger.value?.filter(l => l.type === selectedFilter.value) ?? []
})

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-2xl font-bold text-gray-800">Stok Gudang</h2>
        <p class="text-gray-400 text-sm mt-0.5">Posisi dan mutasi stok jelantah</p>
      </div>
    </div>

    <!-- Stat Cards -->
    <div class="grid grid-cols-3 gap-4 mb-6">
      <div class="rounded-2xl p-4 shadow-sm" style="background:linear-gradient(135deg,#16a34a,#15803d)">
        <p class="text-xs text-green-200 uppercase tracking-wide mb-2">Stok Saat Ini</p>
        <p class="text-3xl font-bold text-white">{{ totalStok.toFixed(1) }}</p>
        <p class="text-xs text-green-200 mt-1">Liter tersedia</p>
      </div>
      <div class="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <p class="text-xs text-gray-400 uppercase tracking-wide mb-2">Total Masuk</p>
        <p class="text-3xl font-bold text-gray-800">{{ totalMasuk.toFixed(1) }}</p>
        <p class="text-xs text-gray-400 mt-1">Liter diterima</p>
      </div>
      <div class="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <p class="text-xs text-gray-400 uppercase tracking-wide mb-2">Total Keluar</p>
        <p class="text-3xl font-bold text-gray-800">{{ totalKeluar.toFixed(1) }}</p>
        <p class="text-xs text-gray-400 mt-1">Liter terjual</p>
      </div>
    </div>

    <!-- Filter & Tabel -->
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-50">
        <p class="text-sm font-semibold text-gray-700">Riwayat Mutasi Stok</p>
        <div class="flex gap-1 bg-gray-100 p-1 rounded-xl">
          <button
            v-for="f in [{ key: 'all', label: 'Semua' }, { key: 'in', label: 'Masuk' }, { key: 'out', label: 'Keluar' }]"
            :key="f.key"
            class="px-3 py-1.5 text-xs font-medium rounded-lg transition-all"
            :class="selectedFilter === f.key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'"
            @click="selectedFilter = f.key"
          >
            {{ f.label }}
          </button>
        </div>
      </div>
      <table class="w-full text-sm text-left">
        <thead>
          <tr style="background-color:#f9fafb">
            <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Waktu</th>
            <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Tipe</th>
            <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Volume</th>
            <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Sumber</th>
            <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Keterangan</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!filteredLedger.length">
            <td colspan="5" class="py-12 text-center text-gray-400">Belum ada mutasi stok</td>
          </tr>
          <tr v-for="l in filteredLedger" :key="l.id" class="border-t border-gray-50 hover:bg-gray-50">
            <td class="py-3 px-4 text-xs" style="color:#6b7280">{{ formatDate(l.created_at) }}</td>
            <td class="py-3 px-4">
              <span class="text-xs font-medium px-2 py-1 rounded-lg"
                :style="l.type === 'in' ? 'background:#f0fdf4;color:#16a34a' : 'background:#fef2f2;color:#dc2626'"
              >
                {{ l.type === 'in' ? '↓ Masuk' : '↑ Keluar' }}
              </span>
            </td>
            <td class="py-3 px-4 font-bold" :style="l.type === 'in' ? 'color:#16a34a' : 'color:#dc2626'">
              {{ l.type === 'in' ? '+' : '-' }}{{ l.volume_liter }} L
            </td>
            <td class="py-3 px-4 text-xs capitalize" style="color:#374151">{{ l.reference_type }}</td>
            <td class="py-3 px-4 text-xs" style="color:#6b7280">{{ l.notes ?? '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>