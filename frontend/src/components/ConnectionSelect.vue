<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';

interface Props {
  connections: [string, any][];
  modelValue: string[];
  placeholder?: string;
  excludeIds?: string[];
}

const props = defineProps<Props>();
const emit = defineEmits(['update:modelValue']);

const isOpen = ref(false);
const searchQuery = ref('');
const selectContainer = ref<HTMLElement | null>(null);

const filteredConnections = computed(() => {
  const query = searchQuery.value.toLowerCase();
  return props.connections.filter(([id]) => {
    const isExcluded = props.excludeIds?.includes(id);
    const matchesSearch = id.toLowerCase().includes(query);
    return !isExcluded && matchesSearch;
  });
});

const selectedIds = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

function toggleSelection(id: string) {
  const index = selectedIds.value.indexOf(id);
  if (index === -1) {
    selectedIds.value = [...selectedIds.value, id];
  } else {
    selectedIds.value = selectedIds.value.filter(sid => sid !== id);
  }
}

function removeTag(id: string) {
  selectedIds.value = selectedIds.value.filter(sid => sid !== id);
}

function handleClickOutside(event: MouseEvent) {
  if (selectContainer.value && !selectContainer.value.contains(event.target as Node)) {
    isOpen.value = false;
  }
}

onMounted(() => {
  window.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  window.removeEventListener('click', handleClickOutside);
});
</script>

<template>
  <div ref="selectContainer" class="relative w-full">
    <!-- Select Trigger / Current Selections -->
    <div 
      @click="isOpen = !isOpen"
      class="min-h-[38px] w-full bg-neutral-800 border border-neutral-700 rounded-lg px-2 py-1 flex flex-wrap gap-1 items-center cursor-pointer hover:border-neutral-600 transition"
      :class="{ 'ring-1 ring-purple-500 border-purple-500': isOpen }"
    >
      <div v-for="id in selectedIds" :key="id" class="bg-purple-600/20 text-purple-400 text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 border border-purple-500/30">
        {{ id }}
        <button @click.stop="removeTag(id)" class="hover:text-purple-300">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>
      <input 
        v-if="isOpen || selectedIds.length === 0"
        v-model="searchQuery"
        type="text"
        :placeholder="selectedIds.length === 0 ? props.placeholder || 'Select connections...' : ''"
        class="flex-1 bg-transparent border-none outline-none text-sm text-gray-200 min-w-[60px] p-0 focus:ring-0"
        @click.stop="isOpen = true"
      />
      <div v-else class="text-sm text-gray-400 ml-1">
        {{ selectedIds.length }} selected
      </div>
      
      <div class="ml-auto text-gray-500">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform" :class="{ 'rotate-180': isOpen }" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>

    <!-- Dropdown -->
    <div 
      v-if="isOpen"
      class="absolute z-50 w-full mt-1 bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl max-h-60 overflow-y-auto custom-scrollbar"
    >
      <div v-if="filteredConnections.length === 0" class="p-3 text-center text-gray-500 text-xs italic">
        No connections found
      </div>
      <div 
        v-for="[id, data] in filteredConnections" 
        :key="id"
        @click="toggleSelection(id)"
        class="p-2 hover:bg-neutral-800 cursor-pointer flex items-center justify-between transition group"
        :class="{ 'bg-purple-600/10': selectedIds.includes(id) }"
      >
        <div class="flex items-center space-x-3">
          <div class="w-6 h-6 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-[10px] font-bold text-gray-400">
            {{ id.charAt(0).toUpperCase() }}
          </div>
          <div>
            <div class="text-sm text-gray-200">{{ id }}</div>
            <div class="text-[10px] text-gray-500 capitalize">{{ data.connectionTypes.join(', ') }}</div>
          </div>
        </div>
        <div v-if="selectedIds.includes(id)" class="text-purple-500">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
          </svg>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #333;
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #444;
}
</style>
