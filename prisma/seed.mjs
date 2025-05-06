import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);

  // Insert categories with icon and description information
  const categories = [
    // Web Development
    { name: 'Frontend', slug: 'frontend', icon: 'Layout', color: 'text-pink-500', description: 'Frontend development with modern UI frameworks.' },
    { name: 'Backend', slug: 'backend', icon: 'Server', color: 'text-blue-500', description: 'Backend development with scalable server technologies.' },
    { name: 'Full Stack', slug: 'full-stack', icon: 'Cpu', color: 'text-green-500', description: 'Full stack development, combining frontend and backend skills.' },
    
    // Application Types
    { name: 'Mobile', slug: 'mobile', icon: 'Smartphone', color: 'text-purple-500', description: 'Mobile app development for iOS and Android.' },
    { name: 'Desktop', slug: 'desktop', icon: 'Monitor', color: 'text-gray-500', description: 'Building applications for desktop platforms.' },
    { name: 'Web App', slug: 'web-app', icon: 'Globe', color: 'text-sky-500', description: 'Building applications that run in the browser.' },
    { name: 'Progressive Web App', slug: 'pwa', icon: 'CloudSun', color: 'text-orange-400', description: 'Modern web apps that provide offline capabilities.' },
    { name: 'Single Page Application', slug: 'spa', icon: 'LayoutDashboard', color: 'text-yellow-400', description: 'Web apps that load a single HTML page and dynamically update.' },
    
    // Infrastructure & DevOps
    { name: 'DevOps', slug: 'devops', icon: 'CloudCog', color: 'text-green-600', description: 'DevOps practices for automating software delivery.' },
    { name: 'CI/CD', slug: 'ci-cd', icon: 'GitBranch', color: 'text-red-600', description: 'Continuous integration and continuous delivery processes.' },
    { name: 'Docker', slug: 'docker', icon: 'Boxes', color: 'text-blue-600', description: 'Containerization using Docker for consistent environments.' },
    { name: 'Kubernetes', slug: 'kubernetes', icon: 'Network', color: 'text-indigo-500', description: 'Container orchestration with Kubernetes.' },
    { name: 'Serverless', slug: 'serverless', icon: 'Zap', color: 'text-amber-500', description: 'Building serverless applications with cloud functions.' },
    
    // Database & Storage
    { name: 'Database', slug: 'database', icon: 'Database', color: 'text-purple-600', description: 'Relational and NoSQL database management.' },
    { name: 'Cache', slug: 'cache', icon: 'CloudDrizzle', color: 'text-cyan-600', description: 'Caching strategies to improve application performance.' },
    { name: 'Data Analytics', slug: 'data-analytics', icon: 'BarChart2', color: 'text-rose-500', description: 'Using data to derive meaningful insights.' },
    
    // Security & Authentication
    { name: 'Authentication', slug: 'authentication', icon: 'KeyRound', color: 'text-teal-500', description: 'User authentication mechanisms for secure access.' },
    { name: 'Authorization', slug: 'authorization', icon: 'ShieldCheck', color: 'text-lime-500', description: 'Controlling user access based on roles.' },
    { name: 'Security', slug: 'security', icon: 'Shield', color: 'text-red-500', description: 'Best practices for securing applications and data.' },
    
    // API & Integration
    { name: 'API', slug: 'api', icon: 'Braces', color: 'text-blue-500', description: 'Building APIs to enable communication between systems.' },
    { name: 'GraphQL', slug: 'graphql', icon: 'Code', color: 'text-pink-500', description: 'Query language for APIs and runtime for executing queries.' },
    { name: 'REST', slug: 'rest', icon: 'Network', color: 'text-violet-600', description: 'Building RESTful APIs for communication between systems.' },
    { name: 'Microservices', slug: 'microservices', icon: 'Server', color: 'text-gray-600', description: 'Architecture style that structures an application as a collection of small services.' },
    
    // Testing & Quality
    { name: 'Testing', slug: 'testing', icon: 'Bug', color: 'text-orange-500', description: 'Ensuring the quality of code through automated testing.' },
    { name: 'E2E Testing', slug: 'e2e-testing', icon: 'TestTube', color: 'text-cyan-700', description: 'End-to-end testing to verify the entire system.' },
    { name: 'Unit Testing', slug: 'unit-testing', icon: 'FlaskConical', color: 'text-yellow-600', description: 'Testing individual units of code for correctness.' },
    
    // UI/UX
    { name: 'UI Components', slug: 'ui-components', icon: 'Component', color: 'text-indigo-500', description: 'Reusable UI components for faster frontend development.' },
    { name: 'Design System', slug: 'design-system', icon: 'Paintbrush', color: 'text-rose-600', description: 'A collection of standards for design and development.' },
    { name: 'CSS Framework', slug: 'css-framework', icon: 'Layout', color: 'text-blue-400', description: 'CSS frameworks to speed up frontend development.' },
    
    // Specific Technologies
    { name: 'React', slug: 'react', icon: 'Code', color: 'text-sky-500', description: 'JavaScript library for building user interfaces.' },
    { name: 'Vue', slug: 'vue', icon: 'Code', color: 'text-green-400', description: 'Progressive JavaScript framework for building UIs.' },
    { name: 'Angular', slug: 'angular', icon: 'Code', color: 'text-red-400', description: 'Platform for building mobile and desktop web applications.' },
    { name: 'Node.js', slug: 'nodejs', icon: 'Server', color: 'text-green-500', description: 'JavaScript runtime for building server-side applications.' },
    { name: 'Python', slug: 'python', icon: 'Code', color: 'text-yellow-500', description: 'Programming language for backend development and data science.' },
    { name: 'Java', slug: 'java', icon: 'Code', color: 'text-orange-500', description: 'General-purpose programming language widely used in enterprise applications.' },
    
    // Cloud Platforms
    { name: 'AWS', slug: 'aws', icon: 'Cloud', color: 'text-yellow-400', description: 'Cloud computing services offered by Amazon.' },
    { name: 'Azure', slug: 'azure', icon: 'Cloud', color: 'text-blue-700', description: 'Cloud computing platform from Microsoft.' },
    { name: 'Google Cloud', slug: 'gcp', icon: 'Cloud', color: 'text-red-400', description: 'Cloud platform from Google for various services.' },
    
    // Emerging Tech
    { name: 'AI/ML', slug: 'ai-ml', icon: 'Brain', color: 'text-purple-500', description: 'Artificial intelligence and machine learning technologies.' },
    { name: 'Blockchain', slug: 'blockchain', icon: 'Network', color: 'text-emerald-500', description: 'Distributed ledger technology for secure transactions.' },
    { name: 'IoT', slug: 'iot', icon: 'Globe2', color: 'text-gray-500', description: 'Internet of Things, connecting devices for data exchange.' },
    
    // Tools & Utilities
    { name: 'Development Tools', slug: 'dev-tools', icon: 'Eye', color: 'text-gray-700', description: 'Tools to assist developers in building software.' },
    { name: 'Monitoring', slug: 'monitoring', icon: 'Eye', color: 'text-indigo-700', description: 'Monitoring tools to track application health and performance.' },
    { name: 'Analytics', slug: 'analytics', icon: 'BarChart2', color: 'text-teal-500', description: 'Analyzing and interpreting data to make informed decisions.' }
  ];
  
  // Create categories
  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        icon: category.icon,
        color: category.color,
        description: category.description,
      },
      create: {
        ...category,
      },
    });
  }
  
  console.log('Categories with icons and descriptions have been seeded successfully. 🌱');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
