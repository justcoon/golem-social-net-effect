<script setup lang="ts">
import { computed } from 'vue';
import { type LikeType, type UserLikeTuple } from '../api';

const props = defineProps<{
  likes?: UserLikeTuple[];
  currentUserId: string | null;
}>();

const emit = defineEmits<{
  (e: 'like', type: LikeType): void;
  (e: 'unlike'): void;
}>();

const reactionIcons: Record<LikeType, string> = {
  Like: '👍',
  Insightful: '💡',
  Love: '❤️',
  Dislike: '👎'
};

const reactionLabels: Record<LikeType, string> = {
  Like: 'Like',
  Insightful: 'Insightful',
  Love: 'Love',
  Dislike: 'Dislike'
};

const aggregateLikes = computed(() => {
  const counts: Record<LikeType, number> = {
    Like: 0,
    Insightful: 0,
    Love: 0,
    Dislike: 0
  };
  
  if (props.likes) {
    props.likes.forEach(([_, type]) => {
      if (counts[type] !== undefined) {
        counts[type]++;
      }
    });
  }
  
  return counts;
});

const totalCount = computed(() => {
  return Object.values(aggregateLikes.value).reduce((a, b) => a + b, 0);
});

const myReaction = computed(() => {
  if (!props.likes || !props.currentUserId) return null;
  const found = props.likes.find(([uid]) => uid === props.currentUserId);
  return found ? (found[1] as LikeType) : null;
});

function toggleReaction(type: LikeType) {
  if (myReaction.value === type) {
    emit('unlike');
  } else {
    emit('like', type);
  }
}
</script>

<template>
  <div class="flex flex-col space-y-2">
    <div class="flex items-center space-x-4">
      <!-- Summary of reactions -->
      <div v-if="totalCount > 0" class="flex items-center -space-x-1">
        <template v-for="(count, type) in aggregateLikes" :key="type">
          <span v-if="count > 0" 
                class="flex items-center justify-center w-5 h-5 rounded-full bg-neutral-800 border border-neutral-700 text-[10px]"
                :title="reactionLabels[type as LikeType]">
            {{ reactionIcons[type as LikeType] }}
          </span>
        </template>
        <span class="ml-2 text-xs text-gray-400">{{ totalCount }}</span>
      </div>

      <!-- Action buttons -->
      <div class="flex items-center space-x-1">
        <div class="group relative">
          <!-- Translucent bridge to maintain hover -->
          <div class="absolute bottom-full left-0 w-full h-2 hidden group-hover:block"></div>
          
          <button 
            class="px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center space-x-1"
            :class="myReaction ? 'bg-purple-900/30 text-purple-400 border border-purple-500/30' : 'text-gray-400 hover:bg-neutral-800'"
            @click="toggleReaction(myReaction || 'Like')"
          >
            <span v-if="myReaction">{{ reactionIcons[myReaction] }}</span>
            <span v-else>👍</span>
            <span>{{ myReaction ? reactionLabels[myReaction] : 'Like' }}</span>
          </button>

          <!-- Reaction Picker Popover on Hover -->
          <div class="absolute bottom-[calc(100%+0.5rem)] left-0 hidden group-hover:flex bg-neutral-800 border border-neutral-700 rounded-full shadow-xl p-1 items-center space-x-1 z-10 transition-all">
            <button 
              v-for="(icon, type) in reactionIcons" 
              :key="type"
              class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-700 transition-transform hover:scale-125 focus:outline-none"
              :title="reactionLabels[type]"
              @click="toggleReaction(type)"
            >
              {{ icon }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Ensure popover stays open when hovering from button to popover */
.group:hover .group-hover\:flex {
  display: flex;
}

/* Explicitly bridge the gap with a pseudo-element if needed, 
   but the spacer div above should handle it. */
</style>
