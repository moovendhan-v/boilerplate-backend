# Use Ubuntu as the base image
FROM ubuntu:latest

# Install dependencies: curl, gnupg, and necessary tools
RUN apt-get update && \
    apt-get install -y curl gnupg build-essential

# Install Node.js v22
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs

# RUN apt install git

# Verify installation
RUN node -v && npm -v

# Set working directory
WORKDIR /usr/src/app

# Copy only package files first (for caching layer)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the source code
COPY . .

# Build the TypeScript project (optional if you're using TypeScript)
# RUN npm run build

# Expose the backend port
EXPOSE 4000

# Keep the container running in detached mode (or adjust as needed)
# CMD ["tail", "-f", "/dev/null"]
CMD [ "npm", "run", "dev" ]