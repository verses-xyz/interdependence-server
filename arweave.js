require('dotenv').config()
const Arweave = require('arweave')

const arweave = Arweave.init({
  host: 'arweave.net',
  port: 443,
  protocol: 'https',
  timeout: 20000,
  logging: false,
})

const ADMIN_ADDR = process.env.ARWEAVE_ADDRESS
const KEY = JSON.parse(process.env.ARWEAVE_KEY)
const DOC_TYPE = "interdependence_doc_type"
const DOC_ORIGIN = "interdependence_doc_origin"
const DOC_REF = "interdependence_doc_ref"
const SIG_NAME = "interdependence_sig_name"
const SIG_HANDLE = "interdependence_sig_handle"
const SIG_ADDR = "interdependence_sig_addr"
const SIG_ISVERIFIED = "interdependence_sig_verified"
const VERIFICATION_HANDLE = "interdependence_verif_handle"
const VERIFICATION_ADDR = "interdependence_verif_addr"

async function checkIfVerified(handle, address) {
  const req = await fetch('https://arweave.net/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      query: `
      query {
        transactions(
          tags: [
            {
              name: "${DOC_TYPE}",
              values: ["verification"]
            }
          ]
        ) {
          edges {
            node {
              id
              owner {
                address
              }
              tags {
                name
                value
              }
            }
          }
        }
      }
      `
    })
  })

  const json = await req.json()
  for (const edge of json.data.transactions.edges) {
    const n = edge.node
    if (n.owner.address === ADMIN_ADDR) {
      const parsedHandle = n.tags.find(tag => tag.name === VERIFICATION_HANDLE).value
      const parsedAddress = n.tags.find(tag => tag.name === VERIFICATION_ADDR).value
      if (handle === parsedHandle && address === parsedAddress) {
        return n.id
      }
    }
  }
  return false
}

async function persistVerification(handle, address) {
  let transaction = await arweave.createTransaction({
    data: handle
  }, KEY)
  transaction.addTag(DOC_TYPE, 'verification')
  transaction.addTag(VERIFICATION_HANDLE, handle)
  transaction.addTag(VERIFICATION_ADDR, address)
  await arweave.transactions.sign(transaction, KEY)
  return {
    ...await arweave.transactions.post(transaction),
    id: transaction.id,
  }
}

async function signDeclaration(declarationId, address, name, handle, isVerified) {
  let transaction = await arweave.createTransaction({ data: handle }, KEY)
  transaction.addTag(DOC_TYPE, 'signature')
  transaction.addTag(DOC_REF, declarationId)
  transaction.addTag(SIG_NAME, name)
  transaction.addTag(SIG_HANDLE, handle)
  transaction.addTag(SIG_ADDR, address)
  transaction.addTag(SIG_ISVERIFIED, isVerified)
  await arweave.transactions.sign(transaction, KEY)
  return await arweave.transactions.post(transaction)
}

module.exports = {
  checkIfVerified, persistVerification, signDeclaration
}