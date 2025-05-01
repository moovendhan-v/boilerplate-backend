curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Apollo-Require-Preflight: true" \
  -F 'operations={"query":"mutation ($data: CreateBoilerplateInput!, $zipFile: Upload) { createBoilerplate(data: $data, zipFile: $zipFile) { id title } }", "variables":{"data":{"title":"Test"}, "zipFile":null}}' \
  -F 'map={"0":["variables.zipFile"]}' \
  -F '0=@/path/to/your/file.zip' \
  http://localhost:4000/graphql