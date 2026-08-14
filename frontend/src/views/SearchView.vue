<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { api, type User } from '../api';
// I didn't install lodash. I'll use custom debounce.
import { useRouter } from 'vue-router';

type SearchMode = 'userid' | 'email' | 'name' | 'connectedusers' | 'fulltext';

const query = ref('');
const results = ref<User[]>([]);
const isSearching = ref(false);
const showHelp = ref(false);
const showOptions = ref(false);
const selectedOptionIndex = ref(-1);
const searchInputRef = ref<HTMLInputElement | null>(null);
const router = useRouter();

const searchModeOptions = [
  { value: 'userid', label: 'User ID', icon: '👤', example: 'john_doe' },
  { value: 'email', label: 'Email', icon: '📧', example: 'john@example.com' },
  { value: 'name', label: 'Name', icon: '📝', example: 'John' },
  { value: 'connectedusers', label: 'Connected Users', icon: '🔗', example: 'jane_doe' },
  { value: 'fulltext', label: 'Full Text Search', icon: '🔍', example: 'john' }
];

const placeholder = computed(() => {
  if (query.value) return '';
  return 'Search users... (click for options)';
});

const activeModes = computed(() => {
  const modes: SearchMode[] = [];
  const parts = query.value.trim().split(/\s+/);
  
  parts.forEach(part => {
    if (part.includes(':')) {
      const [mode] = part.split(':');
      if (searchModeOptions.some(opt => opt.value === mode.toLowerCase())) {
        modes.push(mode.toLowerCase() as SearchMode);
      }
    } else if (part.trim()) {
      modes.push('fulltext');
    }
  });
  
  return [...new Set(modes)]; // Remove duplicates
});

const performSearch = async () => {
  const searchQuery = query.value.trim();
  if (!searchQuery) {
    results.value = [];
    return;
  }
  
  isSearching.value = true;
  showOptions.value = false;
  try {
    const response = await api.searchUsers(searchQuery);
    const data = response.data as any; // Cast to any to access dynamic structure
    if (data && Array.isArray(data)) {
        results.value = data;
    } else {
        results.value = [];
    }
  } catch (err) {
    console.error(err);
    results.value = [];
  } finally {
    isSearching.value = false;
  }
};

function goToProfile(userId: string) {
    router.push(`/profile/${userId}`);
}

const addSearchOption = (mode: SearchMode, example: string) => {
  const prefix = mode === 'fulltext' ? '' : `${mode}:`;
  const newPart = prefix; // Only add the prefix, not the example
  
  if (query.value.trim()) {
    query.value = `${query.value.trim()} ${newPart}`;
  } else {
    query.value = newPart;
  }
  
  // Focus back to input and move cursor to end
  nextTick(() => {
    if (searchInputRef.value) {
      searchInputRef.value.focus();
      searchInputRef.value.setSelectionRange(query.value.length, query.value.length);
    }
  });
  
  showOptions.value = false;
};

const getModeOption = (mode: SearchMode) => {
  return searchModeOptions.find(option => option.value === mode) || searchModeOptions[0];
};

const focusInput = () => {
  showOptions.value = true;
  selectedOptionIndex.value = -1;
};

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    if (!showOptions.value) {
      // Open menu when closed (regardless of query content)
      showOptions.value = true;
      selectedOptionIndex.value = 0;
    } else if (showOptions.value) {
      // Move down in menu
      if (selectedOptionIndex.value < searchModeOptions.length - 1) {
        selectedOptionIndex.value++;
      }
    }
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    if (showOptions.value) {
      if (selectedOptionIndex.value > 0) {
        // Move up in menu
        selectedOptionIndex.value--;
      } else {
        // Move back to input and close menu
        showOptions.value = false;
        selectedOptionIndex.value = -1;
        nextTick(() => {
          searchInputRef.value?.focus();
        });
      }
    }
  } else if (event.key === 'Enter') {
    event.preventDefault();
    if (showOptions.value && selectedOptionIndex.value >= 0) {
      // Add selected option from menu
      const selectedOption = searchModeOptions[selectedOptionIndex.value];
      addSearchOption(selectedOption.value, selectedOption.example);
    } else {
      // Perform search
      performSearch();
    }
  } else if (event.key === 'Escape') {
    // Close menu and stay in input
    showOptions.value = false;
    selectedOptionIndex.value = -1;
  } else if (event.key.length === 1 && showOptions.value) {
    // Any other typing closes the menu
    showOptions.value = false;
    selectedOptionIndex.value = -1;
  }
};

const selectOption = (index: number) => {
  selectedOptionIndex.value = index;
  const selectedOption = searchModeOptions[index];
  addSearchOption(selectedOption.value, selectedOption.example);
};

// Close options when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  if (!target.closest('.search-container')) {
    showOptions.value = false;
    selectedOptionIndex.value = -1;
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <div class="mb-8">
       <h1 class="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600 mb-2">
         Search
       </h1>
       <p class="text-gray-400">Find people to follow</p>
    </div>

    <!-- Smart Search Input -->
    <div class="mb-4">
      <div class="relative search-container">
        <!-- Search Input -->
        <div class="relative flex gap-2">
          <div class="relative flex-1">
            <input 
              ref="searchInputRef"
              v-model="query"
              type="text"
              :placeholder="placeholder"
              class="w-full px-5 py-3 rounded-xl bg-neutral-900 border border-neutral-800 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition shadow-lg placeholder-gray-600"
              :class="{ 'pl-16': activeModes.length > 2, 'pl-12': activeModes.length === 2, 'pl-10': activeModes.length === 1 }"
              @focus="focusInput"
              @keydown="handleKeyDown"
            />
            
            <!-- Active Mode Indicators -->
            <div v-if="activeModes.length > 0" class="absolute left-3 top-1/2 transform -translate-y-1/2 flex gap-1 pointer-events-none">
              <span 
                v-for="mode in activeModes" 
                :key="mode"
                class="text-xs opacity-60"
              >
                {{ getModeOption(mode)?.icon }}
              </span>
            </div>
          </div>
          
          <!-- Search Button -->
          <button 
            @click="performSearch"
            class="px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="isSearching || !query.trim()"
          >
            <span v-if="isSearching" class="flex items-center">
              <div class="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
              Searching...
            </span>
            <span v-else>Search</span>
          </button>
        </div>
        
        <!-- Search Options Dropdown -->
        <div
          v-if="showOptions"
          class="absolute top-full left-0 right-0 mt-2 bg-neutral-900 border border-neutral-800 rounded-xl shadow-xl z-10 overflow-hidden"
        >
          <div class="p-4">
            <h3 class="text-white font-semibold mb-3 text-sm">
              {{ query.trim() ? 'Add search type:' : 'Choose search type:' }}
            </h3>
            <div class="space-y-2">
              <button
                v-for="(option, index) in searchModeOptions"
                :key="option.value"
                @click="selectOption(index)"
                @mouseenter="selectedOptionIndex = index"
                class="w-full px-4 py-3 text-left hover:bg-neutral-800 transition rounded-lg flex items-center gap-3 group"
                :class="{ 
                  'bg-purple-600/20 border border-purple-600/50': selectedOptionIndex === index,
                  'hover:bg-neutral-800': selectedOptionIndex !== index
                }"
              >
                <span class="text-lg">{{ option.icon }}</span>
                <div class="flex-1">
                  <div class="text-sm font-medium text-white group-hover:text-purple-300">
                    {{ option.label }}
                  </div>
                  <div class="text-xs text-gray-400">
                    {{ option.value === 'fulltext' ? option.example : `${option.value}:${option.example}` }}
                  </div>
                </div>
                <div class="text-xs text-purple-400 opacity-0 group-hover:opacity-100 transition">
                  {{ selectedOptionIndex === index ? 'Selected' : 'Click to add' }}
                </div>
              </button>
            </div>
            
            <div class="border-t border-neutral-800 mt-3 pt-3">
              <p class="text-xs text-gray-400">
                💡 Use arrow keys to navigate, Enter to select, Escape to close
              </p>
              <p v-if="query.trim()" class="text-xs text-gray-400 mt-1">
                Current query: <code class="bg-neutral-800 px-1 rounded text-purple-300">{{ query.trim() }}</code>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Search Help -->
    <div class="mb-6">
      <button
        @click="showHelp = !showHelp"
        class="text-purple-400 hover:text-purple-300 text-xs font-medium transition"
      >
        {{ showHelp ? 'Hide' : 'Show' }} search help
      </button>
      
      <div v-if="showHelp" class="mt-2 p-3 bg-neutral-900 border border-neutral-800 rounded-lg text-xs">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
          <div class="flex items-start gap-2">
            <span class="text-purple-400 text-xs">👤</span>
            <div>
              <code class="text-purple-300">userid:john</code>
              <p class="text-gray-500">Exact user ID</p>
            </div>
          </div>
          <div class="flex items-start gap-2">
            <span class="text-purple-400 text-xs">📧</span>
            <div>
              <code class="text-purple-300">email:john@ex.com</code>
              <p class="text-gray-500">Exact email</p>
            </div>
          </div>
          <div class="flex items-start gap-2">
            <span class="text-purple-400 text-xs">📝</span>
            <div>
              <code class="text-purple-300">name:John</code>
              <p class="text-gray-500">Name contains</p>
            </div>
          </div>
          <div class="flex items-start gap-2">
            <span class="text-purple-400 text-xs">🔗</span>
            <div>
              <code class="text-purple-300">connectedusers:jane</code>
              <p class="text-gray-500">Connected to user</p>
            </div>
          </div>
        </div>
        
        <div class="border-t border-neutral-800 pt-2">
          <p class="text-gray-400">
            <strong>💡 Multi-criteria:</strong> <code class="text-purple-300">userid:john email:john@ex.com</code>
          </p>
        </div>
      </div>
    </div>

    <div v-if="isSearching" class="flex justify-center py-8">
       <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
    </div>

    <div v-else-if="results.length > 0" class="space-y-4">
      <div 
        v-for="user in results" 
        :key="user.userId"
        @click="goToProfile(user.userId)"
        class="flex items-center p-4 bg-neutral-900 border border-neutral-800 rounded-xl hover:bg-neutral-800 transition cursor-pointer group"
      >
        <div class="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center text-xl font-bold text-gray-300 mr-4 border-2 border-neutral-700 group-hover:border-purple-500 transition">
          {{ user.userId.charAt(0).toUpperCase() }}
        </div>
        <div>
           <h3 class="font-bold text-white group-hover:text-purple-400 transition">{{ user.name || user.userId }}</h3>
           <p class="text-sm text-gray-500">@{{ user.userId }}</p>
        </div>
      </div>
    </div>

    <div v-else-if="query && !isSearching" class="text-center py-8 text-gray-500">
       No users found.
    </div>
  </div>
</template>
