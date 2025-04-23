import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Insert categories first
  const categories = [
    // Web Development
    { name: 'Frontend', slug: 'frontend' },
    { name: 'Backend', slug: 'backend' },
    { name: 'Full Stack', slug: 'full-stack' },
    
    // Application Types
    { name: 'Mobile', slug: 'mobile' },
    { name: 'Desktop', slug: 'desktop' },
    { name: 'Web App', slug: 'web-app' },
    { name: 'Progressive Web App', slug: 'pwa' },
    { name: 'Single Page Application', slug: 'spa' },
    
    // Infrastructure & DevOps
    { name: 'DevOps', slug: 'devops' },
    { name: 'CI/CD', slug: 'ci-cd' },
    { name: 'Docker', slug: 'docker' },
    { name: 'Kubernetes', slug: 'kubernetes' },
    { name: 'Serverless', slug: 'serverless' },
    
    // Database & Storage
    { name: 'Database', slug: 'database' },
    { name: 'Cache', slug: 'cache' },
    { name: 'Data Analytics', slug: 'data-analytics' },
    
    // Security & Authentication
    { name: 'Authentication', slug: 'authentication' },
    { name: 'Authorization', slug: 'authorization' },
    { name: 'Security', slug: 'security' },
    
    // API & Integration
    { name: 'API', slug: 'api' },
    { name: 'GraphQL', slug: 'graphql' },
    { name: 'REST', slug: 'rest' },
    { name: 'Microservices', slug: 'microservices' },
    
    // Testing & Quality
    { name: 'Testing', slug: 'testing' },
    { name: 'E2E Testing', slug: 'e2e-testing' },
    { name: 'Unit Testing', slug: 'unit-testing' },
    
    // UI/UX
    { name: 'UI Components', slug: 'ui-components' },
    { name: 'Design System', slug: 'design-system' },
    { name: 'CSS Framework', slug: 'css-framework' },
    
    // Specific Technologies
    { name: 'React', slug: 'react' },
    { name: 'Vue', slug: 'vue' },
    { name: 'Angular', slug: 'angular' },
    { name: 'Node.js', slug: 'nodejs' },
    { name: 'Python', slug: 'python' },
    { name: 'Java', slug: 'java' },
    
    // Cloud Platforms
    { name: 'AWS', slug: 'aws' },
    { name: 'Azure', slug: 'azure' },
    { name: 'Google Cloud', slug: 'gcp' },
    
    // Emerging Tech
    { name: 'AI/ML', slug: 'ai-ml' },
    { name: 'Blockchain', slug: 'blockchain' },
    { name: 'IoT', slug: 'iot' },
    
    // Tools & Utilities
    { name: 'Development Tools', slug: 'dev-tools' },
    { name: 'Monitoring', slug: 'monitoring' },
    { name: 'Analytics', slug: 'analytics' }
  ];

  // Create categories
  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {},
      create: category,
    });
  }

  console.log('Categories have been seeded successfully. 🌱');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
