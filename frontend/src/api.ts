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

