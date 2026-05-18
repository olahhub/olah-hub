<script setup lang="ts">
definePageMeta({ layout: 'default' })

const supabase = useSupabaseClient()

const { data: offtakers, refresh } = await useAsyncData('offtakers', async () => {
  const { data } = await supabase
    .from('offtakers')
    .select('*')
    .order('created_at', { ascending: false })
  return data ?? []
})

const { data: salesData } = await useAsyncData('offtaker-sales-summary', async () => {
  const { data } = await supabase
    .from('sale_transactions')
    .select('offtaker_id, total_amount, volume_liter, payment_status')
  return data ?? []
})

function getOfftakerVolume(id: string) {
  return salesData.value?.filter(s => s.offtaker_id === id).reduce((a, b) => a + Number(b.volume_liter), 0) ?? 0
}

function getOfftakerRevenue(id: string) {
  return salesData.value?.filter(s => s.offtaker_id === id && s.payment_status === 'paid').reduce((a, b) => a + Number(b.total_amount), 0) ?? 0
}

function getOfftakerPiutang(id: string) {
  return salesData.value?.filter(s => s.offtaker_id === id && s.payment_status === 'unpaid').reduce((a, b) => a + Number(b.total_amount), 0) ?? 0
}

const totalRevenue = computed(() =>
  salesData.value?.filter(s => s.payment_status === 'paid').reduce((a, b) => a + Number(b.total_amount), 0) ?? 0
)
const totalPiutang = computed(() =>
  salesData.value?.filter(s => s.payment_status === 'unpaid').reduce((a, b) => a + Number(b.total_amount), 0) ?? 0
)

// Modal Tambah
const showModal = ref(false)
const modalLoading = ref(false)
const modalError = ref('')
const form = reactive({ company_name: '', contact_name: '', phone: '', address: '', notes: '' })

async function submitOfftaker() {
  if (!form.company_name) { modalError.value = 'Nama perusahaan wajib diisi'; return }
  modalLoading.value = true; modalError.value = ''
  const { error } = await supabase.from('offtakers').insert({
    company_name: form.company_name,
    contact_name: form.contact_name || null,
    phone: form.phone || null,
    address: form.address || null,
    notes: form.notes || null,
  })
  if (error) { modalError.value = 'Gagal menyimpan'; modalLoading.value = false; return }
  showModal.value = false
  Object.assign(form, { company_name: '', contact_name: '', phone: '', address: '', notes: '' })
  modalLoading.value = false
  refresh()
}

// Modal Edit
const showEditModal = ref(false)
const editForm = reactive({ id: '', company_name: '', contact_name: '', phone: '', address: '', notes: '', is_active: true })

function openEdit(o: any) {
  Object.assign(editForm, { id: o.id, company_name: o.company_name, contact_name: o.contact_name ?? '', phone: o.phone ?? '', address: o.address ?? '', notes: o.notes ?? '', is_active: o.is_active })
  showEditModal.value = true
}

async function submitEdit() {
  modalLoading.value = true
  await supabase.from('offtakers').update({
    company_name: editForm.company_name,
    contact_name: editForm.contact_name || null,
    phone: editForm.phone || null,
    address: editForm.address || null,
    notes: editForm.notes || null,
    is_active: editForm.is_active,
    updated_at: new Date().toISOString(),
  }).eq('id', editForm.id)
  showEditModal.value = false; modalLoading.value = false; refresh()
}

// Hapus
const showDeleteModal = ref(false)
const deleteTarget = ref<any>(null)
function openDelete(o: any) { deleteTarget.value = o; showDeleteModal.value = true }
async function confirmDelete() {
  await supabase.from('offtakers').delete().eq('id', deleteTarget.value.id)
  showDeleteModal.value = false; refresh()
}

function formatRupiah(amount: number) {
  if (amount >= 1000000) return 'Rp ' + (amount / 1000000).toFixed(1) + ' Jt'
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount)
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-2xl font-bold text-gray-800">Offtaker</h2>
        <p class="text-gray-400 text-sm mt-0.5">Daftar pembeli jelantah</p>
      </div>
      <button
        class="flex items-center gap-2 text-sm font-semibold text-white px-4 py-2.5 rounded-xl shadow-sm hover:opacity-90"
        style="background-color:#16a34a"
        @click="showModal = true"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
        Tambah Offtaker
      </button>
    </div>

    <!-- Stat Cards -->
    <div class="grid grid-cols-3 gap-4 mb-6">
      <div class="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <p class="text-xs text-gray-400 uppercase tracking-wide mb-2">Total Offtaker</p>
        <p class="text-3xl font-bold text-gray-800">{{ offtakers?.length ?? 0 }}</p>
        <p class="text-xs text-gray-400 mt-1">Terdaftar</p>
      </div>
      <div class="rounded-2xl p-4 shadow-sm" style="background:linear-gradient(135deg,#16a34a,#15803d)">
        <p class="text-xs text-green-200 uppercase tracking-wide mb-2">Total Revenue</p>
        <p class="text-2xl font-bold text-white">{{ formatRupiah(totalRevenue) }}</p>
        <p class="text-xs text-green-200 mt-1">Sudah dibayar</p>
      </div>
      <div class="rounded-2xl p-4 shadow-sm" style="background:linear-gradient(135deg,#ea580c,#c2410c)">
        <p class="text-xs text-orange-200 uppercase tracking-wide mb-2">Piutang</p>
        <p class="text-2xl font-bold text-white">{{ formatRupiah(totalPiutang) }}</p>
        <p class="text-xs text-orange-200 mt-1">Belum dibayar</p>
      </div>
    </div>

    <!-- Tabel -->
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <table class="w-full text-sm text-left">
        <thead>
          <tr style="background-color:#f9fafb">
            <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Perusahaan</th>
            <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Kontak</th>
            <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Total Volume</th>
            <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Revenue</th>
            <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Piutang</th>
            <th class="py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Status</th>
            <th class="py-3 px-4"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!offtakers?.length">
            <td colspan="7" class="py-12 text-center text-gray-400">Belum ada offtaker</td>
          </tr>
          <tr v-for="o in offtakers" :key="o.id" class="border-t border-gray-50 hover:bg-gray-50 transition-colors">
            <td class="py-3 px-4">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style="background-color:#ea580c">
                  {{ o.company_name.charAt(0) }}
                </div>
                <div>
                  <p class="font-medium" style="color:#1f2937">{{ o.company_name }}</p>
                  <p v-if="o.address" class="text-xs text-gray-400">{{ o.address }}</p>
                </div>
              </div>
            </td>
            <td class="py-3 px-4">
              <p style="color:#374151">{{ o.contact_name ?? '—' }}</p>
              <p class="text-xs text-gray-400">{{ o.phone ?? '' }}</p>
            </td>
            <td class="py-3 px-4">
              <span class="font-bold" style="color:#1f2937">{{ getOfftakerVolume(o.id).toFixed(1) }}</span>
              <span class="text-xs text-gray-400 ml-1">L</span>
            </td>
            <td class="py-3 px-4 font-bold" style="color:#16a34a">{{ formatRupiah(getOfftakerRevenue(o.id)) }}</td>
            <td class="py-3 px-4">
              <span class="font-bold" :style="getOfftakerPiutang(o.id) > 0 ? 'color:#ea580c' : 'color:#9ca3af'">
                {{ formatRupiah(getOfftakerPiutang(o.id)) }}
              </span>
            </td>
            <td class="py-3 px-4">
              <span class="text-xs font-medium px-2.5 py-1 rounded-lg"
                :style="o.is_active ? 'background:#f0fdf4;color:#16a34a' : 'background:#f9fafb;color:#9ca3af'"
              >
                {{ o.is_active ? 'Aktif' : 'Nonaktif' }}
              </span>
            </td>
            <td class="py-3 px-4">
              <div class="flex items-center gap-1 justify-end">
                <button class="p-1.5 rounded-lg hover:bg-amber-50 text-gray-300 hover:text-amber-500 transition-colors" @click="openEdit(o)">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
                <button class="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors" @click="openDelete(o)">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal Tambah -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background:rgba(0,0,0,0.4)">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 class="text-lg font-bold text-gray-800">Tambah Offtaker</h3>
          <button class="text-gray-400 hover:text-gray-600" @click="showModal = false">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div class="px-6 py-4 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Nama Perusahaan <span class="text-red-500">*</span></label>
            <input v-model="form.company_name" type="text" placeholder="PT. Contoh Jaya" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Nama Kontak</label>
            <input v-model="form.contact_name" type="text" placeholder="Nama PIC" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Nomor Telepon</label>
            <input v-model="form.phone" type="text" placeholder="08xxxxxxxxxx" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Alamat</label>
            <textarea v-model="form.address" rows="2" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"></textarea>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Catatan</label>
            <textarea v-model="form.notes" rows="2" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"></textarea>
          </div>
          <div v-if="modalError" class="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{{ modalError }}</div>
        </div>
        <div class="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
          <button class="px-4 py-2 text-sm text-gray-500 font-medium" @click="showModal = false">Batal</button>
          <button :disabled="modalLoading" class="px-5 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50" style="background-color:#16a34a" @click="submitOfftaker">
            {{ modalLoading ? 'Menyimpan...' : 'Simpan Offtaker' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Edit -->
    <div v-if="showEditModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background:rgba(0,0,0,0.4)">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 class="text-lg font-bold text-gray-800">Edit Offtaker</h3>
          <button class="text-gray-400 hover:text-gray-600" @click="showEditModal = false">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div class="px-6 py-4 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Nama Perusahaan</label>
            <input v-model="editForm.company_name" type="text" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Nama Kontak</label>
            <input v-model="editForm.contact_name" type="text" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Telepon</label>
            <input v-model="editForm.phone" type="text" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Alamat</label>
            <textarea v-model="editForm.address" rows="2" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"></textarea>
          </div>
          <div class="flex items-center gap-3">
            <button
              class="relative w-11 h-6 rounded-full transition-colors"
              :style="editForm.is_active ? 'background-color:#16a34a' : 'background-color:#e5e7eb'"
              @click="editForm.is_active = !editForm.is_active"
            >
              <span class="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform" :style="editForm.is_active ? 'transform:translateX(20px)' : 'transform:translateX(2px)'" />
            </button>
            <span class="text-sm font-medium" style="color:#374151">{{ editForm.is_active ? 'Aktif' : 'Nonaktif' }}</span>
          </div>
        </div>
        <div class="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
          <button class="px-4 py-2 text-sm text-gray-500 font-medium" @click="showEditModal = false">Batal</button>
          <button :disabled="modalLoading" class="px-5 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50" style="background-color:#d97706" @click="submitEdit">
            {{ modalLoading ? 'Menyimpan...' : 'Simpan Perubahan' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Hapus -->
    <div v-if="showDeleteModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background:rgba(0,0,0,0.4)">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div class="px-6 py-5 text-center">
          <div class="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </div>
          <h3 class="text-lg font-bold text-gray-800 mb-1">Hapus Offtaker?</h3>
          <p class="text-sm text-gray-500"><strong>{{ deleteTarget?.company_name }}</strong> akan dihapus permanen.</p>
        </div>
        <div class="px-6 pb-5 flex gap-3">
          <button class="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl" @click="showDeleteModal = false">Batal</button>
          <button class="flex-1 py-2.5 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl" @click="confirmDelete">Hapus</button>
        </div>
      </div>
    </div>

  </div>
</template>