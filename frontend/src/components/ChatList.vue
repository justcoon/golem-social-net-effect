<script setup lang="ts">
import { useChatStore } from '../stores/chat';
import { useUserStore } from '../stores/user';
import { storeToRefs } from 'pinia';
import { computed, ref } from 'vue';
import ConnectionSelect from './ConnectionSelect.vue';
const chatStore = useChatStore();
const userStore = useUserStore();
const { chats, activeChatId, isLoading } = storeToRefs(chatStore);
const { user } = storeToRefs(userStore);

const isCreatingChat = ref(false);
const selectedParticipants = ref<string[]>([]);
const createChatError = ref<string | null>(null);

const sortedChats = computed(() => {
  return [...chats.value].sort((a, b) => {
    const timeA = new Date(a.updatedAt.timestamp).getTime();
    const timeB = new Date(b.updatedAt.timestamp).getTime();
    return timeB - timeA;
  });
});

function selectChat(id: string) {
  activeChatId.value = id;
}

async function handleCreateChat() {
    if (selectedParticipants.value.length === 0) return;
    createChatError.value = null;
    try {
        await chatStore.createNewChat(selectedParticipants.value);
        selectedParticipants.value = [];
        isCreatingChat.value = false;
    } catch (e: any) {
        createChatError.value = e.response?.data?.error || e.message || 'Failed to create chat';
    }
}

function getChatName(chat: any) {
  return chat.participants.join(', ');
}

function getFormattedDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
</script>

<template>
  <div class="h-full flex flex-col bg-neutral-900 border-r border-neutral-800 w-80">
    <div class="p-4 border-b border-neutral-800 flex justify-between items-center">
      <h2 class="text-xl font-bold text-gray-200">Messages</h2>
      <button 
        @click="isCreatingChat = !isCreatingChat"
        class="p-2 rounded-full hover:bg-neutral-800 text-purple-400 transition"
        title="New Chat"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>
    </div>

    <!-- New Chat Form -->
    <div v-if="isCreatingChat" class="p-4 border-b border-neutral-800 bg-neutral-800/30">
        <div class="flex flex-col space-y-3">
            <ConnectionSelect 
                v-model="selectedParticipants"
                :connections="user?.connectedUsers || []"
                placeholder="Add participants..."
            />
            <div class="flex space-x-2">
                <button 
                    @click="handleCreateChat"
                    :disabled="selectedParticipants.length === 0 || isLoading"
                    class="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium py-2 rounded disabled:opacity-50 transition"
                >
                    Create
                </button>
                <button 
                    @click="isCreatingChat = false"
                    class="px-4 py-2 text-xs font-medium text-gray-400 hover:text-white transition"
                >
                    Cancel
                </button>
            </div>
            <p v-if="createChatError" class="text-[10px] text-red-500 mt-1">{{ createChatError }}</p>
        </div>
    </div>
    
    <div class="flex-1 overflow-y-auto custom-scrollbar">
      <div v-if="isLoading && chats.length === 0" class="p-8 text-center text-gray-500">
        <div class="animate-spin w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-2"></div>
        Loading chats...
      </div>
      
      <div v-else-if="chats.length === 0" class="p-8 text-center text-gray-500 italic">
        No chats yet.
      </div>
      
      <div 
        v-for="chat in sortedChats" 
        :key="chat.chatId"
        @click="selectChat(chat.chatId)"
        class="p-4 border-b border-neutral-800/10 hover:bg-neutral-800 cursor-pointer transition flex justify-between items-start"
        :class="{ 'bg-neutral-800 border-l-4 border-l-purple-600': activeChatId === chat.chatId }"
      >
        <div class="flex-1 min-w-0">
          <div class="text-sm font-semibold text-gray-200 truncate">
            {{ getChatName(chat) }}
          </div>
          <div v-if="chat.messages && chat.messages.length > 0" class="text-xs text-gray-500 truncate mt-1">
            {{ chat.messages?.[chat.messages.length - 1]?.content }}
          </div>
        </div>
        <div class="text-[10px] text-gray-600 ml-2 whitespace-nowrap pt-1">
          {{ getFormattedDate(chat.updatedAt.timestamp) }}
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
