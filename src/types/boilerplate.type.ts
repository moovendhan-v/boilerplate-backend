import {
  ObjectType,
  Field,
  ID,
  Int,
  InputType,
  registerEnumType,
  GraphQLISODateTime,
} from "@nestjs/graphql";

// Enums for advanced filtering
export enum TextMatchMode {
  EXACT = "EXACT",
  CONTAINS = "CONTAINS",
  FUZZY = "FUZZY",
  STARTS_WITH = "STARTS_WITH",
  ENDS_WITH = "ENDS_WITH",
  REGEX = "REGEX",
}

export enum OrderDirection {
  ASC = "asc",
  DESC = "desc",
}

// Register enums with GraphQL
registerEnumType(TextMatchMode, {
  name: "TextMatchMode",
  description: "Text matching modes for string comparisons",
});

registerEnumType(OrderDirection, {
  name: "OrderDirection",
  description: "Sorting direction",
});

// FileInput type
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

// Boilerplate GraphQL Object Type
@ObjectType('BoilerplateType')
export class Boilerplate {
  @Field(() => ID)
  id!: string;

  @Field()
  title!: string;

  @Field()
  description!: string;

  @Field({ nullable: true })
  repositoryUrl?: string;

  @Field({ nullable: true })
  framework?: string;

  @Field()
  language!: string;

  @Field(() => [String], { nullable: true })
  tags?: string[];

  @Field(() => Int, { nullable: true })
  stars?: number;

  @Field(() => Int, { nullable: true })
  downloads?: number;

  @Field()
  authorId!: string;

  @Field(() => [FileInput], { nullable: true })
  files?: FileInput[];

  @Field(() => GraphQLISODateTime, { nullable: true })
  createdAt?: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  updatedAt?: Date;

  @Field(() => [String], { nullable: true })
  likedBy?: string[];

  @Field(() => [String], {
    nullable: true,
    description: 'List of user IDs who liked this boilerplate',
  })
  likedByUsers?: string[];
}

// Boilerplate Input Type
@InputType("BoilerplateInputType")
export class BoilerplateInput {
  @Field()
  title!: string;

  @Field()
  description!: string;

  @Field({ nullable: true })
  repositoryUrl?: string;

  @Field()
  framework!: string;

  @Field()
  categoryId!: string;

  @Field()
  language!: string;

  @Field({ nullable: true })
  repoPath?: string;

  @Field({ nullable: true })
  category?: string;

  @Field()
  authorId!: string;

  @Field(() => [String], { nullable: true })
  tags?: string[];
}

// Boilerplate Query Filters and Ordering
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

// Boilerplate OrderBy Input Type
@InputType("BoilerplateOrderByInputType")
export class BoilerplateOrderByInput {
  @Field(() => OrderDirection, { nullable: true })
  title?: OrderDirection;

  @Field(() => OrderDirection, { nullable: true })
  stars?: OrderDirection;

  @Field(() => OrderDirection, { nullable: true })
  downloads?: OrderDirection;

  @Field(() => OrderDirection, { nullable: true })
  createdAt?: OrderDirection;

  @Field(() => OrderDirection, { nullable: true })
  updatedAt?: OrderDirection;
}

// PageInfo Object Type for Pagination
@ObjectType()
export class PageInfo {
  @Field(() => Boolean)
  hasNextPage!: boolean;

  @Field(() => String, { nullable: true })
  endCursor?: string;
}

// Boilerplate Edge Object Type for Pagination
@ObjectType()
export class BoilerplateEdge {
  @Field(() => Boilerplate)
  node!: Boilerplate;

  @Field()
  cursor!: string;
}

// Boilerplate Connection Object Type for Pagination
@ObjectType()
export class BoilerplateConnection {
  @Field(() => [BoilerplateEdge])
  edges!: BoilerplateEdge[];

  @Field(() => PageInfo)
  pageInfo!: PageInfo;

  @Field(() => Int)
  totalCount!: number;
}

// Tag types
@ObjectType()
export class Tag {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  name!: string;
}

@ObjectType()
export class TagEdge {
  @Field(() => String)
  cursor!: string;

  @Field(() => Tag)
  node!: Tag;
}

@ObjectType()
export class TagConnection {
  @Field(() => [TagEdge])
  edges!: TagEdge[];

  @Field(() => Int)
  totalCount!: number;

  @Field(() => Boolean)
  hasNextPage!: boolean;
}
