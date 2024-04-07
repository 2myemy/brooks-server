const path = require('path');
const fs = require('fs').promises;

async function routes(fastify, options) {
    const { connection } = options;

    fastify.get('/products', async (request, reply) => {
      const { offset, limit, subject, course, query: searchQuery } = request.query;

      let query = 'SELECT * FROM products p JOIN product_images img ON p.id = img.id';
      if (subject) {
        query += ` WHERE p.subject='${subject}'`;
        if (course) {
          query += `  AND p.course='${course}'`;
        }
        if (searchQuery) {
          query += ` AND p.name LIKE '%${searchQuery}%'`;
        }
      } else {
        if (searchQuery) {
          query += `WHERE p.name LIKE '%${searchQuery}%'`;
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
              total: 0,
            });
          }
        });
      });
    });
  
    fastify.get('/products/:id', async (request, reply) => {
      const productId = request.params.id;
      return new Promise((resolve, reject) => {
        connection.get('SELECT * FROM products p JOIN product_images img ON p.id = img.id WHERE p.id = ?', [productId], (err, row) => {
          if (err) {
            reject(err);
          } else if (!row) {
            reply.code(404).send({ error: 'Product not found' });
          } else {
            resolve(row);
          }
        });
      });
    });
  
    fastify.post('/products', async (request, reply) => {
      const parts = request.parts();

      let fields = {};
      let productId = 1;
      let imagePath;
      let imageName;

      for await (const part of parts) {
        if (part.type === 'file') {
          const filename = part.filename;
          const imageExtension = filename.split('.').pop();
          imageName = `${Date.now()}.${imageExtension}`;
          imagePath = path.join(__dirname, '/../../uploads', imageName);
          const data = await part.toBuffer();
          await fs.writeFile(imagePath, data);

        } else {
          fields[part.fieldname] = part.value     
        }
      }

      await connection.run('BEGIN TRANSACTION');

      try {
        const result = await new Promise((resolve, reject) => {
          connection.run('INSERT INTO products (name, price, condition, subject, course, email, createdAt, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
            [fields.course, fields.price, fields.condition, fields.subject, fields.course, fields.email, new Date().getTime(), 0], function (err) {
            if (err) {
              reject(err);
            } else {
              productId = this.lastID;
              resolve({ success: true });
            }
          });
        });

        await connection.run('INSERT INTO product_images (id, imageUrl) VALUES (?, ?)', [productId, `/uploads/${imageName}`]);
        await connection.run('COMMIT');

        return result;
      } catch (error) {
        console.error(error);
        await connection.run('ROLLBACK');
        throw error;
      }
    });

    fastify.patch(`/products/:id`, async (request, reply) => {
      const productId = request.params.id;
      return new Promise((resolve, reject) => {
        connection.run('UPDATE products SET status = 1 WHERE id = ?', [productId], function (err) {
          if (err) {
            reject(err);
          } else if (this.changes === 0) {
            reply.code(404).send({ error: 'Product not found' });
          } else {
            resolve({ success: true });
          }
        });
      });
    });
  
    fastify.delete('/products/:id', async (request, reply) => {
      const productId = request.params.id;
      return new Promise((resolve, reject) => {
        connection.run('DELETE FROM products WHERE id = ?', [productId], function (err) {
          if (err) {
            reject(err);
          } else if (this.changes === 0) {
            reply.code(404).send({ error: 'Product not found' });
          } else {
            resolve({ success: true });
          }
        });
      });
    });
  }
  
  module.exports = routes;