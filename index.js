const fastify = require("fastify")();
const handler = require("./src/handler");

const sqlite3 = require("sqlite3");
const cors = require("@fastify/cors");
const multipart = require("@fastify/multipart");
const fastifyStatic = require("@fastify/static");
const path = require("path");
const dbPath = path.join(__dirname, "database.db");
const connection = new sqlite3.Database(dbPath);
const cors = require('cors');

let corsOption = {
    origin: 'https://brooks-bookstore.com/', // 허락하는 요청 주소
    credentials: true // true로 하면 설정한 내용을 response 헤더에 추가 해줍니다.
} 

app.use(cors(corsOption)); 

const PORT = 3002;

fastify.register(cors, {
  origin: "*"
});
fastify.register(multipart);
fastify.register(handler, { connection });

// 정적 파일 제공
fastify.register(fastifyStatic, {
  root: path.join(__dirname, "uploads"), // 정적 파일이 위치한 디렉터리
  prefix: "/uploads/" // 정적 파일에 접근할 경로
});

// 서버 실행
const start = async () => {
  try {
    await fastify.listen({
      port: PORT,
      host: "0.0.0.0"
    });
    console.log(`Server running on http://localhost:${PORT}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
