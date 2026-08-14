<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '../stores/user';

const userId = ref('');
const error = ref('');
const router = useRouter();
const userStore = useUserStore();

function handleLogin() {
  if (!userId.value.trim()) {
    error.value = 'Please enter a User ID';
    return;
  }

  // In a real app, we would verify against backend here.
  // For this simple task, we trust the input and just set it.
  userStore.login(userId.value.trim());
  router.push('/');
}
</script>

<template>
  <div class="flex flex-col items-center justify-center min-h-[80vh]">
    <div class="w-full max-w-md p-8 rounded-2xl bg-neutral-900 border border-neutral-800 shadow-2xl animate-fade-in-up">
      <div class="text-center mb-8">
        <h1 class="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-blue-400 to-purple-600 mb-2">
          Welcome Back
        </h1>
        <p class="text-gray-400">Enter your User ID to access the network</p>
      </div>

      <form @submit.prevent="handleLogin" class="space-y-6">
        <div>
          <label for="userId" class="block text-sm font-medium text-gray-300 mb-1">User ID</label>
          <input
              id="userId"
              v-model="userId"
              type="text"
              placeholder="e.g. user1"
              class="w-full px-4 py-3 rounded-xl bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all placeholder-gray-600"
              autofocus
          />
        </div>

        <div v-if="error" class="text-red-400 text-sm bg-red-900/20 p-3 rounded-lg border border-red-900/50">
          {{ error }}
        </div>

        <button
            type="submit"
            class="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold shadow-lg shadow-purple-900/20 transform transition hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-900 focus:ring-purple-500"
        >
          Enter Golem Social
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.animate-fade-in-up {
  animation: fadeInUp 0.5s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
