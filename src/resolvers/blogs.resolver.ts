// resolvers/bloggerResolvers.ts
import { BloggerService } from "../services/blogs.service";

const bloggerService = new BloggerService();

export const bloggerResolvers = {
  Query: {
    bloggerPosts: async (_: any, args: {
      pageToken?: string;
      maxResults?: number;
      fetchImages?: boolean;
      orderBy?: string;
      startDate?: string;
      endDate?: string;
      labels?: string[];
      status?: string;
    }) => {
      try {
        return await bloggerService.getPosts({
          pageToken: args.pageToken,
          maxResults: args.maxResults,
          fetchImages: args.fetchImages !== undefined ? args.fetchImages : true,
          orderBy: args.orderBy as any,
          startDate: args.startDate,
          endDate: args.endDate,
          labels: args.labels,
          status: args.status as any
        });
      } catch (error) {
        console.error("Error fetching blogger posts:", error);
        throw new Error("Failed to fetch blogger posts.");
      }
    },
    
    bloggerPost: async (_: any, args: { postId: string }) => {
      try {
        return await bloggerService.getPostById(args.postId);
      } catch (error) {
        console.error("Error fetching blogger post:", error);
        throw new Error("Failed to fetch blogger post.");
      }
    },
  },
};