<script setup lang="ts">
import { ref, computed } from 'vue';
import { type Comment, type LikeType, api } from '../api';
import LikeReactions from './LikeReactions.vue';
import { useUserStore } from '../stores/user';
import { storeToRefs } from 'pinia';

const props = defineProps<{
  comment: Comment;
  allComments: Comment[];
  postId: string;
  depth: number;
}>();

const emit = defineEmits<{
  (e: 'comment-added', newComment: Comment): void;
  (e: 'comment-deleted', commentId: string): void;
}>();

const userStore = useUserStore();
const { userId, isLoggedIn } = storeToRefs(userStore);

const isCollapsed = ref(true);
const isReplying = ref(false);
const replyContent = ref('');
const isSubmitting = ref(false);
const isDeleting = ref(false);

const canDelete = computed(() => userId.value === props.comment.createdBy);

const childComments = computed(() => {
  return props.allComments.filter(c => c.parentCommentId === props.comment.commentId)
    .sort((a, b) => new Date(a.createdAt.timestamp).getTime() - new Date(b.createdAt.timestamp).getTime());
});

const totalNestedCount = computed(() => {
  let count = childComments.value.length;
  childComments.value.forEach(child => {
    count += countSubReplies(child.commentId);
  });
  return count;
});

function countSubReplies(commentId: string): number {
  const babies = props.allComments.filter(c => c.parentCommentId === commentId);
  let count = babies.length;
  babies.forEach(b => {
    count += countSubReplies(b.commentId);
  });
  return count;
}

async function handleDelete() {
  if (!canDelete.value || isDeleting.value) return;
  
  if (!confirm('Are you sure you want to delete this comment?')) return;
  
  isDeleting.value = true;
  try {
    await api.deleteComment(props.postId, props.comment.commentId);
    emit('comment-deleted', props.comment.commentId);
  } catch (error) {
    console.error('Failed to delete comment:', error);
    alert('Failed to delete comment');
  } finally {
    isDeleting.value = false;
  }
}

async function handleLike(type: LikeType) {
  if (!userId.value) return;
  const uid = userId.value;
  
  if (!props.comment.likes) props.comment.likes = [];
  const likes = props.comment.likes;
  
  const existingEntry = likes.find(([u]) => u === uid);
  const oldLike = existingEntry ? existingEntry[1] : undefined;
  
  if (existingEntry) {
    existingEntry[1] = type;
  } else {
    likes.push([uid, type]);
  }
  
  try {
    await api.likeComment(props.postId, props.comment.commentId, uid, type);
  } catch (error) {
    console.error('Failed to like comment:', error);
    const currentIndex = likes.findIndex(([u]) => u === uid);
    if (currentIndex !== -1) {
      const entry = likes[currentIndex];
      if (entry) {
        if (oldLike) {
          entry[1] = oldLike;
        } else {
          likes.splice(currentIndex, 1);
        }
      }
    }
  }
}

async function handleUnlike() {
  if (!userId.value || !props.comment.likes) return;
  const uid = userId.value;
  const likes = props.comment.likes;
  
  const existingIndex = likes.findIndex(([u]) => u === uid);
  if (existingIndex === -1) return;
  
  const entry = likes[existingIndex];
  if (!entry) return;
  
  const oldLike = entry[1];
  likes.splice(existingIndex, 1);
  
  try {
    await api.unlikeComment(props.postId, props.comment.commentId, uid);
  } catch (error) {
    console.error('Failed to unlike comment:', error);
    likes.push([uid, oldLike]);
  }
}

async function submitReply() {
  if (!replyContent.value.trim() || !userId.value) return;
  
  isSubmitting.value = true;
  try {
    const response = await api.addComment(props.postId, userId.value, replyContent.value, props.comment.commentId);
    
    const newCommentObj: Comment = {
      commentId: response.data,
      content: replyContent.value,
      createdBy: userId.value,
      createdAt: { timestamp: new Date().toISOString() },
      parentCommentId: props.comment.commentId,
      likes: []
    };
    
    emit('comment-added', newCommentObj);
    replyContent.value = '';
    isReplying.value = false;
  } catch (error) {
    console.error('Failed to post reply:', error);
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div class="comment-item" :style="{ marginLeft: depth > 0 ? '1.5rem' : '0' }">
    <div class="bg-neutral-800/50 rounded-lg p-3 mb-2 border-l-2 border-transparent hover:border-purple-500/30 transition-all group">
      <div class="flex justify-between items-center mb-1">
        <div class="flex items-center space-x-2">
          <button 
            @click="isCollapsed = !isCollapsed" 
            class="w-4 h-4 flex items-center justify-center rounded bg-neutral-700 text-gray-400 hover:text-purple-400 hover:bg-neutral-600 transition text-[10px] font-bold"
          >
            {{ isCollapsed ? '+' : '−' }}
          </button>
          <span class="text-xs font-bold text-gray-300">{{ comment.createdBy }}</span>
          <span v-if="isCollapsed" class="text-[10px] text-gray-500 italic">
            collapsed {{ totalNestedCount > 0 ? `(${totalNestedCount} replies)` : '' }}
          </span>
        </div>
        <span class="text-[10px] text-gray-600">{{ new Date(comment.createdAt.timestamp).toLocaleString() }}</span>
        <button 
          v-if="canDelete" 
          @click="handleDelete" 
          :disabled="isDeleting"
          class="text-[10px] text-red-400 hover:text-red-300 transition font-medium ml-2"
        >
          {{ isDeleting ? 'Deleting...' : 'Delete' }}
        </button>
      </div>

      <div v-if="!isCollapsed">
        <p class="text-sm text-gray-400 whitespace-pre-wrap mb-3">{{ comment.content }}</p>
        
        <div class="flex items-center space-x-4">
          <!-- Comment Likes -->
          <LikeReactions 
            :likes="comment.likes" 
            :current-user-id="userId"
            @like="handleLike"
            @unlike="handleUnlike"
          />
          
          <button 
            v-if="isLoggedIn && depth < 5" 
            @click="isReplying = !isReplying"
            class="text-[10px] text-purple-400 hover:text-purple-300 transition font-medium"
          >
            {{ isReplying ? 'Cancel' : 'Reply' }}
          </button>
        </div>

        <!-- Reply Input -->
        <div v-if="isReplying" class="mt-3 flex gap-2">
          <input 
            v-model="replyContent"
            type="text" 
            placeholder="Write a reply..." 
            class="flex-1 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs text-gray-200 focus:ring-1 focus:ring-purple-500 placeholder-gray-600 outline-none"
            @keyup.enter="submitReply"
          />
          <button 
            @click="submitReply" 
            :disabled="!replyContent.trim() || isSubmitting"
            class="bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-medium px-3 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Post
          </button>
        </div>
      </div>
    </div>

    <!-- Nested Replies -->
    <div v-if="!isCollapsed && childComments.length > 0" class="nested-replies">
      <CommentItem 
        v-for="child in childComments" 
        :key="child.commentId"
        :comment="child"
        :all-comments="allComments"
        :post-id="postId"
        :depth="depth + 1"
        @comment-added="(nc) => emit('comment-added', nc)"
        @comment-deleted="(id) => emit('comment-deleted', id)"
      />
    </div>
  </div>
</template>

<style scoped>
.comment-item {
  position: relative;
}

.nested-replies::before {
  content: '';
  position: absolute;
  left: -0.75rem;
  top: 0;
  bottom: 1.5rem;
  width: 1px;
  background: rgba(139, 92, 246, 0.1);
}
</style>
