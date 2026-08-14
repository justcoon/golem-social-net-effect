<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { type Post, type Comment, type LikeType, api } from '../api';
import { useRouter } from 'vue-router';
import { useUserStore } from '../stores/user';
import { storeToRefs } from 'pinia';
import LikeReactions from './LikeReactions.vue';
import CommentItem from './CommentItem.vue';

const props = defineProps<{
  post: Post;
}>();

const router = useRouter();
const userStore = useUserStore();
const { userId, isLoggedIn } = storeToRefs(userStore);

const newComment = ref('');
const isSubmitting = ref(false);

const localPost = ref<Post>({ ...props.post });

const comments = ref<Comment[]>([]);

const updateComments = (postData: Post) => {
    if (postData.comments) {
        comments.value = postData.comments.map(([_, comment]) => comment);
    } else {
        comments.value = [];
    }
};

updateComments(props.post);

// Watch for prop updates to update local state if post data changes externally
watch(() => props.post, (newPost) => {
    console.log('PostCard: post updated', newPost);
    localPost.value = { ...newPost };
    updateComments(newPost);
}, { deep: true });

const topLevelComments = computed(() => {
  return comments.value.filter(c => !c.parentCommentId)
    .sort((a, b) => {
      const timeA = a.createdAt.timestamp;
      const timeB = b.createdAt.timestamp;
      return new Date(timeA).getTime() - new Date(timeB).getTime();
    });
});

const formattedDate = computed(() => {
  const createdAt = localPost.value.createdAt;
  const dateStr = createdAt.timestamp;

  return new Date(dateStr).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
});

function navigateToAuthor() {
  router.push(`/profile/${localPost.value.createdBy}`);
}

async function submitComment() {
    if (!newComment.value.trim() || !userId.value) return;

    isSubmitting.value = true;
    try {
        const response = await api.addComment(localPost.value.postId, userId.value, newComment.value);
        
        // Optimistic update
        const createdNow = new Date().toISOString();
        const newCommentObj: Comment = {
            commentId: response.data,
            content: newComment.value,
            createdBy: userId.value,
            createdAt: { timestamp: createdNow },
            likes: []
        };
        
        comments.value.push(newCommentObj);
        newComment.value = '';
    } catch (error) {
        console.error('Failed to post comment:', error);
    } finally {
        isSubmitting.value = false;
    }
}

function handleCommentAdded(newCommentObj: Comment) {
  comments.value.push(newCommentObj);
}

function handleCommentDeleted(commentId: string) {
  const toRemove = new Set<string>();
  
  function collectDescendants(id: string) {
    toRemove.add(id);
    comments.value.forEach(c => {
      if (c.parentCommentId === id) {
        collectDescendants(c.commentId);
      }
    });
  }
  
  collectDescendants(commentId);
  comments.value = comments.value.filter(c => !toRemove.has(c.commentId));
}

async function handlePostLike(type: LikeType) {
    if (!userId.value) return;
    const uid = userId.value;
    
    if (!localPost.value.likes) localPost.value.likes = [];
    const likes = localPost.value.likes!;
    
    const existingEntry = likes.find(([u]) => u === uid);
    const oldLike = existingEntry ? existingEntry[1] : undefined;
    
    if (existingEntry) {
        existingEntry[1] = type;
    } else {
        likes.push([uid, type]);
    }
    
    try {
        await api.likePost(localPost.value.postId, uid, type);
    } catch (error) {
        console.error('Failed to like post:', error);
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

async function handlePostUnlike() {
    if (!userId.value || !localPost.value.likes) return;
    const uid = userId.value;
    const likes = localPost.value.likes!;
    
    const existingIndex = likes.findIndex(([u]) => u === uid);
    if (existingIndex === -1) return;
    
    const entry = likes[existingIndex];
    if (!entry) return;
    
    const oldLike = entry[1];
    likes.splice(existingIndex, 1);
    
    try {
        await api.unlikePost(localPost.value.postId, uid);
    } catch (error) {
        console.error('Failed to unlike post:', error);
        likes.push([uid, oldLike]);
    }
}

// Comment likes are now handled in CommentItem.vue
</script>

<template>
  <div class="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-lg hover:shadow-purple-900/10 transition duration-300">
    <div class="flex items-start justify-between mb-4">
      <div class="flex items-center space-x-3 cursor-pointer" @click="navigateToAuthor">
        <div class="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold select-none">
          {{ localPost.createdBy.charAt(0).toUpperCase() }}
        </div>
        <div>
          <h3 class="font-medium text-gray-200 hover:text-purple-400 transition">{{ localPost.createdBy }}</h3>
          <p class="text-xs text-gray-500">{{ formattedDate }}</p>
        </div>
      </div>
    </div>
    
    <div class="text-gray-300 whitespace-pre-wrap leading-relaxed mb-4">
      {{ localPost.content }}
    </div>

    <!-- Post Likes -->
    <div class="py-2 border-t border-b border-neutral-800/50 mb-4">
      <LikeReactions 
        :likes="localPost.likes" 
        :current-user-id="userId"
        @like="handlePostLike"
        @unlike="handlePostUnlike"
      />
    </div>

    <div class="mt-4">
      <h4 class="text-sm font-semibold text-gray-400 mb-3">Comments</h4>
      
      <div v-if="comments.length === 0" class="text-xs text-gray-600 italic mb-4">
        No comments yet.
      </div>
      
      <div class="space-y-4 mb-4">
        <CommentItem 
          v-for="comment in topLevelComments" 
          :key="comment.commentId"
          :comment="comment"
          :all-comments="comments"
          :post-id="localPost.postId"
          :depth="0"
          @comment-added="handleCommentAdded"
          @comment-deleted="handleCommentDeleted"
        />
      </div>

      <div v-if="isLoggedIn" class="flex gap-2">
        <input 
            v-model="newComment"
            type="text" 
            placeholder="Write a comment..." 
            class="flex-1 bg-neutral-800 border-none rounded px-3 py-2 text-sm text-gray-200 focus:ring-1 focus:ring-purple-500 placeholder-gray-600"
            @keyup.enter="submitComment"
        />
        <button 
            @click="submitComment" 
            :disabled="!newComment.trim() || isSubmitting"
            class="bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
            {{ isSubmitting ? 'Posting...' : 'Post' }}
        </button>
      </div>
       <div v-else class="text-xs text-gray-600">
        <router-link to="/login" class="text-purple-400 hover:underline">Log in</router-link> to comment.
      </div>
    </div>
  </div>
</template>
