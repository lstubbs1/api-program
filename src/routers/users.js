const express = require('express')
const { sendWelcomeEmail } = require('../emails/account')
const User = require('../models/user')
const acc = require('../../src/emails/account')
const auth = require('../middleware/auth')
const multer = require('multer')
const sharp = require('sharp')


const router = new express.Router()

// Add a new user
router.post('/users', async (req, res) => {
  const user = new User(req.body)

  try {
    await user.save()
    const token = await user.generateAuthToken()
    sendWelcomeEmail(user.email, user.name)
    res.status(201).send({user, token})
  } 
  catch(error) {
    console.log(error)
    res.status(400).send(error)
  }
})

router.post('/users/login', async (req, res) => {

  try {
    const user = await User.findByCredentials(req.body.email, req.body.password)
    const token = await user.generateAuthToken()
    res.status(200).send({user, token})
  } 
  catch (e) {    
    res.status(400).send()
  }
})

router.post('/users/logout', auth, async (req, res) => {
  try {
    req.user.tokens = req.user.tokens.filter((token) => {
      return token.token !== req.token
    })
    await req.user.save()
    
    res.send()
  }
  catch (e) {
    console.log(e)
    res.status(500).send()
  }
})


router.get('/users/me', auth, async (req, res) => {res.send(req.user)})



router.patch('/users/me', auth, async(req, res) => {
  const mods = req.body
  const props = Object.keys(mods)
  const modifiable = ['name', 'password']
  const isValid = props.every((prop) => modifiable.includes(prop))

  if (!isValid) {
      return res.status(400).send({ error: 'Invalid updates.' })
  }

  try {
      const user = req.user
      props.forEach((prop) => user[prop] = mods[prop])
      await user.save()
      res.send(user)
  } catch (e) {
      res.status(400).send()
  }
})


router.delete('/users/me', auth, async (req, res) => {
  try {
    await req.user.deleteOne()
    res.send(req.user)
  } 
  catch (e) {
    res.status(500).send()
  }
})


const upload = multer({
  limits: {
    fileSize: 1000000 
  }, 
  fileFilter(req, file, callback) { 
    if(!file.originalname.match(/\.(jpg|jpeg|png|JPG)/)) { 
        return callback(new Error('File must be an image'))
    } 
    callback(undefined, true) // when no error occurs 
  } 
})

router.post('/users/me/avatar', auth, upload.single('avatar'), async (req, res) => {
  const buffer = await sharp(req.file.buffer)
    .resize({width: 50, height: 50})
    .png()
    .toBuffer()    

  req.user.avatar = buffer
  await req.user.save() 
  res.send() 
  }, (error, req, res, next) => {
  res.status(400).send({ error: error.message }) 
})


router.get('/users/me/avatar', auth, async (req, res) => {
  const user = req.user
  if (!user.avatar) {
      return res.status(404).send()
  }
  res.set('Content-Type', 'image/png')
  res.send(user.avatar)
})


router.delete('/users/me/avatar', auth, async (req, res) => {
  req.user.avatar = undefined
  await req.user.save()
  res.send()
})


module.exports = router