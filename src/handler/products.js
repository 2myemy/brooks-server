const path = require("path");
const fs = require("fs").promises;
const nodemailer = require("nodemailer");
const aws = require("aws-sdk");
require("dotenv").config();

async function routes(fastify, options) {
  const { connection } = options;
  const bucket_name = "brooks-bookstore.com";
  const s3 = new aws.S3({
    accessKeyId: process.env.accessKeyId,
    secretAccessKey: process.env.secretAccessKey,
    region: "us-east-2"
  });

  fastify.get("/products", async (request, reply) => {
    const {
      offset,
      limit,
      subject,
      course,
      status,
      query: searchQuery
    } = request.query;

    let query =
      "SELECT * FROM products p JOIN product_images img ON p.id = img.id";
    if (subject) {
      query += ` WHERE p.subject='${subject}'`;
      if (course) {
        query += ` AND p.course='${course}'`;
      }
      if (status) {
        query += ` AND p.status='${status}'`;
      }
      if (searchQuery) {
        query += ` AND p.name LIKE '%${searchQuery}%'`;
      }
    } else {
      if (status) {
        query += ` AND p.status='${status}'`;
      }
      if (searchQuery) {
        query += ` WHERE p.name LIKE '%${searchQuery}%'`;
      }
    }

    return new Promise((resolve, reject) => {
      connection.all(query, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            items: rows,
            limit,
            offset,
            total: 0
          });
        }
      });
    });
  });

  fastify.get("/products/:id", async (request, reply) => {
    const productId = request.params.id;
    return new Promise((resolve, reject) => {
      connection.get(
        "SELECT * FROM products p JOIN product_images img ON p.id = img.id WHERE p.id = ?",
        [productId],
        (err, row) => {
          if (err) {
            reject(err);
          } else if (!row) {
            reply.code(404).send({ error: "Product not found" });
          } else {
            resolve(row);
          }
        }
      );
    });
  });

  fastify.post("/products", async (request, reply) => {
    const parts = request.parts();

    let fields = {};
    let productId = 1;
    let imagePath;
    let imageName;

    for await (const part of parts) {
      if (part.type === "file") {
        const filename = part.filename;
        const imageExtension = filename.split(".").pop();
        imageName = `${Date.now()}.${imageExtension}`;
        imagePath = path.join(__dirname, "/../../uploads", imageName);
        const data = await part.toBuffer();

        const s3_params = {
          Bucket: bucket_name,
          Key: "uploads/" + imageName,
          Body: data
        };

        // await fs.writeFile(imagePath, data);
        s3.upload(s3_params, (err, data) => {
          if (err) throw err;
          console.log("File upload succeed");
          console.log(data);
        });
      } else {
        fields[part.fieldname] = part.value;
      }
    }

    await connection.run("BEGIN TRANSACTION");

    try {
      const result = await new Promise((resolve, reject) => {
        connection.run(
          "INSERT INTO products (name, price, condition, subject, course, email, createdAt, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [
            fields.course,
            fields.price,
            fields.condition,
            fields.subject,
            fields.course,
            fields.email,
            new Date().getTime(),
            0
          ],
          function(err) {
            if (err) {
              reject(err);
            } else {
              productId = this.lastID;
              resolve({ success: true });
            }
          }
        );
      });

      await connection.run(
        "INSERT INTO product_images (id, imageUrl) VALUES (?, ?)",
        [productId, `/uploads/${imageName}`]
      );
      await connection.run("COMMIT");

      return result;
    } catch (error) {
      console.error(error);
      await connection.run("ROLLBACK");
      throw error;
    }
  });

  fastify.patch(`/products/:id`, async (request, reply) => {
    const productId = request.params.id;
    return new Promise((resolve, reject) => {
      connection.run(
        "UPDATE products SET status = 1 WHERE id = ?",
        [productId],
        function(err) {
          if (err) {
            reject(err);
          } else if (this.changes === 0) {
            reply.code(404).send({ error: "Product not found" });
          } else {
            resolve({ success: true });
          }
        }
      );
    });
  });

  fastify.post(`/products/modify/:id`, async (request, reply) => {
    const productId = request.params.id;
    const parts = request.parts();

    let fields = {};
    let imagePath;
    let imageName = "";

    for await (const part of parts) {
      if (part.type === "file") {
        if (part.filename !== "" && part.filename !== undefined) {
          const filename = part.filename;
          const imageExtension = filename.split(".").pop();
          imageName = `${Date.now()}.${imageExtension}`;
          // imagePath = path.join(__dirname, "/../../uploads", imageName);
          const data = await part.toBuffer();

          const s3_params = {
            Bucket: bucket_name,
            Key: "uploads/" + imageName,
            Body: data
          };

          // await fs.writeFile(imagePath, data);
          s3.upload(s3_params, (err, data) => {
            if (err) throw err;
            console.log("File upload succeed");
            console.log(data);
          });
        }
      } else {
        fields[part.fieldname] = part.value;
      }
    }

    await connection.run("BEGIN TRANSACTION");

    try {
      const result = await new Promise((resolve, reject) => {
        connection.run(
          "UPDATE products SET name=?, price=?, condition=?, subject=?, course=?, email=?, status=? WHERE id = ?",
          [
            fields.name,
            fields.price,
            fields.condition,
            fields.subject,
            fields.course,
            fields.email,
            fields.status,
            fields.id
          ],
          function(err) {
            if (err) {
              reject(err);
            } else {
              resolve({ success: true });
            }
          }
        );
      });

      if (imageName !== "") {
        await connection.run(
          "UPDATE product_images SET imageUrl=? WHERE id = ?",
          [`/uploads/${imageName}`, productId]
        );
      }

      await connection.run("COMMIT");

      return result;
    } catch (error) {
      console.error(error);
      await connection.run("ROLLBACK");
      throw error;
    }
  });

  fastify.delete("/products/:id", async (request, reply) => {
    const productId = request.params.id;
    return new Promise((resolve, reject) => {
      connection.run("DELETE FROM products WHERE id = ?", [productId], function(
        err
      ) {
        if (err) {
          reject(err);
        } else if (this.changes === 0) {
          reply.code(404).send({ error: "Product not found" });
        } else {
          resolve({ success: true });
        }
      });
    });
  });

  fastify.post(`/email/send`, async (request, reply) => {
    try {
      const EMAIL = "noreplybrooks@gmail.com";
      const EMAIL_PW = "widw cszm pnuf ppas";
      const parts = request.parts();

      let fields = {};
      for await (const part of parts) {
        fields[part.fieldname] = part.value;
      }

      let receiverEmail = fields.email;
      // let receiverEmail = "lss8340@gmail.com";

      // transport 생성
      let transport = nodemailer.createTransport({
        service: "gmail",
        host: "0.0.0.0",
        port: 25,
        auth: {
          user: EMAIL,
          pass: EMAIL_PW
        }
      });

      let mailOptions = {
        from: EMAIL,
        to: receiverEmail,
        subject:
          "Someone wants to purchase your book! (" + fields.bookname + ")",
        html:
          "<h1>Someone wants to contact you to purchase your book!</h1><br>" +
          "<h3>[ Book Information ]</h3>" +
          "<p>" +
          "<b>Book name: </b>" +
          fields.bookname +
          "<br>" +
          "<b>Subject: </b>" +
          fields.subject +
          "<br>" +
          "<b>Course: </b>" +
          fields.course +
          "<br>" +
          "<b>Price: </b>" +
          fields.price +
          "<br><br><p>"+
          "<h3>[ Message From The Customer ]</h3>" +
          "<p>" +
          "<b>Email: </b>" +
          fields.receiveremail +
          "<br><b>Message: </b>" +
          fields.message+
          "<br><br>If you want to sell this book, please reply to the message received at the above email address." +
          "</p>"
      };

      // send email
      const result = await new Promise((resolve, reject) => {
        transport.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.log(error);
            reply.code(404).send({ error: "Sending a mail failed" });
            reject(err);
          }
          console.log(info);
          console.log("send mail success!");
          resolve({ success: true });
        });
      });
      return result;
    } catch (error) {
      console.error(error);
      throw error;
    }
  });
}

module.exports = routes;
