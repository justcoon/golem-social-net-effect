import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api, type User } from '../api';

export const useUserStore = defineStore('user', () => {
    const userId = ref<string | null>(localStorage.getItem('userId'));
    const user = ref<User | null>(null);
    const liveTimeline = ref(false);

    const isLoggedIn = computed(() => !!userId.value);

    async function fetchUserProfile() {
        if (!userId.value) return;
        try {
            const response = await api.getUser(userId.value);
            if (response.data) {
                user.value = response.data;
            }
        } catch (e) {
            console.error('Failed to fetch user profile:', e);
        }
    }

    async function login(id: string) {
        userId.value = id;
        localStorage.setItem('userId', id);
        await fetchUserProfile();
    }

    function logout() {
        userId.value = null;
        user.value = null;
        localStorage.removeItem('userId');
    }

    return {
        userId,
        user,
        liveTimeline,
        isLoggedIn,
        login,
        logout,
        fetchUserProfile
    };
});
