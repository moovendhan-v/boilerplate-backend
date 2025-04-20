import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { FileInput } from '../resolvers/boilerplate.resolver';

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