FROM node:22-alpine
WORKDIR /app
COPY server.js TempleHub_完整流程Demo.html ./
EXPOSE 3000
CMD ["node", "server.js"]
