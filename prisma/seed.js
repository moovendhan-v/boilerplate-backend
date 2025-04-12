import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Insert the user
  let user = await prisma.user.findUnique({
    where: { email: 'test@example.com' },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test User',
      },
    });
  }

  // Insert boilerplates one by one
  const boilerplates = [
    {
      name: 'Next.js Starter Kit',
      description: 'A modern Next.js boilerplate with TypeScript, Tailwind CSS, and more',
      tags: ['next.js', 'typescript', 'tailwind'],
      framework: 'Next.js',
      language: 'TypeScript',
      authorId: user.id,
    },
    {
      name: 'React Vite Template',
      description: 'Lightning-fast React development with Vite and TypeScript',
      tags: ['react', 'vite', 'typescript'],
      framework: 'React',
      language: 'TypeScript',
      authorId: user.id,
    },
    {
      name: 'Express API Starter',
      description: 'RESTful API boilerplate with Express.js and MongoDB',
      tags: ['express', 'mongodb', 'api'],
      framework: 'Express.js',
      language: 'JavaScript',
      authorId: user.id,
    },
    {
      name: 'Vue 3 Composition Template',
      description: 'Modern Vue.js setup with Composition API and TypeScript',
      tags: ['vue', 'composition-api', 'typescript'],
      framework: 'Vue.js',
      language: 'TypeScript',
      authorId: user.id,
    },
  ];

  for (const boilerplate of boilerplates) {
    await prisma.boilerplate.create({ data: boilerplate });
  }

  console.log('Database has been seeded. 🌱');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
