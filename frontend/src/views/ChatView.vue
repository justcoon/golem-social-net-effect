<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useChatStore } from '../stores/chat';
import ChatList from '../components/ChatList.vue';
import ChatWindow from '../components/ChatWindow.vue';

const chatStore = useChatStore();

onMounted(() => {
  chatStore.fetchChats();
  chatStore.startPolling();
});

onUnmounted(() => {
  chatStore.stopPolling();
});
</script>

<template>
  <div class="h-[calc(100vh-128px)] flex overflow-hidden bg-black text-gray-100 rounded-2xl border border-neutral-800 shadow-2xl">
    <!-- Sidebar / Chat List -->
    <ChatList />
    
    <!-- Main Chat Window -->
    <ChatWindow />
  </div>
</template>

<style scoped>
/* 
  Calculated height:
  100vh - 64px (navbar) - 64px (py-8 on App.vue main) = 128px total offset
*/
.h-\[calc\(100vh-128px\)\] {
  height: calc(100vh - 128px);
}
</style>
