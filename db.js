require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: "45.179.90.229",
  user: "planejamento",
  password: "899605aA@",
  database: "inbis",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;
