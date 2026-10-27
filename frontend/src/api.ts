import axios from 'axios';

export const API_BASE_URL = '/api/v1/social-net';

export const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export type UserConnectionType = 'Friend' | 'Following' | 'Follower'

export interface Timestamp {
    timestamp: string;
}

export function parseDate(val?: Timestamp | string | number | null): Date {
    if (!val) return new Date();
    if (typeof val === 'string' || typeof val === 'number') {
        const d = new Date(val);
        return isNaN(d.getTime()) ? new Date() : d;
    }
    if (typeof val === 'object' && 'timestamp' in val && val.timestamp) {
        const d = new Date(val.timestamp);
        return isNaN(d.getTime()) ? new Date() : d;
    }
    return new Date();
}

export function formatTimestamp(val?: Timestamp | string | null): string {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'object' && 'timestamp' in val && val.timestamp) return val.timestamp;
    return String(val);
}

// Types based on inferred backend usage

export interface ConnectedUser {
    userId: string;
    connectionTypes: UserConnectionType[];
    createdAt: Timestamp;
    updatedAt: Timestamp;
}
// Connected users is a list of tuples: [userId, UserDetails]
export type ConnectedUserTuple = [string, ConnectedUser];

export interface User {
    userId: string;
    name?: string;
    email?: string;
    createdAt?: Timestamp; // Enforced Timestamp only
    connectedUsers?: ConnectedUserTuple[];
}

export type LikeType = 'Like' | 'Insightful' | 'Love' | 'Dislike';

export type UserLikeTuple = [string, LikeType];

export interface Comment {
    commentId: string;
    parentCommentId?: string;
    content: string;
    likes?: UserLikeTuple[];
    createdBy: string;
    createdAt: Timestamp;
}
// Comments is a list of tuples: [commentId, Comment]
export type CommentTuple = [string, Comment];

export interface Post {
    postId: string;
    content: string;
    createdBy: string;
    createdAt: Timestamp;
    likes?: UserLikeTuple[];
    comments?: CommentTuple[];
}

export interface PostRef {
    postId: string;
    createdBy: string;
    createdByConnectionType?: UserConnectionType;
    createdAt: Timestamp;
}

export interface TimelineUpdates {
    userId: string;
    posts: PostRef[];
}

export interface ConnectionRequest {
    userId: string; // The target user ID
    connectionType: UserConnectionType; // Assuming these types
}

export const convertToKebabCase = (obj: any) => {
    // Helper if we need to convert camelCase to kebab-case for backend
    // But currently backend seems to expect json body, fields like `user-id`.
    return obj;
}

export const api = {
    getUser: (userId: string) => apiClient.get(`/users/${userId}`),
    updateName: (userId: string, name: string) => apiClient.put(`/users/${userId}/name`, { name }),
    updateEmail: (userId: string, email: string) => apiClient.put(`/users/${userId}/email`, { email }),

    createPost: (userId: string, content: string) => apiClient.post(`/users/${userId}/posts`, { content }),
    getPosts: (userId: string, query: string = '') => apiClient.get(`/users/${userId}/posts/search`, { params: { query } }),

    getTimeline: (userId: string, query: string = '') => apiClient.get(`/users/${userId}/timeline/posts`, { params: { query } }),

    getTimelineUpdates: (userId: string, since: string) => apiClient.get(`/users/${userId}/timeline/posts/updates`, { params: { since } }),

    searchUsers: (query: string) => apiClient.get(`/users/search`, { params: { query } }),

    connectUser: (userId: string, targetUserId: string, type: UserConnectionType = 'Following') =>
        apiClient.put(`/users/${userId}/connections`, { userId: targetUserId, connectionType: type }),

    disconnectUser: (userId: string, targetUserId: string, type: UserConnectionType = 'Following') =>
        apiClient.request({
            method: 'DELETE',
            url: `/users/${userId}/connections`,
            data: { userId: targetUserId, connectionType: type }
        }),

    addComment: (postId: string, userId: string, content: string, parentCommentId?: string) =>
        apiClient.post(`/posts/${postId}/comments`, { userId: userId, content, parentCommentId: parentCommentId }),

    deleteComment: (postId: string, commentId: string) =>
        apiClient.delete(`/posts/${postId}/comments/${commentId}`),

    likePost: (postId: string, userId: string, likeType: LikeType) =>
        apiClient.put(`/posts/${postId}/likes`, { userId: userId, likeType: likeType }),

    unlikePost: (postId: string, userId: string) =>
        apiClient.delete(`/posts/${postId}/likes/${userId}`),

    likeComment: (postId: string, commentId: string, userId: string, likeType: LikeType) =>
        apiClient.put(`/posts/${postId}/comments/${commentId}/likes`, { userId: userId, likeType: likeType }),

    unlikeComment: (postId: string, commentId: string, userId: string) =>
        apiClient.delete(`/posts/${postId}/comments/${commentId}/likes/${userId}`),

    // Chat APIs
    createChat: (userId: string, participants: string[]) =>
        apiClient.post(`/users/${userId}/chats`, { participants }),

    getChats: (userId: string, query: string = '') =>
        apiClient.get(`/users/${userId}/chats/search`, { params: { query } }),

    getChatUpdates: (userId: string, since: string) =>
        apiClient.get(`/users/${userId}/chats/updates`, { params: { since } }),

    addChatMessage: (chatId: string, userId: string, content: string) =>
        apiClient.post(`/chats/${chatId}/messages`, { userId: userId, content }),

    deleteChatMessage: (chatId: string, messageId: string) =>
        apiClient.delete(`/chats/${chatId}/messages/${messageId}`),

    likeChatMessage: (chatId: string, messageId: string, userId: string, likeType: LikeType) =>
        apiClient.put(`/chats/${chatId}/messages/${messageId}/likes`, { userId: userId, likeType: likeType }),

    unlikeChatMessage: (chatId: string, messageId: string, userId: string) =>
        apiClient.delete(`/chats/${chatId}/messages/${messageId}/likes/${userId}`),

    addChatParticipant: (chatId: string, participants: string[]) =>
        apiClient.patch(`/chats/${chatId}/participants`, { participants }),
};

export interface Message {
    messageId: string;
    content: string;
    likes: UserLikeTuple[];
    createdBy: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface Chat {
    chatId: string;
    createdBy: string;
    participants: string[];
    messages: Message[];
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface ChatRef {
    chatId: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    createdBy?: string;
}

export interface UserChats {
    userId: string;
    chats: ChatRef[];
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface UserChatsUpdates {
    userId: string;
    chats: ChatRef[];
}

/**
 * Generic helper to stream updates from a Durable Streams endpoint (PUT + SSE).
 */
async function streamUpdates<T>(
    endpointPath: string,
    since: string,
    signal: AbortSignal,
    onUpdate: (update: T) => void
): Promise<void> {
    if (signal.aborted) return;

    const params = new URLSearchParams();
    if (since) {
        params.set('since', since);
    }
    params.set('iterWaitTime', '1000');

    // 1. PUT to create or ensure the invocation session
    const putResponse = await fetch(`${API_BASE_URL}${endpointPath}?${params.toString()}`, {
        method: 'PUT',
        signal,
        headers: {
            'Content-Type': 'application/json',
            'Stream-TTL': '300', // 5 minutes sliding idle timeout
        },
    });

    if (!putResponse.ok) {
        throw new Error(`Failed to create stream session at ${endpointPath}: ${putResponse.status} ${putResponse.statusText}`);
    }

    const location = putResponse.headers.get('Location');
    if (!location) {
        throw new Error('Missing Location header from stream session creation');
    }

    // Resolve session path ensuring Vite /api proxy prefix
    let sessionPath = location;
    try {
        if (sessionPath.startsWith('http://') || sessionPath.startsWith('https://')) {
            sessionPath = new URL(sessionPath).pathname;
        }
    } catch {}
    if (!sessionPath.startsWith('/api')) {
        sessionPath = `/api${sessionPath.startsWith('/') ? '' : '/'}${sessionPath}`;
    }

    const slotName = 'updates';
    const slotUrl = `${sessionPath}/streams/${encodeURIComponent(slotName)}?live=sse&offset=-1`;

    // 2. Open EventSource on the slot
    return new Promise((resolve, reject) => {
        if (signal.aborted) {
            fetch(sessionPath, { method: 'DELETE' }).catch(() => {});
            resolve();
            return;
        }

        const eventSource = new EventSource(slotUrl);
        let isClosed = false;

        const cleanup = () => {
            if (isClosed) return;
            isClosed = true;
            eventSource.close();
            // 3. DELETE session to immediately cancel the stream on the agent and free worker resources
            fetch(sessionPath, { method: 'DELETE' }).catch(() => {});
        };

        signal.addEventListener('abort', () => {
            cleanup();
            resolve();
        });

        const handleData = (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data);
                if (Array.isArray(data)) {
                    data.forEach(item => onUpdate(item));
                } else if (data && typeof data === 'object') {
                    onUpdate(data);
                }
            } catch (err) {
                console.warn('Failed to parse SSE update:', err);
            }
        };

        // Golem sends 'event: data', while standard SSE may send 'event: message' or default
        eventSource.addEventListener('data', handleData as EventListener);
        eventSource.addEventListener('message', handleData as EventListener);
        eventSource.onmessage = handleData;

        eventSource.addEventListener('control', (event: any) => {
            try {
                const control = JSON.parse(event.data);
                if (control?.streamClosed) {
                    cleanup();
                    resolve();
                }
            } catch {}
        });

        eventSource.onerror = (err) => {
            if (eventSource.readyState === EventSource.CLOSED || !isClosed) {
                cleanup();
                reject(err);
            }
        };
    });
}

/**
 * Stream chat updates from the backend using Golem Durable Streams protocol (PUT + SSE).
 */
export async function streamChatUpdates(
    userId: string,
    since: string,
    signal: AbortSignal,
    onUpdate: (update: ChatRef) => void
): Promise<void> {
    return streamUpdates<ChatRef>(`/users/${userId}/chats/updates/stream`, since, signal, onUpdate);
}

/**
 * Stream timeline post updates from the backend using Golem Durable Streams protocol (PUT + SSE).
 */
export async function streamTimelineUpdates(
    userId: string,
    since: string,
    signal: AbortSignal,
    onUpdate: (update: PostRef) => void
): Promise<void> {
    return streamUpdates<PostRef>(`/users/${userId}/timeline/posts/updates/stream`, since, signal, onUpdate);
}

