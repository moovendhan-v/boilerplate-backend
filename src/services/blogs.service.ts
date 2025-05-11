// services/blogs.service.ts
import axios from 'axios';
import { BloggerPost, BloggerPostsResponse, EnhancedBloggerPost } from '../types/blogger.types';

const BASE_URL = 'https://www.googleapis.com/blogger/v3';
const BLOG_ID = process.env.BLOGGER_BLOG_ID;
const BLOGGER_API_KEY = process.env.BLOGGER_API_KEY;

interface GetPostsOptions {
  pageToken?: string;
  maxResults?: number;
  fetchImages?: boolean;
  fetchBodies?: boolean;
  orderBy?: 'published' | 'updated';
  startDate?: string;
  endDate?: string;
  labels?: string[];
  status?: 'draft' | 'live' | 'scheduled';
}

export class BloggerService {
  async getPosts(options: GetPostsOptions = {}) {
    const {
      pageToken,
      maxResults = 10,
      fetchImages = true, // Enable images by default
      fetchBodies = true, // We need bodies for descriptions by default
      orderBy = 'published',
      startDate,
      endDate,
      labels,
      status = 'live'
    } = options;

    const url = new URL(`${BASE_URL}/blogs/${BLOG_ID}/posts`);
    
    if (!BLOGGER_API_KEY || !BLOG_ID) 
      throw new Error("Internal Server Error unable to fetch posts");
    
    // Add required parameters
    url.searchParams.append("key", BLOGGER_API_KEY);
    
    // Add optional parameters
    url.searchParams.append("maxResults", maxResults.toString());
    url.searchParams.append("fetchImages", fetchImages.toString());
    url.searchParams.append("fetchBodies", fetchBodies.toString());
    url.searchParams.append("orderBy", orderBy);
    url.searchParams.append("status", status);
    
    if (pageToken) url.searchParams.append("pageToken", pageToken);
    if (startDate) url.searchParams.append("startDate", startDate);
    if (endDate) url.searchParams.append("endDate", endDate);
    if (labels && labels.length) url.searchParams.append("labels", labels.join(','));
    
    try {
      const response = await axios.get<BloggerPostsResponse>(url.toString());

      const responseData = response.data;
      const jsonString = JSON.stringify({ blogresponse: responseData });
      console.log("BloggerResponse:", jsonString);
      // Process posts to add thumbnail and shortDescription fields
      const processedPosts: EnhancedBloggerPost[] = (response.data.items || []).map((post: BloggerPost) => {
        // Try to get thumbnail from images metadata first (if fetchImages=true)
        let thumbnail: string | null = null;
        
        // If the API returned images metadata, use the first image
        if (post.images && post.images.length > 0) {
          thumbnail = post.images[0].url;
        } else {
          // Fallback to extracting from content
          thumbnail = this.extractThumbnailFromContent(post.content);
        }
        
        return {
          ...post,
          thumbnail,
          shortDescription: this.createShortDescription(post.content)
        };
      });
      
      return {
        posts: processedPosts,
        nextPageToken: response.data.nextPageToken || null,
      };
    } catch (error) {
      console.error("Error fetching blogger posts:", error);
      throw new Error("Failed to fetch blogger posts.");
    }
  }
  
  async getPostById(postId: string): Promise<EnhancedBloggerPost> {
    if (!BLOGGER_API_KEY || !BLOG_ID) 
      throw new Error("Internal Server Error unable to fetch post");
      
    const url = new URL(`${BASE_URL}/blogs/${BLOG_ID}/posts/${postId}`);
    url.searchParams.append("key", BLOGGER_API_KEY);
    url.searchParams.append("fetchImages", "true");
    
    try {
      const response = await axios.get<BloggerPost>(url.toString());
      
      // Try to get thumbnail from images metadata first
      let thumbnail: string | null = null;
      
      if (response.data.images && response.data.images.length > 0) {
        thumbnail = response.data.images[0].url;
      } else {
        thumbnail = this.extractThumbnailFromContent(response.data.content);
      }
      
      return {
        ...response.data,
        thumbnail,
        shortDescription: this.createShortDescription(response.data.content)
      };
    } catch (error) {
      console.error("Error fetching blogger post:", error);
      throw new Error("Failed to fetch blogger post.");
    }
  }
  
  // Helper function to extract first image URL from HTML content
  private extractThumbnailFromContent(content?: string): string | null {
    if (!content) return null;
    
    // Regular expression to find the first image src in the HTML content
    const imgRegex = /<img.*?src=["'](.*?)["']/i;
    const match = content.match(imgRegex);
    
    return match ? match[1] : null;
  }
  
  // Helper function to create a short description by stripping HTML and limiting to ~150 chars
  private createShortDescription(content?: string): string {
    if (!content) return '';
    
    // Remove HTML tags
    const textContent = content.replace(/<[^>]*>?/gm, '');
    
    // Limit to approximately 150 characters and add ellipsis if truncated
    const limit = 150;
    return textContent.length > limit 
      ? `${textContent.substring(0, limit).trim()}...` 
      : textContent.trim();
  }
}