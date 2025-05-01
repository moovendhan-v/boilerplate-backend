import { ObjectType, Field, ID, Int, InputType } from '@nestjs/graphql';
import { GraphQLUpload, FileUpload } from "graphql-upload-minimal";

@InputType("FileInputType")
export class FileInput {
  @Field()
  name!: string;

  @Field()
  path!: string;

  @Field()
  content!: string;

  @Field()
  type!: string;
}


@ObjectType('BoilerplateType')
export class Boilerplate {
  @Field(() => ID)
  id!: string;

  @Field()
  title!: string;

  @Field()
  description!: string;

  @Field()
  repositoryUrl!: string;

  @Field()
  framework!: string;

  @Field()
  language!: string;

  @Field(() => [String])
  tags!: string[];

  @Field(() => Int)
  stars!: number;

  @Field(() => Int)
  downloads!: number;

  @Field(() => String)
  authorId!: string;

  @Field(() => [FileInput])
  files!: FileInput[];

  @Field(() => String)
  createdAt!: string;

  @Field(() => String)
  updatedAt!: string;

  @Field(() => [String], { nullable: true })
  likedBy?: string[];

  @Field(() => [String], { description: 'List of user IDs who liked this boilerplate' })
  likedByUsers!: string[];
}


@InputType("BoilerplateInputType")
export class BoilerplateInput {
  @Field()
  title!: string;

  @Field()
  description!: string;

  @Field()
  repositoryUrl!: string;

  @Field()
  framework!: string;

  @Field()
  language!: string;

  @Field()
  repoPath!: string;

  @Field()
  category!: string;

  @Field()
  authorId!: string;

  @Field(() => [String], { nullable: true })
  tags?: string[];

  @Field(() => GraphQLUpload, { nullable: true })
  zipFile?: Promise<FileUpload>;

  @Field(() => [String], { nullable: false })
  zipFilePath?: string;
}

@InputType("BoilerplateWhereInputType")
export class BoilerplateWhereInput {
  @Field({ nullable: true })
  title?: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  framework?: string;

  @Field({ nullable: true })
  language?: string;

  @Field({ nullable: true })
  authorId?: string;

  @Field(() => [String], { nullable: true })
  tags?: string[];
}

@InputType("BoilerplateOrderByInputType")
export class BoilerplateOrderByInput {
  @Field(() => String, { nullable: true })
  title?: "asc" | "desc";

  @Field(() => String, { nullable: true })
  stars?: "asc" | "desc";

  @Field(() => String, { nullable: true })
  downloads?: "asc" | "desc";

  @Field(() => String, { nullable: true })
  createdAt?: "asc" | "desc";

  @Field(() => String, { nullable: true })
  updatedAt?: "asc" | "desc";
}

@ObjectType()
export class PageInfo {
  @Field(() => Boolean)
  hasNextPage!: boolean;

  @Field(() => String, { nullable: true })
  endCursor?: string;
}

@ObjectType()
export class BoilerplateEdge {
  @Field(() => Boilerplate)
  node!: Boilerplate;

  @Field()
  cursor!: string;
}

@ObjectType()
export class BoilerplateConnection {
  @Field(() => [BoilerplateEdge])
  edges!: BoilerplateEdge[];

  @Field(() => PageInfo)
  pageInfo!: PageInfo;

  @Field(() => Int)
  totalCount!: number;
}


// type BoilerplateWithAuthor = Prisma.BoilerplateGetPayload<{
//   include: {
//     author: true;
//     likes: true;
//     files: true;
//   };
// }>;