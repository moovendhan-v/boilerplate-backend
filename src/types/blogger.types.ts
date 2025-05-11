// types/blogger.ts
export interface AuthorImage {
    url: string;
  }
  
  export interface Author {
    id?: string;
    displayName?: string;
    url?: string;
    image?: AuthorImage;
  }
  
  export interface Blog {
    id: string;
  }
  
  export interface BlogImage {
    url: string;
  }
  
  export interface BloggerPost {
    labels?: string[];
    id: string;
    kind?: string;
    blog?: Blog;
    title: string;
    published: string;
    updated?: string;
    url?: string;
    selfLink?: string;
    content?: string;
    author?: Author;
    images?: BlogImage[]; // Added images array from API
  }
  
  export interface BloggerPostsResponse {
    items: BloggerPost[];
    nextPageToken?: string;
  }
  
  export interface EnhancedBloggerPost extends BloggerPost {
    thumbnail?: string | null;
    shortDescription?: string;
  }