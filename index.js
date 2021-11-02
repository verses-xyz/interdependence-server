require('dotenv').config()
const express = require('express')
const bodyParser = require('body-parser')

const app = express()
const cors = require('cors')
const Twitter = require('twitter')
app.use(bodyParser.urlencoded({extended: true}))
app.use(cors())

const port = process.env.PORT || 8080
const TWEET_TEMPLATE = "I'm verifying to be a part of [redacted]: "
const {checkIfVerified, persistVerification, signDeclaration, forkDeclaration} = require("./arweave")

const client = new Twitter({
  consumer_key: process.env.CONSUMER_KEY,
  consumer_secret: process.env.CONSUMER_SECRET,
  bearer_token: process.env.BEARER_TOKEN
})

app.get('/', (req, res) => {
  res.send('ok')
})

app.get('/check/:handle/:address', (req, res) => {
  const { handle, address } = req.params
  checkIfVerified(handle, address).then(result => {
    if (result) {
      res.json({ verified: true, tx: result })
    } else {
      res.json({ verified: false })
    }
  })
})

app.post('/fork/:declaration', (req, res) => {
  const declarationId = req.params.declaration
  const {
    authors,
    newText,
  } = req.body

  const byteSize = txt => Buffer.from(txt).byteLength
  const size = Math.max(byteSize(newText), byteSize(authors))
  if (size >= (2 << 22)) {
    res.status(400).json({ status: "too large"})
    return
  }

  forkDeclaration(declarationId, newText, authors)
    .then((data) => res.json(data))
    .catch(e => {
      console.log(`err @ /fork/:declaration : ${e}`)
      res.status(500)
    })
})

// post: include name, address (from MM), handle
app.post('/sign/:declaration', (req, res) => {
  const declarationId = req.params.declaration
  const {
    name,
    address,
    handle,
  } = req.body

  // did the user include a handle?
  if (handle) {
    // check if user is verified
    checkIfVerified(handle, address).then(result => {
      const verified = !!result
      signDeclaration(declarationId, address, name, handle, verified)
        .then((data) => res.json(data))
        .catch(e => {
          console.log(`err @ /sign/:declaration : ${e}`)
          res.status(500)
        })
    })
  } else {
    // pure metamask sig
    signDeclaration(declarationId, address, name, '', false)
      .then((data) => res.json(data))
      .catch(e => {
        console.log(`err @ /sign/:declaration : ${e}`)
        res.status(500)
      })
  }
})

// post: include address (from MM)
app.post('/verify/:handle', (req, res) => {
  const handle = req.params.handle
  const {
    address,
  } = req.body

  client.get('statuses/user_timeline', {
    screen_name: handle,
    include_rts: false,
    count: 5,
  }, (error, tweets, response) => {
    if (!error) {
      for (const tweet of tweets) {
        const parsedAddress = tweet.text.slice(TWEET_TEMPLATE.length)
        if (tweet.text.startsWith(TWEET_TEMPLATE) && (parsedAddress === address)) {
          // check to see if already linked
          checkIfVerified(handle, address)
            .then(result => {
              if (result) {
                // already linked
                res.json({ tx: result })
              } else {
                // need to link
                persistVerification(handle, address)
                  .then((tx) => res.status(201).json(tx))
                  .catch(e => {
                    console.log(`err @ /verify/:handle : ${e}`)
                    res.status(500).send(JSON.stringify(e))
                  })
              }
            })
          return
        }
      }
      res.status(404).send('no matching tweets found')
    } else {
      res.status(400).send(error)
    }
  })
})

app.listen(port, () => {
  console.log(`server started on port ${port}`)
})