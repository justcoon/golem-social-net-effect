<script setup lang="ts">
import { ref, nextTick, watch } from 'vue';
import ConnectionSelect from './ConnectionSelect.vue';
import { useChatStore } from '../stores/chat';
import { useUserStore } from '../stores/user';
import { storeToRefs } from 'pinia';
import ChatMessage from './ChatMessage.vue';
import { type LikeType } from '../api';

const chatStore = useChatStore();
const userStore = useUserStore();
const { activeChat } = storeToRefs(chatStore);
const { userId } = storeToRefs(userStore);

const newMessage = ref('');
const messagesContainer = ref<HTMLElement | null>(null);
const isAddingParticipant = ref(false);
const selectedToAdd = ref<string[]>([]);
const addParticipantError = ref<string | null>(null);

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
}

// Scroll to bottom when new messages arrive or when chat is selected
watch(() => activeChat.value?.messages.length, scrollToBottom);
watch(() => activeChat.value?.chatId, scrollToBottom);

async function handleSendMessage() {
  if (!newMessage.value.trim()) return;
  const content = newMessage.value;
  newMessage.value = '';
  await chatStore.sendMessage(content);
}

function handleLike(messageId: string, type: LikeType) {
  chatStore.toggleLike(messageId, type);
}

function handleUnlike(messageId: string) {
  // Pass current like type if we want to toggle it off, or just use a default handled in store
  chatStore.toggleLike(messageId); 
}

function handleDeleteMessage(messageId: string) {
  chatStore.deleteMessage(messageId);
}

async function handleAddParticipant() {
    if (selectedToAdd.value.length === 0 || !activeChat.value) return;
    addParticipantError.value = null;
    try {
        await chatStore.addParticipant(activeChat.value.chatId, selectedToAdd.value);
        selectedToAdd.value = [];
        isAddingParticipant.value = false;
    } catch (e: any) {
        addParticipantError.value = e.response?.data?.error || e.message || 'Failed to add participant';
    }
}
</script>

<template>
  <div class="flex-1 flex flex-col h-full bg-neutral-900">
    <template v-if="activeChat">
      <!-- Header -->
      <div class="p-4 border-b border-neutral-800 flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <div class="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
            {{ activeChat.participants?.[0]?.charAt(0).toUpperCase() }}
          </div>
          <div>
            <div class="text-sm font-semibold text-gray-200">
              {{ activeChat.participants.join(', ') }}
            </div>
            <div class="text-[10px] text-gray-500">
              {{ activeChat.participants?.length }} participants
            </div>
          </div>
        </div>

        <div class="flex items-center space-x-2">
            <div v-if="isAddingParticipant" class="flex items-center space-x-2">
                <div class="relative w-48">
                    <ConnectionSelect 
                        v-model="selectedToAdd"
                        :connections="userStore.user?.connectedUsers || []"
                        :exclude-ids="activeChat.participants"
                        placeholder="Select users..."
                    />
                    <p v-if="addParticipantError" class="absolute -bottom-4 right-0 text-[8px] text-red-500 whitespace-nowrap">{{ addParticipantError }}</p>
                </div>
                <button 
                    @click="handleAddParticipant"
                    :disabled="selectedToAdd.length === 0 || chatStore.isLoading"
                    class="bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-medium px-2 py-1.5 rounded disabled:opacity-50 transition"
                >
                    Add
                </button>
                <button 
                    @click="isAddingParticipant = false; addParticipantError = null"
                    class="text-[10px] text-gray-400 hover:text-white transition"
                >
                    Cancel
                </button>
            </div>
            <button 
                v-else
                @click="isAddingParticipant = true"
                class="p-2 rounded-full hover:bg-neutral-800 text-purple-400 transition"
                title="Add Participant"
            >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
            </button>
        </div>
      </div>

      <!-- Messages -->
      <div 
        ref="messagesContainer"
        class="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar"
      >
        <div v-if="activeChat && activeChat.messages && activeChat.messages.length === 0" class="h-full flex items-center justify-center text-gray-600 italic text-sm">
          No messages yet. Say hello!
        </div>
        
        <ChatMessage 
          v-for="msg in activeChat.messages" 
          :key="msg.messageId"
          :message="msg"
          :current-user-id="userId"
          @like="(type) => handleLike(msg.messageId, type)"
          @unlike="() => handleUnlike(msg.messageId)"
          @delete="() => handleDeleteMessage(msg.messageId)"
        />
      </div>

      <!-- Input Area -->
      <div class="p-4 border-t border-neutral-800">
        <form @submit.prevent="handleSendMessage" class="flex items-end space-x-2">
          <textarea 
            v-model="newMessage"
            rows="1"
            placeholder="Type a message..."
            class="flex-1 bg-neutral-800 border-none rounded-xl px-4 py-2 text-sm text-gray-200 focus:ring-1 focus:ring-purple-500 placeholder-gray-600 resize-none max-h-32"
            @keydown.enter.prevent="handleSendMessage"
          ></textarea>
          <button 
            type="submit"
            :disabled="!newMessage.trim()"
            class="bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg shadow-purple-900/20"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 rotate-90" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </form>
      </div>
    </template>
    
    <div v-else class="flex-1 flex flex-col items-center justify-center text-gray-600 p-8 text-center">
      <div class="w-16 h-16 bg-neutral-800 rounded-full flex items-center justify-center mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-neutral-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </div>
      <h3 class="text-lg font-medium text-gray-500">Your Messages</h3>
      <p class="text-sm mt-1 max-w-xs">Select a conversation from the list to start chatting.</p>
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
