<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useUserStore } from '../stores/user';

const router = useRouter();
const userStore = useUserStore();

function handleLogout() {
  userStore.logout();
  router.push('/login');
}
</script>

<template>
  <nav class="bg-gray-800 border-b border-gray-700 sticky top-0 z-50 backdrop-blur-md bg-opacity-80">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <div class="flex items-center">
          <router-link to="/" class="flex-shrink-0">
            <span class="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
              Golem Social
            </span>
          </router-link>
          <div class="hidden md:block">
            <div class="ml-10 flex items-baseline space-x-4">
              <router-link to="/" 
                class="px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-700 transition"
                active-class="bg-gray-900 text-white"
              >
                Timeline
              </router-link>

              <router-link to="/search" 
                class="px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-700 transition"
                 active-class="bg-gray-900 text-white"
              >
                Search
              </router-link>
              
              <router-link :to="`/profile/${userStore.userId}`" 
                class="px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-700 transition"
                 active-class="bg-gray-900 text-white"
              >
                My Profile
              </router-link>

              <router-link to="/chats" 
                class="px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-700 transition"
                 active-class="bg-gray-900 text-white"
              >
                Chats
              </router-link>
            </div>
          </div>
        </div>
        <div class="flex items-center space-x-4">
          <span v-if="userStore.userId" class="text-sm font-semibold text-gray-400">
             @{{ userStore.userId }}
          </span>
          <button @click="handleLogout" class="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium">
            Logout
          </button>
        </div>
      </div>
    </div>
  </nav>
</template>
