import { join } from 'path';
import { readdirSync, readFileSync } from 'fs';
import { makeExecutableSchema } from '@graphql-tools/schema';

// Function to load all .graphql files from a directory
function loadSchemaFiles(dir: string): string {
  const schemaFiles = readdirSync(dir)
    .filter(file => file.endsWith('.graphql'))
    .map(file => readFileSync(join(dir, file), 'utf8'));
  return schemaFiles.join('\n');
}

// Load all schema type definitions
const typesDir = join(__dirname, 'types');
const typeDefs = loadSchemaFiles(typesDir);

// Export typeDefs as default
export default typeDefs;