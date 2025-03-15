FROM node:18-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --production=false
COPY app.js ./
COPY public/ ./public/
COPY .env ./
EXPOSE 3004
CMD ["npm", "run", "dev"]