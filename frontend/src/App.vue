<script setup lang="ts">
import { onMounted } from 'vue';
import { RouterView } from 'vue-router';

import { useUserStore } from './stores/user';
import NavBar from './components/NavBar.vue';

const userStore = useUserStore();

onMounted(() => {
  if (userStore.isLoggedIn) {
    userStore.fetchUserProfile();
  }
});
</script>

<template>
  <div class="min-h-screen bg-neutral-950 text-gray-100 font-sans selection:bg-purple-500 selection:text-white">
    <NavBar v-if="userStore.isLoggedIn" />
    <main class="container mx-auto px-4 py-8">
      <RouterView />
    </main>
  </div>
</template>

<style>
/* Global scrollbar styling */
::-webkit-scrollbar {
  width: 10px;
}
::-webkit-scrollbar-track {
  background: #111;
}
::-webkit-scrollbar-thumb {
  background: #333;
  border-radius: 5px;
}
::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>
