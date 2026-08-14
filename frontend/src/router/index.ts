import { createRouter, createWebHistory } from 'vue-router';
import { useUserStore } from '../stores/user';
import LoginView from '../views/LoginView.vue';

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/login',
            name: 'login',
            component: LoginView,
        },
        {
            path: '/',
            name: 'home',
            component: () => import('../views/HomeView.vue'),
        },
        {
            path: '/profile/:id?', // Optional ID, if empty -> current user
            name: 'profile',
            component: () => import('../views/ProfileView.vue'),
        },
        {
            path: '/search',
            name: 'search',
            component: () => import('../views/SearchView.vue'),
        },
        {
            path: '/chats',
            name: 'chats',
            component: () => import('../views/ChatView.vue'),
        },
    ],
});

router.beforeEach((to, _from, next) => {
    const userStore = useUserStore();

    // If trying to access a protected route (everything except login)
    if (to.name !== 'login' && !userStore.isLoggedIn) {
        next({ name: 'login' });
    } else if (to.name === 'login' && userStore.isLoggedIn) {
        // If already logged in and visiting login, go to home
        next({ name: 'home' });
    } else {
        next();
    }
});

export default router;
