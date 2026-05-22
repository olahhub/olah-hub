<script setup lang="ts">
definePageMeta({ layout: 'default' })

const supabase = useSupabaseClient()

const { data: members } = await useAsyncData('members-harga', async () => {
  const { data } = await supabase.from('members').select('id, full_name').eq('is_active', true).order('full_name')
  return data ?? []
})

const { data: offtakers } = await useAsyncData('offtakers-harga', async () => {
  const { data } = await supabase.from('offtakers').select('id, company_name').eq('is_active', true).order('company_name')
  return data ?? []
})

const { data: buyPrices, refresh: refreshBuy } = await useAsyncData('buy-prices', async () => {
  const { data } = await supabase
    .from('buy_price_configs')
    .select('*, members(full_name)')
    .order('effective_date', { ascending: false })
  return data ?? []
})

const { data: sellPrices, refresh: refreshSell } = await useAsyncData('sell-prices', async () => {
  const { data } = await supabase
    .from('sell_price_configs')
    .select('*, offtakers(company_name)')
    .order('effective_date', { ascending: false })
  return data ?? []
})

// Harga aktif per member/offtaker
function getActiveBuyPrice(memberId: string) {
  return buyPrices.value
    ?.filter(p => p.member_id === memberId)
    .sort((a, b) => new Date(b.effective_date).getTime() - new Date(a.effective_date).getTime())[0]
}

function getActiveSellPrice(offtakerId: string) {
  return sellPrices.value
    ?.filter(p => p.offtaker_id === offtakerId)
    .sort((a, b) => new Date(b.effective_date).getTime() - new Date(a.effective_date).getTime())[0]
}

// Modal Harga Beli
const showBuyModal = ref(false)
const buyLoading = ref(false)
const buyError = ref('')
const buyForm = reactive({
  member_id: '',
  price_per_kg: '',
  effective_date: new Date().toISOString().split('T')[0],
  notes: '',
})

async function saveBuyPrice() {
  if (!buyForm.member_id || !buyForm.price_per_kg) {
    buyError.value = 'Member dan harga wajib diisi'
    return
  }
  buyLoading.value = true
  buyError.value = ''
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase.from('buy_price_configs').insert({
    member_id: buyForm.member_id,
    price_per_kg: Number(buyForm.price_per_kg),
    effective_date: buyForm.effective_date,
    notes: buyForm.notes || null,
    created_by: user?.id,
  })
  if (error) { buyError.value = 'Gagal menyimpan'; buyLoading.value = false; return }
  showBuyModal.value = false
  Object.assign(buyForm, { member_id: '', price_per_kg: '', notes: '', effective_date: new Date().toISOString().split('T')[0] })
  buyLoading.value = false
  refreshBuy()
}

// Modal Harga Jual
const showSellModal = ref(false)
const sellLoading = ref(false)
const sellError = ref('')
const sellForm = reactive({
  offtaker_id: '',
  price_per_kg: '',
  effective_date: new Date().toISOString().split('T')[0],
  notes: '',
})

async function saveSellPrice() {
  if (!sellForm.offtaker_id || !sellForm.price_per_kg) {
    sellError.value = 'Offtaker dan harga wajib diisi'
    return
  }
  sellLoading.value = true
  sellError.value = ''
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase.from('sell_price_configs').insert({
    offtaker_id: sellForm.offtaker_id,
    price_per_kg: Number(sellForm.price_per_kg),
    effective_date: sellForm.effective_date,
    notes: sellForm.notes || null,
    created_by: user?.id,
  })
  if (error) { sellError.value = 'Gagal menyimpan'; sellLoading.value = false; return }
  showSellModal.value = false
  Object.assign(sellForm, { offtaker_id: '', price_per_kg: '', notes: '', effective_date: new Date().toISOString().split('T')[0] })
  sellLoading.value = false
  refreshSell()
}

// Hapus harga
async function deleteBuyPrice(id: string) {
  await supabase.from('buy_price_configs').delete().eq('id', id)
  refreshBuy()
}

async function deleteSellPrice(id: string) {
  await supabase.from('sell_price_configs').delete().eq('id', id)
  refreshSell()
}

function formatRupiah(amount: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount)
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

const activeTab = ref('beli')
</script>

<template>
  <div>
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-2xl font-bold text-gray-800">Kelola Harga</h2>
        <p class="text-gray-400 text-sm mt-0.5">Atur harga beli dari member dan harga jual ke offtaker</p>
      </div>
      <button
        class="flex items-center gap-2 text-sm font-semibold text-white px-4 py-2.5 rounded-xl shadow-sm hover:opacity-90 transition-all"
        style="background-color:#16a34a"
        @click="activeTab === 'beli' ? showBuyModal = true : showSellModal = true"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Set Harga {{ activeTab === 'beli' ? 'Beli' : 'Jual' }}
      </button>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
      <button
        class="px-4 py-2 text-sm font-medium rounded-lg transition-all"
        :class="activeTab === 'beli' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'"
        @click="activeTab = 'beli'"
      >
        Harga Beli
        <span class="ml-1 text-xs text-gray-400">(dari member)</span>
      </button>
      <button
        class="px-4 py-2 text-sm font-medium rounded-lg transition-all"
        :class="activeTab === 'jual' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'"
        @click="activeTab = 'jual'"
      >
        Harga Jual
        <span class="ml-1 text-xs text-gray-400">(ke offtaker)</span>
      </button>
    </div>

    <!-- Tab Harga Beli -->
    <div v-if="activeTab === 'beli'" class="space-y-4">
      <!-- Harga Aktif -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="m in members"
          :key="m.id"
          class="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm"
        >
          <div class="flex items-center gap-3 mb-3">
            <div class="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style="background-color:#16a34a">
              {{ m.full_name.charAt(0) }}
            </div>
            <p class="font-medium text-gray-800">{{ m.full_name }}</p>
          </div>
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs text-gray-400">Harga Aktif</p>
              <p class="text-lg font-bold" :style="getActiveBuyPrice(m.id) ? 'color:#16a34a' : 'color:#9ca3af'">
                {{ getActiveBuyPrice(m.id) ? formatRupiah(getActiveBuyPrice(m.id)!.price_per_kg) + '/L' : 'Belum diset' }}
              </p>
              <p v-if="getActiveBuyPrice(m.id)" class="text-xs text-gray-400">
                Sejak {{ formatDate(getActiveBuyPrice(m.id)!.effective_date) }}
              </p>
            </div>
            <button
              class="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
              style="background:#f0fdf4;color:#16a34a"
              @click="() => { buyForm.member_id = m.id; showBuyModal = true }"
            >
              Update
            </button>
          </div>
        </div>
      </div>

      <!-- Riwayat Harga Beli -->
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div class="px-4 py-3 border-b border-gray-50">
          <p class="text-sm font-semibold text-gray-700">Riwayat Perubahan Harga Beli</p>
        </div>
        <table class="w-full text-sm text-left">
          <thead>
            <tr style="background-color:#f9fafb">
              <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Member</th>
              <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Harga/L</th>
              <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Berlaku</th>
              <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Catatan</th>
              <th class="py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!buyPrices?.length">
              <td colspan="5" class="py-8 text-center text-gray-400">Belum ada riwayat harga beli</td>
            </tr>
            <tr v-for="p in buyPrices" :key="p.id" class="border-t border-gray-50 hover:bg-gray-50">
              <td class="py-3 px-4 font-medium" style="color:#1f2937">{{ p.members?.full_name }}</td>
              <td class="py-3 px-4 font-bold" style="color:#16a34a">{{ formatRupiah(p.price_per_kg) }}</td>
              <td class="py-3 px-4" style="color:#374151">{{ formatDate(p.effective_date) }}</td>
              <td class="py-3 px-4 text-gray-400">{{ p.notes ?? '—' }}</td>
              <td class="py-3 px-4">
                <button class="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors" @click="deleteBuyPrice(p.id)">
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

    <!-- Tab Harga Jual -->
    <div v-if="activeTab === 'jual'" class="space-y-4">
      <!-- Harga Aktif -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="o in offtakers"
          :key="o.id"
          class="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm"
        >
          <div class="flex items-center gap-3 mb-3">
            <div class="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style="background-color:#ea580c">
              {{ o.company_name.charAt(0) }}
            </div>
            <p class="font-medium text-gray-800">{{ o.company_name }}</p>
          </div>
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs text-gray-400">Harga Aktif</p>
              <p class="text-lg font-bold" :style="getActiveSellPrice(o.id) ? 'color:#ea580c' : 'color:#9ca3af'">
                {{ getActiveSellPrice(o.id) ? formatRupiah(getActiveSellPrice(o.id)!.price_per_kg) + '/L' : 'Belum diset' }}
              </p>
              <p v-if="getActiveSellPrice(o.id)" class="text-xs text-gray-400">
                Sejak {{ formatDate(getActiveSellPrice(o.id)!.effective_date) }}
              </p>
            </div>
            <button
              class="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
              style="background:#fff7ed;color:#ea580c"
              @click="() => { sellForm.offtaker_id = o.id; showSellModal = true }"
            >
              Update
            </button>
          </div>
        </div>
      </div>

      <!-- Riwayat Harga Jual -->
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div class="px-4 py-3 border-b border-gray-50">
          <p class="text-sm font-semibold text-gray-700">Riwayat Perubahan Harga Jual</p>
        </div>
        <table class="w-full text-sm text-left">
          <thead>
            <tr style="background-color:#f9fafb">
              <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Offtaker</th>
              <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Harga/L</th>
              <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Berlaku</th>
              <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Catatan</th>
              <th class="py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!sellPrices?.length">
              <td colspan="5" class="py-8 text-center text-gray-400">Belum ada riwayat harga jual</td>
            </tr>
            <tr v-for="p in sellPrices" :key="p.id" class="border-t border-gray-50 hover:bg-gray-50">
              <td class="py-3 px-4 font-medium" style="color:#1f2937">{{ p.offtakers?.company_name }}</td>
              <td class="py-3 px-4 font-bold" style="color:#ea580c">{{ formatRupiah(p.price_per_kg) }}</td>
              <td class="py-3 px-4" style="color:#374151">{{ formatDate(p.effective_date) }}</td>
              <td class="py-3 px-4 text-gray-400">{{ p.notes ?? '—' }}</td>
              <td class="py-3 px-4">
                <button class="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors" @click="deleteSellPrice(p.id)">
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

    <!-- Modal Harga Beli -->
    <div v-if="showBuyModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background:rgba(0,0,0,0.4)">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 class="text-lg font-bold text-gray-800">Set Harga Beli</h3>
          <button class="text-gray-400 hover:text-gray-600" @click="showBuyModal = false">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="px-6 py-4 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Member <span class="text-red-500">*</span></label>
            <select v-model="buyForm.member_id" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="">Pilih member</option>
              <option v-for="m in members" :key="m.id" :value="m.id">{{ m.full_name }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Harga per kg (Rp) <span class="text-red-500">*</span></label>
            <input v-model="buyForm.price_per_kg" type="number" placeholder="Contoh: 3000" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Berlaku Mulai</label>
            <input v-model="buyForm.effective_date" type="date" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Catatan</label>
            <input v-model="buyForm.notes" type="text" placeholder="Opsional" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div v-if="buyError" class="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{{ buyError }}</div>
        </div>
        <div class="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
          <button class="px-4 py-2 text-sm text-gray-500 font-medium" @click="showBuyModal = false">Batal</button>
          <button :disabled="buyLoading" class="px-5 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50" style="background-color:#16a34a" @click="saveBuyPrice">
            {{ buyLoading ? 'Menyimpan...' : 'Simpan Harga Beli' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Harga Jual -->
    <div v-if="showSellModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background:rgba(0,0,0,0.4)">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 class="text-lg font-bold text-gray-800">Set Harga Jual</h3>
          <button class="text-gray-400 hover:text-gray-600" @click="showSellModal = false">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="px-6 py-4 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Offtaker <span class="text-red-500">*</span></label>
            <select v-model="sellForm.offtaker_id" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="">Pilih offtaker</option>
              <option v-for="o in offtakers" :key="o.id" :value="o.id">{{ o.company_name }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Harga per kg (Rp) <span class="text-red-500">*</span></label>
            <input v-model="sellForm.price_per_kg" type="number" placeholder="Contoh: 8000" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Berlaku Mulai</label>
            <input v-model="sellForm.effective_date" type="date" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Catatan</label>
            <input v-model="sellForm.notes" type="text" placeholder="Opsional" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div v-if="sellError" class="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{{ sellError }}</div>
        </div>
        <div class="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
          <button class="px-4 py-2 text-sm text-gray-500 font-medium" @click="showSellModal = false">Batal</button>
          <button :disabled="sellLoading" class="px-5 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50" style="background-color:#ea580c" @click="saveSellPrice">
            {{ sellLoading ? 'Menyimpan...' : 'Simpan Harga Jual' }}
          </button>
        </div>
      </div>
    </div>

  </div>
</template>