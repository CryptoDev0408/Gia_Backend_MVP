const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkTable() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  try {
    const [columns] = await connection.query('DESCRIBE blog_likes');
    console.log('blog_likes table structure:');
    console.log(JSON.stringify(columns, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkTable();
