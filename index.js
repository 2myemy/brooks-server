const fs = require('fs')
const path = require("path");
const handler = require("./src/handler");

const sqlite3 = require("sqlite3");

const fastify = require("fastify")();
const cors = require("@fastify/cors");
const multipart = require("@fastify/multipart");
const fastifyStatic = require("@fastify/static");
const dbPath = path.join(__dirname, "database.db");
const connection = new sqlite3.Database(dbPath);

const PORT = 3002;

fastify.register(cors, {
  origin: "*"
});
fastify.register(multipart);
fastify.register(handler, { connection });

fastify.register(fastifyStatic, {
  root: path.join(__dirname, "uploads"),
  prefix: "/uploads/"
});

fastify.get("/", function (request, reply) {
  reply.code(200).send({ hello: "world" });
});

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
