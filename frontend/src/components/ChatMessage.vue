<script setup lang="ts">
import { computed } from 'vue';
import { type Message, type LikeType, type UserLikeTuple } from '../api';
import LikeReactions from './LikeReactions.vue';

const props = defineProps<{
  message: Message;
  currentUserId: string | null;
}>();

const emit = defineEmits<{
  (e: 'like', type: LikeType): void;
  (e: 'unlike'): void;
  (e: 'delete'): void;
}>();

function handleDelete() {
  if (confirm('Are you sure you want to delete this message?')) {
    emit('delete');
  }
}

const isOwnMessage = computed(() => props.message.createdBy === props.currentUserId);

const formattedDate = computed(() => {
  return new Date(props.message.createdAt.timestamp).toLocaleString(undefined, {
    timeStyle: 'short',
  });
});

const likesTuple = computed<UserLikeTuple[]>(() => {
  return props.message.likes;
});
</script>

<template>
  <div class="flex flex-col mb-4" :class="isOwnMessage ? 'items-end' : 'items-start'">
    <div class="flex items-center space-x-2 mb-1">
      <span class="text-xs font-bold text-gray-500">{{ message.createdBy }}</span>
      <span class="text-[10px] text-gray-600">{{ formattedDate }}</span>
    </div>
    
    <div 
      class="max-w-[80%] rounded-2xl p-3 shadow-sm relative group"
      :class="isOwnMessage ? 'bg-purple-600 text-white rounded-tr-none' : 'bg-neutral-800 text-gray-200 rounded-tl-none'"
    >
      <div class="text-sm whitespace-pre-wrap leading-relaxed pr-6">
        {{ message.content }}
      </div>
      
      <button 
        v-if="isOwnMessage" 
        @click="handleDelete"
        class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-white/50 hover:text-white"
        title="Delete message"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clip-rule="evenodd" />
        </svg>
      </button>
      
      <!-- Reactions overlay/footer -->
      <div class="mt-2" v-if="likesTuple.length > 0 || !isOwnMessage">
        <LikeReactions 
          :likes="likesTuple" 
          :current-user-id="currentUserId"
          @like="(type) => emit('like', type)"
          @unlike="() => emit('unlike')"
        />
      </div>
    </div>
  </div>
</template>
