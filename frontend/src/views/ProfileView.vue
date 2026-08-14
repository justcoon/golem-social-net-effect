<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, type User, type Post, type UserConnectionType } from '../api';
import { useUserStore } from '../stores/user';
import { useChatStore } from '../stores/chat';
import { storeToRefs } from 'pinia';
import PostCard from '../components/PostCard.vue';
import CreatePost from '../components/CreatePost.vue';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const chatStore = useChatStore();
const { userId: currentUserId, isLoggedIn } = storeToRefs(userStore);

const user = ref<User | null>(null);
const posts = ref<Post[]>([]);
const isLoading = ref(true);
const isConnecting = ref(false);
const isDisconnecting = ref(false);
const error = ref('');
const selectedConnectionType = ref<UserConnectionType>('Following');

const activeMenuUserId = ref<string | null>(null);

function toggleMenu(userId: string, event: Event) {
  event.stopPropagation();
  activeMenuUserId.value = activeMenuUserId.value === userId ? null : userId;
}

// Close menu when clicking away
if (typeof window !== 'undefined') {
  window.addEventListener('click', () => {
    activeMenuUserId.value = null;
  });
}

const connectionToCurrentUser = computed(() => {
  if (!user.value || !currentUserId.value) return null;
  const connections = user.value.connectedUsers || [];
  return connections.find(([id]) => id === currentUserId.value);
});

const isCurrentUser = ref(false);

const isAlreadyConnected = computed(() => {
  if (!user.value || !currentUserId.value) return false;
  const connections = user.value.connectedUsers || [];
  return connections.some(([id]) => id === currentUserId.value);
});

async function loadProfile() {
  const targetId = (route.params.id as string) || currentUserId.value;
  if (!targetId) return;

  isCurrentUser.value = targetId === currentUserId.value;
  isLoading.value = true;
  error.value = '';
  user.value = null;
  posts.value = [];

  try {
    // Parallel fetch
    // We use getTimeline with a filter to get the user's OWN posts with content.
    // The raw `getPosts` endpoint only returns IDs without content.
    const [userRes, postsRes] = await Promise.allSettled([
      api.getUser(targetId),
      api.getPosts(targetId)
    ]);

    if (userRes.status === 'fulfilled') {
        const data = userRes.value.data as any;
        user.value = data;
    } else {
        error.value = 'User not found';
    }

    if (postsRes.status === 'fulfilled') {
        const data = postsRes.value.data as any;
        if (Array.isArray(data)) {
           posts.value = data;
        } else {
           posts.value = [];
        }
    }
  } catch (err) {
    console.error(err);
    error.value = 'Failed to load profile';
  } finally {
    isLoading.value = false;
  }
}

async function handleConnect() {
  if (!currentUserId.value || !user.value || !isLoggedIn.value) return;

  isConnecting.value = true;
  try {
    await api.connectUser(currentUserId.value, user.value.userId, selectedConnectionType.value);
    // Refresh to show new connection
    await loadProfile();
  } catch (err) {
    console.error('Failed to connect:', err);
  } finally {
    isConnecting.value = false;
  }
}

async function handleDisconnect(type: UserConnectionType) {
  if (!currentUserId.value || !user.value || !isLoggedIn.value) return;

  isDisconnecting.value = true;
  try {
    await api.disconnectUser(currentUserId.value, user.value.userId, type);
    // Refresh to show connection removed
    await loadProfile();
  } catch (err) {
    console.error('Failed to disconnect:', err);
  } finally {
    isDisconnecting.value = false;
  }
}

async function handleDisconnectUser(targetId: string, type: UserConnectionType) {
  if (!currentUserId.value || !isLoggedIn.value) return;
  
  isDisconnecting.value = true;
  try {
    await api.disconnectUser(currentUserId.value, targetId, type);
    await loadProfile();
  } catch (err) {
    console.error('Failed to disconnect user:', err);
  } finally {
    isDisconnecting.value = false;
  }
}

async function chatWithUser(targetId: string) {
  await chatStore.goToChatWithUser(targetId);
  router.push('/chats');
}

watch(() => route.params.id, () => {
  loadProfile();
}, { immediate: true });

</script>

<template>
  <div class="max-w-4xl mx-auto">
    <div v-if="isLoading" class="flex justify-center py-20">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
    </div>

    <div v-else-if="error" class="text-center py-20">
      <h2 class="text-2xl font-bold text-red-500">{{ error }}</h2>
    </div>

    <div v-else-if="user" class="space-y-8">
      <!-- Profile Header -->
      <div class="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 relative overflow-hidden">
        <div class="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-purple-600"></div>
        
        <div class="flex flex-col md:flex-row items-center md:items-start gap-6">
          <div class="w-24 h-24 rounded-full bg-neutral-800 flex items-center justify-center text-3xl font-bold text-gray-300 border-4 border-neutral-900 shadow-xl">
             {{ user.userId.charAt(0).toUpperCase() }}
          </div>
          
          <div class="flex-1 text-center md:text-left">
            <h1 class="text-3xl font-bold text-white mb-2">{{ user.name || user.userId }}</h1>
            <p class="text-gray-400 mb-4">@{{ user.userId }}</p>
            <p v-if="user.email" class="text-gray-500 text-sm mb-4">{{ user.email }}</p>
            
            <div class="flex flex-wrap gap-4 justify-center md:justify-start">
               <!-- Stats / Actions placeholder -->
               <!-- Could show number of followers etc if available -->
            </div>
          </div>
          
          <div v-if="!isCurrentUser && isLoggedIn && !isAlreadyConnected" class="flex flex-col sm:flex-row items-center gap-3 bg-neutral-800/50 p-3 rounded-xl border border-neutral-700/50">
             <div class="flex bg-neutral-900 rounded-lg p-1 border border-neutral-700">
               <button 
                @click="selectedConnectionType = 'Following'"
                class="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                :class="selectedConnectionType === 'Following' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-200'"
               >
                 Following
               </button>
               <button 
                @click="selectedConnectionType = 'Friend'"
                class="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                :class="selectedConnectionType === 'Friend' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-200'"
               >
                 Friend
               </button>
             </div>
             
             <button 
                @click="handleConnect"
                :disabled="isConnecting"
                class="px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg transition-all font-bold text-sm shadow-lg shadow-purple-900/20 disabled:opacity-50 flex items-center gap-2"
             >
               <span v-if="isConnecting" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
               {{ isConnecting ? 'Connecting...' : 'Connect' }}
             </button>
          </div>
          <div v-else-if="!isCurrentUser && !isLoggedIn">
             <router-link 
              to="/login"
              class="px-6 py-2 border border-purple-500/50 text-purple-400 hover:bg-purple-500/10 rounded-lg transition-all font-medium text-sm"
             >
               Log in to Follow
             </router-link>
          </div>
          <div v-else-if="!isCurrentUser && isAlreadyConnected" class="flex flex-col gap-2">
            <div v-if="connectionToCurrentUser" class="flex flex-wrap gap-2 justify-center md:justify-start">
              <div 
                  v-for="type in connectionToCurrentUser[1].connectionTypes" 
                  :key="type"
                  class="flex items-center gap-2 bg-neutral-800/50 px-3 py-1.5 rounded-lg border border-neutral-700/50 group transition-all hover:border-neutral-600"
              >
                  <span class="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]"></span>
                  <span class="text-xs font-medium text-gray-300 capitalize">{{ type }}</span>
                  <button 
                      @click="handleDisconnect(type)"
                      :disabled="isDisconnecting"
                      class="ml-1 text-gray-500 hover:text-red-400 transition-colors disabled:opacity-50"
                      :title="`Remove ${type}`"
                  >
                      <svg v-if="!isDisconnecting" xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                      </svg>
                      <span v-else class="w-3 h-3 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin block"></span>
                  </button>
              </div>
              
              <!-- Additional connect option if not all types are connected -->
              <button 
                v-if="connectionToCurrentUser[1].connectionTypes.length < 2"
                @click="handleConnect"
                :disabled="isConnecting"
                class="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-gray-300 rounded-lg transition-all text-xs font-medium border border-neutral-700"
              >
                + Add {{ connectionToCurrentUser[1].connectionTypes.includes('Friend') ? 'Following' : 'Friend' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Content -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Sidebar (Friends/About) -->
        <div class="lg:col-span-1 space-y-6">
           <div class="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
             <h3 class="font-bold text-gray-200 mb-4">About</h3>
             <p class="text-gray-400 text-sm">
                Joined {{ new Date(user.createdAt?.timestamp || Date.now()).toLocaleDateString() }}
             </p>
           </div>
           
           <div v-if="user.connectedUsers && user.connectedUsers.length > 0" class="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
             <h3 class="font-bold text-gray-200 mb-4">Connections</h3>
             <div class="space-y-3">
                <div 
                  v-for="conn in user.connectedUsers" 
                  :key="conn[0]" 
                  class="flex items-center justify-between group cursor-pointer hover:bg-neutral-800 p-2 rounded-lg transition relative"
                  @click="router.push(`/profile/${conn[0]}`)"
                >
                    <div class="flex items-center space-x-3 min-w-0">
                        <div class="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-xs font-bold text-gray-400 shrink-0">
                            {{ conn[0].charAt(0).toUpperCase() }}
                        </div>
                        <div class="min-w-0">
                             <p class="text-sm font-medium text-gray-200 truncate">{{ conn[0] }}</p>
                             <p class="text-xs text-gray-500 capitalize truncate">{{ conn[1].connectionTypes.join(', ') }}</p>
                        </div>
                    </div>

                    <!-- Action Menu -->
                    <div class="relative">
                        <button 
                            @click="toggleMenu(conn[0], $event)"
                            class="p-1 rounded-md text-gray-500 hover:text-white hover:bg-neutral-700 transition"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                            </svg>
                        </button>

                        <!-- Dropdown -->
                        <div 
                            v-if="activeMenuUserId === conn[0]"
                            class="absolute right-0 mt-1 w-36 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl z-20 py-1 overflow-hidden"
                            @click.stop
                        >
                            <button 
                                @click="chatWithUser(conn[0])"
                                class="w-full text-left px-4 py-2 text-xs text-gray-200 hover:bg-purple-600 transition flex items-center gap-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                                Message
                            </button>
                            
                            <template v-if="isCurrentUser">
                                <button 
                                    v-for="type in conn[1].connectionTypes"
                                    :key="type"
                                    @click="handleDisconnectUser(conn[0], type)"
                                    class="w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-red-500 hover:text-white transition flex items-center gap-2 border-t border-neutral-700"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                      <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                                    </svg>
                                    Remove {{ type }}
                                </button>
                            </template>
                        </div>
                    </div>
                </div>
             </div>
           </div>
        </div>

        <!-- Main Feed -->
        <div class="lg:col-span-2">
           <div v-if="isCurrentUser" class="mb-6">
              <CreatePost @post-created="loadProfile" />
           </div>
           
           <h3 class="text-xl font-bold text-gray-200 mb-4">Posts</h3>
           
           <div v-if="posts.length === 0" class="text-center py-10 bg-neutral-900/50 rounded-xl border border-neutral-800 border-dashed">
             <p class="text-gray-500">No posts yet.</p>
           </div>
           
           <div v-else class="space-y-6">
             <PostCard v-for="post in posts" :key="post.postId" :post="post" />
           </div>
        </div>
      </div>
    </div>
  </div>
</template>
