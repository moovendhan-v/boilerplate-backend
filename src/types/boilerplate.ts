import { Field, ObjectType, InputType } from 'type-graphql';
import { Boilerplate as PrismaBoilerplate } from '@prisma/client';
import { User } from './user';

@InputType()
export class BoilerplateOrderByInput {
  @Field(() => String, { nullable: true })
  title?: 'asc' | 'desc';

  @Field(() => String, { nullable: true })
  createdAt?: 'asc' | 'desc';

  @Field(() => String, { nullable: true })
  updatedAt?: 'asc' | 'desc';
}

@InputType()
export class BoilerplateWhereInput {
  @Field(() => String, { nullable: true })
  title?: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => String, { nullable: true })
  authorId?: string;

  @Field(() => [String], { nullable: true })
  tags?: string[];
}

@ObjectType()
export class Boilerplate implements Partial<PrismaBoilerplate> {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  title!: string;

  @Field(() => String)
  description!: string;

  @Field(() => String)
  repositoryUrl!: string;

  @Field(() => String)
  framework!: string;

  @Field(() => String)
  language!: string;

  @Field(() => [String])
  tags!: string[];

  @Field(() => User)
  author!: User;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
} 