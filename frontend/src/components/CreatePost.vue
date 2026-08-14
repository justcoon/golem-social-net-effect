<script setup lang="ts">
import { ref } from 'vue';
import { api } from '../api';
import { useUserStore } from '../stores/user';

const emit = defineEmits(['post-created']);

const content = ref('');
const isSubmitting = ref(false);
const userStore = useUserStore();

async function submitPost() {
  if (!content.value.trim() || !userStore.userId) return;

  isSubmitting.value = true;
  try {
    await api.createPost(userStore.userId, content.value);
    content.value = '';
    emit('post-created');
  } catch (err) {
    console.error('Failed to create post:', err);
    alert('Failed to post. Please try again.');
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div class="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-lg mb-8">
    <h2 class="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 mb-4">
      Share your thoughts
    </h2>
    <form @submit.prevent="submitPost">
      <textarea
        v-model="content"
        rows="3"
        placeholder="What's going on?"
        class="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-4 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition resize-none placeholder-gray-600"
      ></textarea>
      
      <div class="flex justify-end mt-3">
        <button
          type="submit"
          :disabled="isSubmitting || !content.trim()"
          class="px-6 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold shadow-lg shadow-purple-900/20 transform transition hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        >
          {{ isSubmitting ? 'Posting...' : 'Post' }}
        </button>
      </div>
    </form>
  </div>
</template>
