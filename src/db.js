const sql = require('mssql');
require('dotenv').config();

const config = {
    server: process.env.DB_SERVER || 'localhost',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : undefined,
    database: process.env.DB_DATABASE || 'MessengerDB',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
        connectTimeout: 10000
    }
};

let _pool = null;

async function getConnection() {
    if (_pool && _pool.connected) {
        return _pool;
    }
    
    try {
        _pool = await sql.connect(config);
        
        _pool.on('error', async (err) => {
            _pool = null;
        });
        
        return _pool;
    } catch (err) {
        throw err;
    }
}

module.exports = { getConnection, sql };