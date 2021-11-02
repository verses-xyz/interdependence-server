require('dotenv').config()
const { Pool, Client } = require('pg')

// Postgres calls
const pool = new Pool()

// check signature, then save signature to db
async function signDeclaration(declarationId, address, name, handle, signature, isVerified) {
  return new Promise((resolve, reject) => {
    const values = [address, signature, name, handle];
    pool.query('INSERT INTO signatures(address, signature, name, handle) VALUES($1, $2, $3, $4) ON CONFLICT (address) DO UPDATE SET signature=EXCLUDED.signature, name=EXCLUDED.name, handle=EXCLUDED.handle', values, (err, result) => {
      if (err) {
        console.log('Could not save signature to db for', address, ': ', err);
        reject();
      } else {
        console.log('Saved signature to db for', address);
        resolve({
          address,
          signature,
        });
      }
    });
  });
}


async function ok() {
  pool.query('SELECT address, signature, name, handle FROM signatures', (err, result) => {
    if (err) {
      res.status(500).json({ status: "database error"});
    } else {
      const results = result.rows.map(({ address, signature, name, handle }) => ({ address, signature, name, handle }));
      res.json(results);
    }
  });
}