<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted } from 'vue';
import { api, type Post } from '../api';
import { useUserStore } from '../stores/user';
import CreatePost from '../components/CreatePost.vue';
import PostCard from '../components/PostCard.vue';

const posts = ref<Post[]>([]);
const isLoading = ref(true);
const userStore = useUserStore();
let isPolling = false;

async function fetchTimeline(silent = false) {
  if (!userStore.userId) return;
  
  if (!silent) isLoading.value = true;
  try {
    const response = await api.getTimeline(userStore.userId);
    const data = response.data as any;
    if (data && Array.isArray(data)) {
        posts.value = data;
    } else {
        posts.value = [];
    }
  } catch (err) {
    console.error('Failed to fetch timeline:', err);
    if (!silent) posts.value = [];
  } finally {
    if (!silent) isLoading.value = false;
  }
}

async function startPolling() {
    if (isPolling || !userStore.liveTimeline || !userStore.userId) return;
    isPolling = true;

    try {
        while (userStore.liveTimeline && userStore.userId) {
            // Get the timestamp of the newest post
            let since = new Date(0).toISOString();
            if (posts.value.length > 0) {
                const newestPost = posts.value[0];
                if (newestPost) {
                    const createdAt = newestPost.createdAt;
                    since = createdAt.timestamp;
                }
            }

            try {
                const response = await api.getTimelineUpdates(userStore.userId, since);
                const data = response.data as any;
                
                // If data contains posts, it means there are updates
                if (data && Array.isArray(data) && data.length > 0) {
                    console.log('New posts detected, refreshing timeline...');
                    await fetchTimeline(true);
                }
            } catch (err) {
                console.error('Polling error:', err);
                // Wait a bit before retrying on error to avoid tight loops
                await new Promise(resolve => setTimeout(resolve, 5000));
            }

            // Small delay to prevent accidental rapid loops if backend returns immediately
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    } finally {
        isPolling = false;
    }
}

watch(() => userStore.liveTimeline, (enabled) => {
    if (enabled) {
        startPolling();
    }
});

onMounted(() => {
  fetchTimeline();
  if (userStore.liveTimeline) {
    startPolling();
  }
});

onUnmounted(() => {
    // Polling will stop because the while loop checks userStore.liveTimeline, 
    // and components unmounting usually means we stop caring, 
    // but the recursive nature or loop will naturally exit if we were to null out state.
});
</script>

<template>
  <div class="max-w-2xl mx-auto pb-12">
    <div class="flex items-start justify-between mb-8">
      <div>
        <h1 class="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600 mb-2">
          Timeline
        </h1>
        <p class="text-gray-400">See what's happening in your network</p>
      </div>
      
      <button 
        @click="userStore.liveTimeline = !userStore.liveTimeline"
        class="flex items-center space-x-2 px-4 py-2 rounded-full border transition-all duration-300 select-none"
        :class="userStore.liveTimeline 
          ? 'bg-purple-900/40 border-purple-500 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.2)]' 
          : 'bg-neutral-900 border-neutral-700 text-gray-500 hover:border-neutral-500 hover:text-gray-300'"
      >
        <span class="relative flex h-3 w-3">
          <span v-if="userStore.liveTimeline" class="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-3 w-3" :class="userStore.liveTimeline ? 'bg-purple-500' : 'bg-gray-600'"></span>
        </span>
        <span class="text-sm font-medium">{{ userStore.liveTimeline ? 'Live Updates On' : 'Live Updates Off' }}</span>
      </button>
    </div>

    <CreatePost @post-created="fetchTimeline" />

    <div v-if="isLoading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
    </div>

    <div v-else-if="posts.length === 0" class="text-center py-12 bg-neutral-900 rounded-xl border border-neutral-800">
      <p class="text-gray-400">No posts yet. Start following someone or create a post!</p>
    </div>

    <div v-else class="space-y-6">
      <PostCard 
        v-for="post in posts" 
        :key="post.postId" 
        :post="post" 
      />
    </div>
  </div>
</template>
