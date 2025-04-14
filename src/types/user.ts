import { Field, ObjectType, Int } from 'type-graphql';
import { User as PrismaUser } from '@prisma/client';
import { Boilerplate } from './boilerplate';

@ObjectType()
export class User implements Partial<PrismaUser> {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  email!: string;

  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => String)
  role!: string;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@ObjectType()
export class UserConnection {
  @Field(() => [User])
  nodes!: User[];

  @Field(() => Int)
  totalCount!: number;
} 