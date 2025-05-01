// uploadBoilerplate.js
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';

// Configs
const BASE_URL = 'http://localhost:4000';
const GRAPHQL_URL = `${BASE_URL}/graphql`;
const ZIP_FILE_PATH = path.resolve('./react-starter.zip');
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Im1vb3ZlbmRoYW5hZ3JpY3VsdHVyZUBnbWFpbC5jb20iLCJzdWIiOiJjbWExb2xuaXEwMDAwMTFpZHR3cmo2ZnF5Iiwicm9sZSI6IlVTRVIiLCJqdGkiOiI0NzQ1YjNhYy00OGQ1LTQ2NDItODYyOC1hOGM0MThiOWViNWIiLCJpYXQiOjE3NDYwMjc3OTAsImV4cCI6MTc0NjExNDE5MH0.NnLj5KaYAITXOsDTESmVvKb1E87BrGtjErBel6l67SM';

// Validate file existence
if (!fs.existsSync(ZIP_FILE_PATH)) {
  console.error(`❌ File not found at: ${ZIP_FILE_PATH}`);
  process.exit(1);
}

// Create form data
const formData = new FormData();

// Now with zipFile as a separate parameter
formData.append('operations', JSON.stringify({
  query: `
    mutation CreateBoilerplate($data: BoilerplateInputType!, $zipFile: Upload) {
      createBoilerplate(data: $data, zipFile: $zipFile) {
        id
        title
        description
        framework
        language
        repositoryUrl
        tags
      }
    }
  `,
  variables: {
    data: {
      title: 'React Starter Kit',
      description: 'Simple React boilerplate',
      framework: 'React',
      language: 'JavaScript',
      repositoryUrl: 'https://github.com/example/react-starter',
      repoPath: 'https://github.com/example/react-starter',
      category: 'frontend',
      tags: ['react', 'javascript', 'starter'],
    },
    zipFile: null, // This placeholder will be replaced by the actual file
  },
}));

// Map the file directly to variables.zipFile
formData.append('map', JSON.stringify({
  '0': ['variables.zipFile']
}));

formData.append('0', fs.createReadStream(ZIP_FILE_PATH), {
  filename: 'react-starter.zip',
  contentType: 'application/zip'
});

console.log('Uploading boilerplate...');

// Upload function
const uploadBoilerplate = async () => {
  try {
    const response = await axios.post(GRAPHQL_URL, formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${TOKEN}`,
        'Apollo-Require-Preflight': 'true'
      },
      timeout: 30000,
    });
    
    console.log('✅ Boilerplate uploaded successfully:\n', response.data);
  } catch (error) {
    console.error('❌ Error uploading boilerplate:\n');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Headers:', JSON.stringify(error.response.headers, null, 2));
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('No response received:', error.request);
    } else {
      console.error('Request setup error:', error.message);
    }
  }
};

uploadBoilerplate();